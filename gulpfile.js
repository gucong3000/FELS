"use strict";
var gulp = require("gulp");
var path = require("path");
var gutil = require("gulp-util");
var through = require("through2");
var uglifyOpt = {
	//保留IE的jscript条件注释
	preserveComments: function(o, info) {
		return /@(cc_on|if|else|end|_jscript(_\w+)?)\s/i.test(info.value);
	}
};
// gulp 插件引用开始

// gulp缓存插件，只传递变化了的文件
var cache = require("gulp-cached");
// gulp缓存读取插件，读取缓存中的内容
var remember = require("gulp-remember");
// gulp异常处理插件
var plumber = require("gulp-plumber");

var isDev;

// gulp 插件引用结束

function getFile(callback) {
	var through = require("through2");
	return through.obj(function(file, enc, cb) {
		if (file.isNull()) {
			return cb(null, file);
		}

		if (file.isStream()) {
			this.emit("error", new Error("Streaming not supported"));
			return cb();
		}

		var content;
		try {
			content = callback(file.contents.toString(), file);
		} catch (ex) {
			this.emit("error", ex);
		}
		if (content) {
			file.contents = new Buffer(content);
			this.push(file);
			cb();
		} else {
			cb(null, file);
		}
	});
}

var jsModule = getFile((content, file) => {
	// 模块加载器、非js模块普通文件，cmd规范模块，不作处理
	if (/\/common(?:\Wmin)?\.js$/.test(file.path) || !/\b(?:define\(|module|exports|require\()\b/.test(content) || /\bdefine\.cmd\b/.test(content)) {
		return content;
	}
	var isAmd;
	content = content.replace(/\bdefine\.amd\b/, function() {
		isAmd = true;
		return "define.useamd()";
	});
	if (isAmd || /\bdefine\(\b/.test(content)) {
		return content;
	}
	// CommonJS 规范的 js module.
	var deps = [];

	function addDesp(moduleName) {
		if (!/^(?:common)$/.test(moduleName)) {
			deps.push(JSON.stringify(moduleName));
		}
		return "";
	}

	content.replace(/\/\/[^\r\n]+/g, "").replace(/\/\*.+?\*\//g, "").replace(/\brequire\(\s*(["'])([^"']+)\1\s*\)/g, function(s, quotes, moduleName) {
		// 分析代码中的`require("xxxx")`语句，提取出模块名字
		return addDesp(moduleName);
	}).replace(/\bimport\b[^;]+?\bfrom\s+(["'])([^"']+)\1/g, function(s, quotes, moduleName) {
		// 分析代码中的`import`语句，提取出模块名字
		return addDesp(moduleName);
	});

	if (deps.length) {
		deps = `,[${ deps.join(",") }]`;
	} else {
		deps = "";
	}

	content = content.trim();

	// 对整个js块包裹CMD规范的标准Wrap
	content = `(function(f){typeof define==="function"?define("${ file.path }"${ deps },f):f()})(function(require,exports,module){
${ content }
});`;
	return content;
});

function jsPipe(stream) {
	var sourcemaps;
	if (isDev) {
		// js 代码风格检查
		var jshint = require("gulp-jshint");

		require("./jshint-msg");
		stream = stream.pipe(jshint())
			.pipe(getFile(function(js, file) {
				if (file.jshint && !file.jshint.success && !file.jshint.ignored) {
					var err = new Error(file.jshint.results.map(function(result) {
						return "\n[L" + result.error.line + ":C" + result.error.character + "]\t" + result.error.reason + "\n\t" + result.error.evidence;
					}).join(""), file.path);
					err.name = "js代码检查错误";
					// http://jslinterrors.com/api/
					// http://api.jslinterrors.com/explain?message=Bad%20assignment&format=md
					throw err;
				}
			}));
	} else {
		sourcemaps = require("gulp-sourcemaps");
		stream = stream.pipe(sourcemaps.init());
	}
	// 兼容ES6
	stream = stream.pipe(require("gulp-babel")())
		// 解决压缩js会破坏AngularJS文件所需的依赖注入问题
		.pipe(require("gulp-ng-annotate")());
	// js代码压缩
	if (!isDev) {
		stream = stream.pipe(require("gulp-uglify")(uglifyOpt));
	}

	// AMD、CDM模块封装
	stream = stream.pipe(getFile(function(contents, file) {
		if (!/\bdefine\(/.test(contents) && (/\brequire\(/.test(contents) || /\bmodule|exports\b/.test(contents))) {
			return "(function(f){typeof define===\"function\"?define(\"/" + path.relative(file.base, file.path).replace(/\\/g, "/") + "\",f):f()})(function(require,exports,module){\n" + contents.trim() + "\n});";
		}
	}));

	if (sourcemaps) {
		stream = stream.pipe(sourcemaps.write("."));
	}
	return stream;
}

function cssPipe(stream) {
	var postcss = require("gulp-postcss");
	var cssnext = require("cssnext");
	var autoprefixer = require("autoprefixer");
	var cssgrace = require("cssgrace");

	var processors = [
		cssnext,
		cssgrace,
		autoprefixer({
			browsers: ["last 3 version", "ie > 8", "Android >= 3", "Safari >= 5.1", "iOS >= 5"]
		}),
	];
	stream = stream.pipe(postcss(processors));
	if (!isDev) {
		// css压缩
		stream = stream.pipe(require("gulp-minify-css")());
	}
	return stream;
}

function htmlPipe(stream) {
	return stream;
}

module.exports = (staticRoot, env) => {

	isDev = env === "development";

	staticRoot = staticRoot || process.cwd();
	var gulpOpts = {
		base: staticRoot
	};

	var sendFileCache = {};

	function sendFile(filePath) {

		var pipeFn;
		filePath = path.resolve(path.join(staticRoot, filePath));

		if (sendFileCache[filePath]) {
			// 如果外部请求的文件正好缓存中有，则发送出去，然后清除缓存中的此文件
			// sourceMap之类情况就是这样，上次请求js时生成的map文件放在缓存中，浏览器下次来取
			return new Promise((resolve) => {
				resolve(sendFileCache[filePath]);
			});
		} else if (/[\.\-]min\.\w+$/.test(filePath)) {
			// 已压缩文件，不作处理
			return;
		} else if (/\.js$/i.test(filePath)) {
			pipeFn = jsPipe;
		} else if (/\.css$/i.test(filePath)) {
			pipeFn = cssPipe;
		} else if (/\.html?$/i.test(filePath)) {
			pipeFn = htmlPipe;
		} else {
			return;
		}

		return new Promise((resolve, reject) => {
			var stream = gulp.src(filePath, gulpOpts)
				// 错误汇报机制
				.pipe(plumber(ex => {
					delete cache.caches[filePath];
					reject(ex);
				}))
				// 仅仅传递变化了的文件
				.pipe(cache(filePath));

			// 调用正式的gulp工作流
			stream = pipeFn(stream);

			// 获取缓存中的数据
			stream.pipe(remember(filePath))

			// 取出文件内容，返回给外部
			.pipe(through.obj((file) => {
				file.etag = require("etag")(file.contents);
				// 如果获取到的文件正好是外部要获取的文件，则发送给外部
				if (file.path === filePath) {
					resolve(file);
				} else {
					// 如果获取到的文件是sourceMap之类的文件，先放进缓存，等外部下次请求时发送
					sendFileCache[file.path] = file;
				}
			}));
		});
	}
	return sendFile;
};