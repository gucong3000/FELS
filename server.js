"use strict";
var express = require("express");
var path = require("path");
var url = require("url");
var app = express();
var fs = require("fs");
var etag = require("etag");
var jshintrc = {};
var memFs = {};
const staticRoot = "public";

var logger = require("morgan");
var bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");
var compress = require("compression");


app.use(logger("dev"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: true
}));
app.use(cookieParser());
app.use(compress({
	level: 9
}));
app.set("x-powered-by", false);
app.set("etag", "strong");

function jsHint(code, options) {
	var JSHINT = require("jshint").JSHINT;
	try {
		JSHINT(code, Object.assign({}, jshintrc, options));
		return JSHINT.data();
	} catch (ex) {
		return {
			options
		};
	}
}

function jsModule(data, path) {
	if (/[\/\/]common\.js$/.test(path)) {
		return data;
	}

	/**
	 * 将定义amd、umd规范模块的js代码段转为定义cmd模范模块的js代码段，转换成功会将isUmd变量赋值为true
	 * @param  {String} code 要转换的代码段
	 * @param  {[String]} min 是否压缩代码，默认不压缩
	 * @return {String|undefined}      转换成功时返回转换后的代码段，失败则返回undefined
	 */
	function parse2cmd(code, min) {
		var deps;
		var factory;
		var args;

		function define(id, deps, factory) {
			var argsLen = arguments.length;
			// define(factory)
			if (argsLen === 1) {
				factory = id;
				id = undefined;
			} else if (argsLen === 2) {
				factory = deps;

				// define(deps, factory)
				if (Array.isArray(id)) {
					deps = id;
					id = undefined;
				}
				// define(id, factory)
				else {
					deps = undefined;
				}
			}
			args = {
				id, deps, factory
			};
		}

		define.amd = {};

		try {
			/* jshint evil: true */
			new Function("define", code).call(null, define);
		} catch (ex) {

		}
		if (args) {
			path = args.id || path;
			deps = args.deps && args.deps.length ? ("," + JSON.stringify(args.deps)) : "";
			if (args.factory === define) {
				factory = code.match(/[^{}]+\bmodule\.exports\s*=\s*[^{}]+/);
				if (factory) {
					factory = factory[0];
				} else {
					factory = code.match(/\bdefine\(.*?(\w+)\s*\)/);
					if (factory) {
						factory = factory[1];
						factory = `module.exports = ${ factory }(` + (args.deps && args.deps.length ? args.deps.map(s => `require("${ s }")`).join(",") : "") + ");";
					}
				}
				if (factory) {
					factory = `function(require, exports, module){
		${ factory }
	}`;
				}
			} else if (args.factory && !args.factory.name) {
				factory = args.factory.toString();
			}
			// factory = args.factory === define ? factory : args.factory.toString();
			if (factory) {
				isUmd = true;
				factory = `define("${ path }"${ deps }, ${ factory });`;
				if (min) {
					var UglifyJS = require("uglify-js");
					factory = UglifyJS.minify(factory, {
						fromString: true
					}).code;
				}
				return factory;
			}
		}
	}
	var isUmd;

	// 转换标准的amd或umd规范的js
	data = data.replace(
		/(\(function\s*\([^()]+\)\s*\{[^{}]*)((?:\bif\s*\(\s*typeof\s+(?:define|module|exports)\s*[!=]==?\s*(['"])\w+\3.*?\)\s*\{[^{}]+(?:,?\s*\bfunction\s*\(\s*\)\s*\{[^\{\}]+\})?[^{}]+\}(?:\s*\belse\b\s*)?)+(?:\s*\{[^{}]+\})?)(\s*\}[()])/g,
		function(s, pre, content, quotes, end) {
			content = parse2cmd(pre + content + "})(define,define)");
			return content ? `${ pre }
	${ content }
${ end }` : s;
		}
	);

	if (isUmd) {
		return data;
	}

	// 转换动态生成工厂函数的amd规范的js
	data = data.replace(
		/(?:\bif\s*\(\s*typeof\s+(?:define|module|exports)\s*[!=]==?\s*(['"])\w+\1.*?\)\s*\{[^{}]+(?:,?\s*\bfunction\s*\(\s*\)\s*\{[^\{\}]+\})+[^{}]+\}(?:\s*\belse\b\s*)?)+(?:\s*\{[^{}]+\})?/g,
		function(content) {
			return parse2cmd(content) || content;
		}
	);

	if (isUmd) {
		return data;
	}

	// 转换压缩代码中标准的amd或umd规范的js
	data = data.replace(
		/(\(function\([^()]*(\b\w+\b)[^\(\)]*\)\{)([^{}]*\bdefine\.amd\?define\([^\(\)]*\b\2\):\2\b[^{}]*)(\}[\(\)])/g,
		function(s, pre, factory, content, end) {
			content = parse2cmd(pre + content + "})(define,define)");
			if (content, true) {
				s = `${ pre }${ content }${ end }`;
			}
			return s;
		}
	);

	if (isUmd) {
		return data;
	}

	// 转换压缩代码中动态生成工厂函数的amd规范的js
	data = data.replace(
		/\bdefine\.amd&&define\([^\(\)]*\bfunction\([^\(\)]*\)\{[^\{\}]+\}\)/g,
		function(content) {
			return parse2cmd(content, true) || content;
		}
	);

	if (isUmd) {
		return data;
	}

	var codeInfo = jsHint(data, {
		node: true,
		strict: false,
	});

	if (!(Array.isArray(codeInfo.implieds) && codeInfo.implieds.some(obj => {
			return obj.name === "define";
		})) && (Array.isArray(codeInfo.globals) && (codeInfo.globals.indexOf("require") || codeInfo.globals.indexOf("module") || codeInfo.globals.indexOf("exports"))) || (Array.isArray(codeInfo.implieds) && codeInfo.implieds.some(obj => {
			return /^(?:require|module|exports)$/.test(obj.name);
		}))) {
		// CommonJS 规范的 js module.
		var deps = [];

		data.replace(/\/\/[^\r\n]+/g, "").replace(/\/\*.+?\*\//g, "").replace(/\brequire\(\s*(["'])([^"']+)\1\s*\)/g, function(s, quotes, moduleName) {
			// 分析代码中的`require("xxxx")`语句，提取出模块名字
			deps.push(JSON.stringify(moduleName));
			return "";
		}).replace(/\bimport\b[^;]+?\bfrom\s+(["'])([^"']+)\1/g, function(s, quotes, moduleName) {
			// 分析代码中的`import`语句，提取出模块名字
			deps.push(JSON.stringify(moduleName));
			return "";
		});

		if (deps.length) {
			deps = `,[${ deps.join(",") }]`;
		} else {
			deps = "";
		}

		data = data.trim();

		// 对整个js块包裹CMD规范的标准Wrap
		data = `define("${ path }"${ deps },function(require,exports,module){
${ data }
});`;
	}
	return data;
}

var errMsgMap = {
	"EACCES": "权限不足，对此文件的访问被操作系统拒绝",
	"EISDIR": "该路径是目录而不是文件",
	"EMFILE": "当前打开的文件太多，请稍后再试",
	"ENOENT": "没有找到该文件或目录",
};

var errCodeMap = {
	"EACCES": 403,
	"EISDIR": 422,
	"EMFILE": 421,
	"ENOENT": 404,
};

function readFile(filePath) {
	return new Promise((resolve, reject) => {
		var absPath = path.join(staticRoot, filePath);

		function sendErr(err) {
			var newErr = errMsgMap[err.code] ? errMsgMap[err.code] + "\t" + filePath : err.stack;
			newErr = new Error(newErr);
			newErr.status = errCodeMap[err.code] || 400;
			reject(newErr);
		}

		function getMtime(callback) {
			fs.stat(absPath, (err, stats) => {
				if (!err) {
					stats = +stats.mtime;
				}
				callback(err, stats);
			});
		}

		function readIo() {
			// 从磁盘读取文件内容
			fs.readFile(absPath, (err, data) => {
				if (err) {
					// 文件无法读取，走报错流程
					sendErr(err);
				} else {
					// 文件数据转换为字符串
					data = data.toString();

					// 调用js构建流程
					if (/\.js$/.test(filePath)) {
						try {
							data = jsModule(data, filePath);
						} catch (ex) {
							console.error(ex);
						}
					} else if (/\.css$/.test(filePath)) {
						// data = cssModule(data, filePath);
					}

					// 声明文件缓存
					var fileCache = {
						data: data,
						etag: etag(data),
					};

					// 读取本地文件修改时间
					getMtime((err, mtime) => {
						if (err) {
							sendErr(err);
						} else {
							fileCache.mtime = mtime;
							memFs[filePath] = fileCache;
							saveMemFs();
							resolve(data);
						}
					});
				}
			});
		}

		// 优先在内存中寻找文件
		if (memFs[filePath]) {
			// 读取本地文件的最后修改时间
			getMtime((err, mtime) => {
				if (err) {
					// 本地文件不能正常访问，删除缓存中的对应数据，并走报错流程
					delete memFs[filePath];
					sendErr(err);
				} else if (mtime !== memFs[filePath].mtime) {
					// 本地文件的最后修改时间与缓存中不一致，走磁盘读取流程
					readIo();
				} else {
					// 缓存中的数据最后修改时间与磁盘上的一致，发送缓存中的数据
					resolve(memFs[filePath].data);
				}
			});
		} else {
			// 内存中无此文件直接走磁盘读取流程
			readIo();
		}
	});
}

function readJSON(path, callback) {
	fs.readFile(path, (err, data) => {
		// 读取.jshintrc配置文件
		try {
			data = JSON.parse(data);
		} catch (ex) {
			try {
				data = eval.call(null, "(" + data + ")");
			} catch (ex) {

			}
		}
		callback(data || {});
	});
}

var fsTimer;

function saveMemFs() {
	clearTimeout(fsTimer);
	fsTimer = setTimeout(() => {
		fs.writeFile("files.cache", JSON.stringify(memFs), (err) => {
			if (!err) {
				console.log("Memory file cache saved");
			}
		});
	}, 3000);
}

readJSON(".jshintrc", (data) => jshintrc = data);

readJSON("files.cache", (data) => memFs = data);


app.use((req, res, next) => {

	var type = req.path.replace(/^.*?(\.\w+)?$/, "$1") || req.originalUrl.replace(/^.*?(?:(\.\w+)(?:\?.*)?)?$/, "$1");
	if (type) {
		res.type(type);
	}
	var combo = req.originalUrl.match(/^(.+?)\?\?+(.+?)$/);
	var promise;
	if (combo) {
		// combo方式文件请求合并
		combo = combo[2].split(/\s*,\s*/).map(filePath => url.parse(url.resolve(combo[1], filePath)).pathname);
		promise = Promise.all(combo.map(filePath => readFile(filePath)))
			.then(files => files.join("\n")).then((data) => {
				res.set("ETag", etag(combo.map(filePath => memFs[filePath].etag).join()));
				return data;
			});
	} else if (/\.(?:js|css)$/.test(req.path)) {
		// 普通的js、css操作
		promise = readFile(req.path).then((data) => {
			res.set("ETag", memFs[req.path].etag);
			return data;
		});
	} else {
		return next();
	}
	// 将promise的数据传送给res.send()
	promise.then(data => res.send(data)).catch(next);
});

app.use(express.static(staticRoot));

// production error handler
// no stacktraces leaked to user
app.use((err, req, res, next) => {
	if (err) {
		console.error(err);
		var status = err.status || 500;
		res.status(status).type("html").send(`<!DOCTYPE html>
<!-- Ticket #11289, IE bug fix: always pad the error page with enough characters such that it is greater than 512 bytes, even after gzip compression abcdefghijklmnopqrstuvwxyz1234567890aabbccddeeffgghhiijjkkllmmnnooppqqrrssttuuvvwwxxyyzz11223344556677889900abacbcbdcdcededfefegfgfhghgihihjijikjkjlklkmlmlnmnmononpopoqpqprqrqsrsrtstsubcbcdcdedefefgfabcadefbghicjkldmnoepqrfstugvwxhyz1i234j567k890laabmbccnddeoeffpgghqhiirjjksklltmmnunoovppqwqrrxsstytuuzvvw0wxx1yyz2z113223434455666777889890091abc2def3ghi4jkl5mno6pqr7stu8vwx9yz11aab2bcc3dd4ee5ff6gg7hh8ii9j0jk1kl2lmm3nnoo4p5pq6qrr7ss8tt9uuvv0wwx1x2yyzz13aba4cbcb5dcdc6dedfef8egf9gfh0ghg1ihi2hji3jik4jkj5lkl6kml7mln8mnm9ono -->
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>Server Error - ${ status }</title>
</head>
<body>
<pre>
${ err.message }
</pre>
</body>
</html>`);
	} else {
		next();
	}
});


app.listen(3000);