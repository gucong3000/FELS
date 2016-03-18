"use strict";
var express = require("express");
var app = express();
var fs = require("fs");

var jshintrc;

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

var pathMap = {
	"console": "polyfill/console.js",
	"es5": "polyfill/es5-shim.js",
	"JSON": "polyfill/json2.min.js",
	"Promise": "polyfill/es6-promise.js",
};

function readFile(path) {
	if (Array.isArray(path)) {
		return Promise.all(path.map(readFile));
	}
	return new Promise(function(resolve, reject) {
		fs.readFile(pathMap[path] || path.join("public", path), (err, data) => {
			if (err) {
				reject(err);
			} else {
				resolve(data.toString());
			}
		});
	});
}

fs.readFile(".jshintrc", (err, data) => {
	try {
		jshintrc = JSON.parse(data);
	} catch (ex) {
		jshintrc = eval.call(null, "(" + data + ")");
	}
});
app.use(function middleware(req, res, next) {
	if (/__service__/.test(req.path)) {
		console.log(req.originalUrl);
		var combo = req.originalUrl.match(/\?\?+(.+?)\.\w+$/);
		if (combo) {
			combo = combo[1].split(/\s*,\s*/);
			console.log(combo);
			readFile(combo).then((files) => {
				res.send(files.join("\n"));
			});
		} else {
			next();
		}
	} else if (/\.js$/.test(req.path)) {
		console.log(req.path);
		var path = require("path");
		fs.readFile(path.join("public", req.path), (err, data) => {
			if (err) {
				return next();
			}
			data = data.toString();

			var codeInfo = jsHint(data, {
				node: true,
				strict: false,
			});
			fs.writeFile("codeinfo.json", JSON.stringify(codeInfo, 0, 4));

			if (Array.isArray(codeInfo.implieds) && codeInfo.implieds.some(obj => {
					return obj.name === "define";
				})) {

				// AMD 规范的 js module.
				data = data.replace(/(\bif\s*\([^\(\)]+?)(\s*&&\s*)\bdefine\.(\w+)(\s*\)\s*\{[^\{\}]*\bdefine\s*\()([^\(\)]*(?:,?\s*\bfunction\s*\([^\(\)]*\)\s*\{[^\{\}]+\})?)(\)[^\{\}]*\})/, function(s, s1, and, type, s2, args, s3) {
					// 获取到了define语句
					var modulePath;
					var deps;
					var factoryName;
					var factory;
					var hasIndent = /\n\s+/.test(s);

					args.replace(/\bfunction\s*\([^\(\)]*\)\s*\{[^\{\}]+\}/g, function(s) {

						// 获取到了factory函数的代码
						factory = s;
						return "";
					}).replace(/\[.+?\]/g, function(s) {
						// 获取到了模块依赖关系
						s = JSON.parse(s);
						if (s.length) {
							deps = JSON.stringify(s);
						}
						return "";
					}).replace(/(['"'])(\w+)\1/g, function(s, quotes, moduleName) {
						// 获取到了模块名
						modulePath = moduleName;
						return "";
					}).replace(/\w+/g, function(s) {
						// 获取到了factory函数的函数名
						factoryName = s;
						return "";
					});

					if (factory && !factoryName) {
						type = "cmd";
						factoryName = deps ? `(function(){var f=${ factory };f.${ type }=1;return f})()` : factory;
					}

					type = (type === "cmd" || !deps) ? "" : `(${ factoryName }.${ type } = 1)`;

					if (!type) {
						and = type;
					}

					args = [JSON.stringify(modulePath || req.path)];
					if (deps) {
						args.push(deps);
					}
					args.push(factoryName);

					args = args.join(hasIndent ? ", " : ",");

					return [s1, and, type, s2, args, s3].join("");
				});
			} else if ((Array.isArray(codeInfo.globals) && (codeInfo.globals.indexOf("require") || codeInfo.globals.indexOf("module") || codeInfo.globals.indexOf("exports"))) || (Array.isArray(codeInfo.implieds) && codeInfo.implieds.some(obj => {
					return /^(?:require|module|exports)$/.test(obj.name);
				}))) {
				// CommonJS 规范的 js module.
				var deps = [];

				data.replace(/\brequire\(\s*(["'])([^"']+)\1\s*\)/g, function(s, quotes, moduleName) {
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
				data = `(function(f){typeof define==="function"?define("${ req.path }"${ deps },f):f()})(function(require,exports,module){
${ data }
});`;
			}

			res.send(data);
		});
	} else {
		next();
	}
});
app.use(express.static("public"));

app.listen(3000);