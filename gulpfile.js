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

// Stylelint config rules
var stylelintConfig = {
	"rules": {
		"block-no-empty": true,
		"color-no-invalid-hex": true,
		"declaration-colon-space-after": "always",
		"declaration-colon-space-before": "never",
		"function-comma-space-after": "always",
		"function-url-quotes": "double",
		"media-feature-colon-space-after": "always",
		"media-feature-colon-space-before": "never",
		"media-feature-name-no-vendor-prefix": true,
		"max-empty-lines": 5,
		"number-leading-zero": "never",
		"number-no-trailing-zeros": true,
		"property-no-vendor-prefix": true,
		"selector-list-comma-space-before": "never",
		"selector-list-comma-newline-after": "always",
		"selector-no-id": true,
		"string-quotes": "double",
		"value-no-vendor-prefix": true
	}
};

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

/**
 * 代码错误汇报函数，在浏览器中运行，用于将jshinit收集到的报出的错误信息在浏览器控制台中弹出
 * 注意！！此函数将被toString()后发送到浏览器，并非在node下运行！！
 * @param  {Array} errors 二维数组，里面的维度，[0]是错误消息，[1]是行号，[2]是列号
 * @param  {String} path    文件的路径，可以是js模块路径
 */
function jsBrowserReporter(errors, path) {
	var uri;
	try {
		throw new Error("_");
	} catch (e) {
		try {
			e.stack.replace(/(?:\bat\b|@).*?(\b\w+\:\/{2,}.*?)(?:\:\d+){2,}/, function(m, url) {
				uri = url;
			});
		} catch (ex) {

		}
	}

	// 获取js文件当前路径
	if (uri) {
		// 延迟运行，以免干扰js正常运行流程
		setTimeout(function() {
			// 将文件路径与模块路径拼接为完整的url
			uri = uri.replace(/^((?:\w+\:)?\/{2,}[^\/]+)?.*$/, "$1" + path);
			var unshowMsg = "";
			errors.forEach(window.Error && "fileName" in Error.prototype ? function(err) {
				// 方式一：new Error，对error的属性赋值，然后throw
				var errorObj;
				try {
					errorObj = new SyntaxError(err[0]);
				} catch (ex) {
					errorObj = new Error(err[0]);
				}
				errorObj.columnNumber = err[2];
				errorObj.fileName = uri;
				errorObj.lineNumber = err[1];
				errorObj.message = err[0];
				setTimeout(function() {
					throw errorObj;
				}, 0);

			} : function(err) {
				// 方式二：console.error方式汇报错误
				err = ("SyntaxError: [0]\n\tat (" + uri + ":[1]:[2])").replace(/\[\s*(\d+)\s*\]/g, function(s, key) {
					return err[+key] || s;
				});

				try {
					// 如果你追踪错误提示来找到这一行，说明你来错误了地方，请按控制台中提示的位置去寻找代码。
					console.warn(err);
				} catch (ex) {
					try {
						// 如果你追踪错误提示来找到这一行，说明你来错误了地方，请按控制台中提示的位置去寻找代码。
						console.error(err);
					} catch (ex) {
						try {
							console.log(err);
						} catch (ex) {
							unshowMsg += err + "\n";
						}
					}
				}
			});
			// 不支持console.error的浏览器，用alert弹出错误
			if (unshowMsg) {
				/* global alert */
				alert(unshowMsg);
			}
		}, 200);
	}
}

function jsPipe(stream) {
	var sourcemaps;
	if (isDev) {
		// js 代码风格检查
		var jshint = require("gulp-jshint");

		require("./jshint-msg");
		stream = stream.pipe(jshint());
	} else {
		sourcemaps = require("gulp-sourcemaps");
		stream = stream.pipe(sourcemaps.init())
			// js代码压缩
			.pipe(require("gulp-uglify")(uglifyOpt));
	}
	// 兼容ES6
	// stream = stream.pipe(require("gulp-babel")())

	// 解决压缩js会破坏AngularJS文件所需的依赖注入问题
	// .pipe(require("gulp-ng-annotate")());

	// AMD、CDM模块封装
	stream = stream.pipe(getFile(function(contents, file) {
		if (!/\bdefine\(/.test(contents) && (/\brequire\(/.test(contents) || /\bmodule|exports\b/.test(contents))) {
			file.moduleWrapLineNumber = 1;
			return "(function(f){typeof define===\"function\"?define(\"/" + path.relative(file.base, file.path).replace(/\\/g, "/") + "\",f):f()})(function(require,exports,module){\n" + contents + "\n});";
		}
	}));

	if (isDev) {
		// jshint错误汇报
		stream = stream.pipe(getFile(function(js, file) {
			var lineCount = js.replace(/\/\*(?:.|\n)+?\*\//g, "").replace(/\n+/g, "\n").trim().match(/\n/g);
			if (lineCount && lineCount.length > 3 && file.jshint && !file.jshint.success && !file.jshint.ignored && !/[\\/]jquery(?:-\d.*?)?(?:[-\.]min)?.js$/.test(file.path)) {
				var uri = JSON.stringify("/" + path.relative(file.base, file.path).replace(/\\/g, "/"));
				console.log(file.moduleWrapLineNumber);
				var errors = JSON.stringify(file.jshint.results.map(result => [result.error.reason, result.error.line + (file.moduleWrapLineNumber || 0), result.error.character]));
				var reporter = jsBrowserReporter.toString().replace(/^(function)\s*\w+/, "$1");
				return `${ js }
(${ reporter })(${ errors }, ${ uri })
`;
			}
		}));
	} else {
		// 输出sourcemaps
		stream = stream.pipe(sourcemaps.write("."));
	}
	return stream;
}

function cssPipe(stream) {
	var processors = [
		isDev ? require("stylelint")(stylelintConfig) : null,
		// scss风格的预处理器
		// require("precss")(),
		// css未来标准提前使用
		// require("cssnext")(),
		// IE8期以下兼容rem
		require("pixrem"),
		// IE9兼容vmin
		require("postcss-vmin"),
		// IE8以下兼容合集
		require("cssgrace"),
		// background: linear-gradient(to bottom, #1e5799, #7db9e8);输出为IE滤镜
		require("postcss-filter-gradient"),
		// 静态资源版本控制
		require("postcss-url")({
			useHash: true,
			url: "copy" // or "inline" or "copy"
		}),
		// 浏览器私有属性前缀添加
		require("autoprefixer")({
			browsers: ["last 3 version", "ie > 8", "Android >= 3", "Safari >= 5.1", "iOS >= 5"]
		}),
		isDev ? require("postcss-browser-reporter") : null,
		isDev ? require("postcss-reporter")({
			clearMessages: true
		}) : null,
	];

	// 过滤掉空的postcss插件
	processors = processors.filter(processor => processor);

	stream = stream.pipe(require("gulp-postcss")(processors));

	if (!isDev) {
		// css压缩
		stream = stream.pipe(require("gulp-clean-css")());
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
			return Promise.resolve(sendFileCache[filePath]);
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