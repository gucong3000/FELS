"use strict";
var express = require("express");
var path = require("path");
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

function jsModule(data, path) {
	var isUmd;
	data = data.toString();

	data = data.replace(
		/(\(function\s*\([^()]+\)\s*\{[^{}]*)((?:\s*\bif\s*\(\s*typeof\s+(?:define|module|exports)\s*[!=]==?\s*(['"])\w+\3.*?\)\s*\{[^{}]+(?:,?\s*\bfunction\s*\(\s*\)\s*\{[^\{\}]+\})?[^{}]+\}(?:\s*else\b)?)+(?:\s*\{[^{}]+\})?)(\s*\}[()])/g,
		function(s, pre, content, quotes, end) {
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
				new Function("define", pre + content + "})(define,define)").call(null, define);
			} catch (ex) {

			}
			if (args) {
				path = args.id || path;
				deps = args.deps && args.deps.length ? ("," + JSON.stringify(args.deps)) : "";
				if (args.factory === define) {
					factory = content.match(/[^{}]+\bmodule\.exports\s*=\s*[^{}]+/);
					if (factory) {
						factory = factory[0];
					} else {
						factory = content.match(/\bdefine\(.*?(\w+)\s*\)/);
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
					return `${ pre }
	define("${ path }"${ deps }, ${ factory });
${ end }`;
					isUmd = true;

				}
			}

			return s;
		}
	);

	if (isUmd) {
		return data;
	}
	var codeInfo = jsHint(data, {
		node: true,
		strict: false,
	});

	if (/[\/\/]common\.js$/.test(path)) {
		return data;
	}

	if (Array.isArray(codeInfo.implieds) && codeInfo.implieds.some(obj => {
			return obj.name === "define";
		})) {

		// AMD 规范的 js module.
		data = data.replace(/(\bif\s*\([^\(\)]+?)(\s*&&\s*)\bdefine\.(\w+)(\s*\)\s*\{[^\{\}]*\bdefine\s*\()([^\(\)]*(?:,?\s*\bfunction\s*\(\s*\)\s*\{[^\{\}]+\})?)(\)[^\{\}]*\})/, function(s, s1, and, type, s2, args, s3) {
			// 获取到了define语句
			var modulePath;
			var deps;
			var factoryName;
			var factory;
			var hasIndent = /\n\s+/.test(s);

			args.replace(/\bfunction\s*\(\s*\)\s*\{[^\{\}]+\}/g, function(s) {

				// 获取到了factory函数的代码
				factory = s;
				return "";
			}).replace(/\[.*?\]/g, function(s) {
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
			}).replace(/^[\s\,]+(.+?)\s*/g, function(s, fName) {
				// 获取到了factory函数的函数名
				factoryName = fName;
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

			args = [JSON.stringify(modulePath || path)];
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

function readFile(filePath) {
	return new Promise((resolve, reject) => {
		fs.readFile(path.join("public", filePath), (err, data) => {
			if (err) {
				reject(err);
			} else {
				resolve(data.toString());
			}
		});
	}).then((data) => {
		try {
			data = jsModule(data, filePath);
		} catch (ex) {

		}
		return data;
	});
}

fs.readFile(".jshintrc", (err, data) => {
	// 读取.jshintrc配置文件
	try {
		jshintrc = JSON.parse(data);
	} catch (ex) {
		jshintrc = eval.call(null, "(" + data + ")");
	}
});

app.use((req, res, next) => {
	var combo = req.originalUrl.match(/^(.+?)\?\?+(.+?)$/);
	var promise;
	if (combo) {
		// combo方式文件请求合并
		promise = Promise.all(combo[2].split(/\s*,\s*/).map(subPath => readFile(path.join(combo[1], subPath)))).then(files => files.join("\n"));
	} else if (/\.(?:js|css)$/.test(req.path)) {
		// 普通的js、css操作
		promise = readFile(req.path);
	}
	if (promise) {
		// 将promise的数据传送给res.send()
		promise.then(data => res.send(data)).catch(next);
	} else {
		next();
	}
});

app.use(express.static("public"));

app.listen(3000);