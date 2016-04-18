"use strict";
var path = require("path");
var fs = require("fs");
var gutil = require("gulp-util");
var through = require("through2");
var uglifyOpt = {
	//保留IE的jscript条件注释
	preserveComments: (o, info) => {
		return /@(cc_on|if|else|end|_jscript(_\w+)?)\s/i.test(info.value);
	}
};

// 是否汇报错误
var reporter = false;;
// 项目根目录设置
var baseDir;

// gulp 插件引用开始
// gulp缓存插件，只传递变化了的文件
var cache = require("gulp-cached");
// gulp缓存读取插件，读取缓存中的内容
var remember = require("gulp-remember");
// gulp异常处理插件
var plumber = require("gulp-plumber");
// gulp 插件引用结束

var isDev;


function getFile(callback, debugname) {
	return require("through2").obj((file, encoding, cb) => {
		if (file.isNull()) {
			return cb(null, file);
		}

		if (file.isStream()) {
			return cb(new Error("Streaming not supported"));
		}

		var content;
		try {
			content = callback(file.contents.toString(), file);
		} catch (err) {
			return cb(new gutil.PluginError(debugname, file.path + ": " + (err.message || err.msg || "unspecified error"), {
				fileName: file.path,
				lineNumber: err.line,
				stack: err.stack,
				showStack: false
			}));
		}

		if (content) {
			file.contents = new Buffer(content);
		}
		cb(null, file);
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
// Stylelint reporter config
var warnIcon = encodeURIComponent(`<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="48px" height="48px" viewBox="0 0 512 512" enable-background="new 0 0 512 512" xml:space="preserve"><path fill="#A82734" id="warning-4-icon" d="M228.55,134.812h54.9v166.5h-54.9V134.812z M256,385.188c-16.362,0-29.626-13.264-29.626-29.625c0-16.362,13.264-29.627,29.626-29.627c16.361,0,29.625,13.265,29.625,29.627C285.625,371.924,272.361,385.188,256,385.188z M256,90c91.742,0,166,74.245,166,166c0,91.741-74.245,166-166,166c-91.742,0-166-74.245-166-166C90,164.259,164.245,90,256,90z M256,50C142.229,50,50,142.229,50,256s92.229,206,206,206s206-92.229,206-206S369.771,50,256,50z"/></svg>`);
var stylelintReporterConfig = {
	styles: {
		"display": "block",

		"margin": "1em",
		"font-size": ".9em",
		"padding": "1.5em 1em 1.5em 4.5em",
		/* padding + background image padding */

		/* background */
		"color": "white",
		"background-color": "#DF4F5E",
		"background": `url("data:image/svg+xml;charset=utf-8,${ warnIcon }") .5em 1.5em no-repeat, #DF4F5E linear-gradient(#DF4F5E, #CE3741)`,

		/* sugar */
		"border": "1px solid #C64F4B",
		"border-radius": "3px",
		"box-shadow": "inset 0 1px 0 #EB8A93, 0 0 .3em rgba(0,0,0, .5)",

		/* nice font */
		"white-space": "pre-wrap",
		"font-family": "Menlo, Monaco, monospace",
		"text-shadow": "0 1px #A82734"
	}
};
var jsModule = getFile((content, file) => {
	// 模块加载器、非js模块普通文件，cmd规范模块，不作处理
	if (/\/common(?:\Wmin)?\.js$/.test(file.path) || !/\b(?:define\(|module|exports|require\()\b/.test(content) || /\bdefine\.cmd\b/.test(content)) {
		return content;
	}
	var isAmd;
	content = content.replace(/\bdefine\.amd\b/, () => {
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

	content.replace(/\/\/[^\r\n]+/g, "").replace(/\/\*.+?\*\//g, "").replace(/\brequire\(\s*(["'])([^"']+)\1\s*\)/g, (s, quotes, moduleName) => {
		// 分析代码中的`require("xxxx")`语句，提取出模块名字
		return addDesp(moduleName);
	}).replace(/\bimport\b[^;]+?\bfrom\s+(["'])([^"']+)\1/g, (s, quotes, moduleName) => {
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
}, "jsModule");

/**
 * 检查代码去除块注释后、合并连续换行符之后，还有有几行
 * @param  {String} code 要检查的代码
 * @return {Number}      代码行数
 */
function lineCount(code) {
	var lineCount = code.replace(/\/\*(?:.|\r?\n)+?\*\//g, "").replace(/(?:\r?\n)+/g, "\n").trim().match(/\n/g);
	return lineCount ? lineCount.length : 0;
}

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
				// 方式二：console.warn方式汇报错误
				err = ("SyntaxError: [0]\n\tat (" + uri + ":[1]:[2])").replace(/\[\s*(\d+)\s*\]/g, function(s, key) {
					return err[+key] || s;
				});

				try {
					// 如果你追踪错误提示来找到这一行，说明你来错误了地方，请按控制台中提示的位置去寻找代码。
					console.error(err);
				} catch (ex) {
					try {
						// 如果你追踪错误提示来找到这一行，说明你来错误了地方，请按控制台中提示的位置去寻找代码。
						console.log(err);
					} catch (ex) {
						// 不支持console的浏览器中，记录下消息，稍后alert
						unshowMsg += err + "\n";
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
	if (isDev) {
		// js代码美化
		stream = jsBeautify(stream);
		// js 代码风格检查
		var jshint = require("gulp-jshint");

		require("./jshint-msg");
		stream = stream.pipe(jshint());
	} else {
		stream = stream.pipe(require("gulp-sourcemaps").init())

		// js代码压缩
		.pipe(require("gulp-uglify")(uglifyOpt));
	}
	// 兼容ES6
	// stream = stream.pipe(require("gulp-babel")())

	// 解决压缩js会破坏AngularJS文件所需的依赖注入问题
	// .pipe(require("gulp-ng-annotate")());

	// AMD、CDM模块封装
	stream = stream.pipe(getFile(function(contents, file) {
		if (!/\bdefine\(/i.test(contents) && (/\brequire\(/i.test(contents) || /(?:\bmodule|exports)\s*=[^=]/i.test(contents))) {
			return `(function(f){typeof define==="function"?define("/${ file.relative.replace(/\\/g, "/") }",f):f()})(function(require,exports,module){${
contents
}});`;
		}
	}, "AMD、CDM模块封装"));

	if (isDev && reporter) {
		// jshint错误汇报
		stream = stream.pipe(getFile(function(js, file) {
			if (file.jshint && !file.jshint.success && !file.jshint.ignored && !/[\\/]jquery(?:-\d.*?)?(?:[-\.]min)?.js$/.test(file.path)) {
				var uri = JSON.stringify("/" + file.relative.replace(/\\/g, "/"));
				var errors = JSON.stringify(file.jshint.results.map(result => [result.error.reason, result.error.line, result.error.character]));
				var reporter = jsBrowserReporter.toString().replace(/^(function)\s*\w+/, "$1");
				return `${ js }
(${ reporter })(${ errors }, ${ uri })
`;
			}
		}, "jshint错误汇报"));
	}
	return stream;
}

var RcLoader = require("rcloader");
var rcCache = {};
var defaultOpts = {
	// Stylelint config rules
	".csscomb.json": {
		// Whether to add a semicolon after the last value/mixin.
		"always-semicolon": true,
		// Set indent for code inside blocks, including media queries and nested rules.
		"block-indent": "\t",
		// Unify case of hexadecimal colors.
		"color-case": "lower",
		// Whether to expand hexadecimal colors or use shorthands.
		"color-shorthand": true,
		// Unify case of element selectors.
		"element-case": "lower",
		// Add/remove line break at EOF.
		"eof-newline": true,
		// Add/remove leading zero in dimensions.
		"leading-zero": false,
		// Unify quotes style.
		"quotes": "double",
		// Remove all rulesets that contain nothing but spaces.
		"remove-empty-rulesets": true,
		"sort-order-fallback": "abc",
		// Set space after `:` in declarations.
		"space-after-colon": " ",
		// Set space after combinator (for example, in selectors like `p > a`).
		"space-after-combinator": " ",
		// Set space after `{`.
		"space-after-opening-brace": "\n",
		// Set space after selector delimiter.
		"space-after-selector-delimiter": "\n",
		// Set space before `}`.
		"space-before-closing-brace": "\n",
		// Set space before `:` in declarations.
		"space-before-colon": "",
		// Set space before combinator (for example, in selectors like `p > a`).
		"space-before-combinator": " ",
		// Set space before `{`.
		"space-before-opening-brace": " ",
		// Set space before selector delimiter.
		"space-before-selector-delimiter": "",
		// Set space between declarations (i.e. `color: tomato`).
		"space-between-declarations": "\n",
		// Whether to trim trailing spaces.
		"strip-spaces": true,
		"tab-size": true,
		// Whether to remove units in zero-valued dimensions.
		"unitless-zero": true
	}
};

var cacheNotification = {};
var notifyBasy;
var notifier = require("node-notifier");
notifier.on("timeout", function() {
	notifyBasy = false;
	notify();
});

function notify() {
	if (notifyBasy) {
		return;
	}
	for (var filePath in cacheNotification) {
		notifyBasy = true;
		var opts = cacheNotification[filePath];
		opts.message = "发现未规范化的代码，点击修复此问题。\n" + filePath;
		opts.sound = true;
		opts.time = 5000;
		opts.wait = true;
		notifier.notify(opts, function(err, response) {
			// Response is response from notification
			if (!err && response === "activate") {
				fs.writeFile(filePath, opts.newCode, function(err) {
					if (!err) {
						gutil.log("文件被自动修复：\n" + filePath);
					}
				});
				delete cacheNotification[filePath];
				notifyBasy = false;
				notify();
			}
		});
		return;
	}
	notifyBasy = false;
}


/**
 * 代码美化，调用opts.beautify函数美化代码后，如果代码产生变化，弹出气泡提示，如用户点击气泡，则写入新代码到文件
 * @param  {Stream}			stream				包含文件的数据流
 * @param  {String}			[opts.rcName]		配置文件文件名，供rcloader组件加载配置用
 * @param  {Function}		[opts.beautify]		代码美化函数，参数三个，{String}旧代码、{Object}rcloader找到的配置、{vinyl}文件对象
 * @param  {String}			[opts.title]		弹出的气泡的标题
 * @param  {Buffer|String}	[opts.icon]			弹出的气泡提示中的图片，可谓文件内容的buffer，或文件路径、或文件url
 * @return {Stream}			stream				原样返回的stream，与原始值一样
 */
function fileFix(stream, opts) {
	return stream.pipe(getFile(function(code, file) {
		var rcLoader = rcCache[opts.rcName] || (rcCache[opts.rcName] = new RcLoader(opts.rcName, defaultOpts[opts.rcName] || (defaultOpts[opts.rcName] = {}), {
			loader: "async"
		}));

		var filePath = file.path;
		rcLoader.for(filePath, function(err, rc) {

			if (err) {
				rc = defaultOpts[opts.rcName];
			}

			opts.beautify(code, rc, file).then(newCode => {
				if (newCode) {
					if (newCode.trim() === code.trim()) {
						delete cacheNotification[filePath];
					} else {
						notify();
						opts.newCode = newCode.replace(/\n*$/, "\n\n");
						cacheNotification[filePath] = opts;
					}
				}
			}).catch(err => {
				console.error(err.stack || err);
			});
		});
	}, opts.title));
}

/* CSS代码美化 */
function csscomb(stream) {
	return fileFix(stream, {
		title: "js-beautify",
		icon: "https://avatars1.githubusercontent.com/u/38091",
		"rcName": ".csscomb.json",
		beautify: function(css, config, file) {
			var postcss = require("postcss");
			var removePrefixes = require("postcss-remove-prefixes");
			css = postcss([removePrefixes()]).process(css).css;
			var comb = new require("csscomb")(config || "csscomb");
			return new Promise((resolve) => {
				resolve(comb.processString(css, {
					syntax: file.path.split(".").pop(),
					filename: file.path
				}));
			});
		}
	});
}

/* js代码美化 */
function jsBeautify(stream) {
	return fileFix(stream, {
		title: "js-beautify",
		icon: "https://avatars1.githubusercontent.com/u/38091",
		"rcName": ".jsbeautifyrc",
		beautify: function(js, config, file) {
			return new Promise((resolve, reject) => {
				var fileIgnored = require("gulp-jshint/src/fileIgnored");
				fileIgnored(file, (err, ignored) => {
					if (err) {
						return reject(err);
					}
					if (ignored) {
						return resolve();
					}
					resolve(require("js-beautify").js_beautify(js, config));
				});
			});
		}
	});
}

// css工作流
function cssPipe(stream) {
	var processors = [
		isDev ? require("stylelint")(stylelintConfig) : null,
		// css未来标准提前使用
		require("postcss-cssnext")({
			features: {
				"autoprefixer": {
					browsers: ["last 3 version", "ie > 8", "Android >= 3", "Safari >= 5.1", "iOS >= 5"]
				}
			}
		}),
		// scss风格的预处理器
		// require("precss")(),
		// IE8期以下兼容rem
		require("pixrem"),
		// IE9兼容vmin
		require("postcss-vmin"),
		// IE8以下兼容合集
		// require("cssgrace"),
		// background: linear-gradient(to bottom, #1e5799, #7db9e8);输出为IE滤镜
		require("postcss-filter-gradient"),
		// 静态资源版本控制
		require("postcss-url")({
			useHash: true,
			url: "copy" // or "inline" or "copy"
		}),
		isDev && reporter ? require("postcss-browser-reporter")(stylelintReporterConfig) : null,
		isDev ? require("postcss-reporter")({
			formatter: reporter ? input => {
				return input.source + " produced " + input.messages.length + " messages";
			} : undefined,
			clearMessages: true
		}) : null,
	];

	if (isDev) {
		// CSS代码美化
		stream = csscomb(stream);
	} else {
		// css sourcemaps初始化
		stream = stream.pipe(require("gulp-sourcemaps").init());
	}

	// 过滤掉空的postcss插件
	processors = processors.filter(processor => processor);

	stream = stream.pipe(require("gulp-postcss")(processors));

	if (!isDev) {
		// css压缩
		stream = stream.pipe(require("gulp-clean-css")());
	}

	return stream;
}

// html工作流
function htmlPipe(stream) {
	return stream;
}

module.exports = (staticRoot, env) => {

	isDev = env === "development";

	baseDir = staticRoot || process.cwd();

	var sendFileCache = {};

	/**
	 * 获取文件sourceMap，sourceMap文件写入缓存(sendFileCache), return sourceMap路径声明注释
	 * @param  {vinyl} file		要获取sourceMap的文件
	 * @return {String}			若file有sourceMap，则返回换行符开头的文件注释，注释内容为sourceMap路径声明
	 */
	function getSourceMap(file) {
		if (file.sourceMap && !/\bsourceMappingURL=[^\n]+\.map\b/.test(file.contents)) {

			file.sourceMap.sourceRoot = "//view-source/";
			var sourceMap = JSON.stringify(file.sourceMap),
				sourceMapPath = file.path + ".map",
				url = sourceMapPath.replace(/^.*[\/\\]/, ""),
				sourceMapFile = new gutil.File({
					cwd: file.cwd,
					base: file.base,
					path: sourceMapPath,
					contents: new Buffer(sourceMap)
				});

			sourceMapFile.etag = require("etag")(file.contents);
			sendFileCache[sourceMapPath] = sourceMapFile;

			return /\.js$/.test(file.path) ? "\n//# sourceMappingURL=" + url : "\n/*# sourceMappingURL=" + url + " */";
		}
		return "";
	}


	function sendFile(filePath) {
		function string_src(filename, buffer) {
			var src = require("stream").Readable({
				objectMode: true
			});
			src._read = function() {
				this.push(new gutil.File({
					cwd: baseDir,
					base: baseDir,
					path: filename,
					contents: Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
				}));
				this.push(null);
			};
			return src;
		}

		var pipeFn;
		filePath = path.resolve(path.join(baseDir, filePath));

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
			fs.readFile(filePath, (err, data) => {
				if (err) {
					reject();
				} else {
					resolve(data);
				}
			});
		}).then(data => {

			var contents = data.toString();

			// 如果文件为压缩文件，则不做工作流处理
			if (/\bsourceMappingURL=[^\n]+\.map\b/.test(contents) || lineCount(contents) < 3) {
				pipeFn = false;
			}

			return new Promise((resolve, reject) => {
				var stream = string_src(filePath, data)

				// 错误汇报机制
				.pipe(plumber(ex => {
					reject(ex);
					delete cache.caches[filePath][filePath];
					remember.forget(filePath, filePath);
				}))

				// 仅仅传递变化了的文件
				.pipe(cache(filePath));

				if (pipeFn) {

					// 调用正式的gulp工作流
					stream = pipeFn(stream);

					// 处理文件的sourceMap
					stream = stream.pipe(getFile((content, file) => {
						// 在文件末尾添加一行sourceMap注释
						var sourceMapComment = getSourceMap(file);
						if (sourceMapComment) {
							return content.replace(/\n*$/, sourceMapComment);
						}
					}, "sourceMap"));
				}

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
		});
	}
	return sendFile;
};
