"use strict";
var express = require("express");
var app = express();
var fs = require("fs");

var jshintrc;

fs.readFile(".jshintrc", (err, data) => {
	try {
		jshintrc = JSON.parse(data);
	} catch (ex) {
		jshintrc = eval.call(null, "(" + data + ")");
	}
});
app.use(function middleware(req, res, next) {
	if (/\.js$/.test(req.path)) {
		var path = require("path");
		fs.readFile(path.join("public", req.path), (err, data) => {
			if (err) {
				return next();
			}
			data = data.toString();

			/*
						data = require("babel-core").transform(data, {
							"presets": [
								"es2015",
							],
							"plugins": []
						});

						data = data.code;*/

			if (/\bdefine\(/.test(data)) {
				data = data.replace(/(\bif\s*\([^\(\)]+?)(\s*&&\s*)\bdefine\.(\w+)(\s*\)\s*\{[^\{\}]*\bdefine\s*\()([^\(\)]*(?:,?\s*\bfunction\s*\([^\(\)]*\)\s*\{[^\{\}]+\})?)(\)[^\{\}]*\})/, function(s, s1, and, type, s2, args, s3) {
					var modulePath;
					var deps;
					var factoryName;
					var factory;
					var hasIndent = /\n\s+/.test(s);

					args.replace(/\bfunction\s*\([^\(\)]*\)\s*\{[^\{\}]+\}/g, function(s) {
						factory = s;
						return "";
					}).replace(/\[.+?\]/g, function(s) {
						s = JSON.parse(s);
						if (s.length) {
							deps = JSON.stringify(s);
						}
						return "";
					}).replace(/(['"'])(\w+)\1/g, function(s, quotes, moduleName) {
						modulePath = moduleName;
						return "";
					}).replace(/\w+/g, function(s) {
						factoryName = s;
						return "";
					});

					args = [JSON.stringify(modulePath || req.path)];
					if (deps) {
						args.push(deps);
					}
					if (factory && !factoryName) {
						type = "cmd";
						factoryName = deps ? `(function(){var f=${ factory };f.${ type }=1;return f})()` : factory;
					}
					args.push(factoryName);

					args = args.join(hasIndent ? ", " : ",");

					type = (type === "cmd" || !deps) ? "" : `(${ factoryName }.${ type } = 1)`;
					if (!type) {
						and = type;
					}
					return [s1, and, type, s2, args, s3].join("");
				});
			} else {
				var deps = [];
				var deps1 = data.match(/\brequire\(\s*(["'])[^"']+\1\s*\)/g);

				if (deps1) {
					deps1 = deps1.map(s => s.replace(/^.*(["'])(.+?)\1.*$/, "$2"));
					deps = deps.concat(deps1);
				}

				var deps2 = data.match(/\bimport\b[^;]+?\bfrom\s+(["'])[^"']+\1/g);
				if (deps2) {
					deps2 = deps2.map(s => s.match(/(["'])(.+?)\1$/)[2]);
					deps = deps.concat(deps2);
				}

				if (deps.length) {
					deps = JSON.stringify(deps);
				} else {
					deps = "";
				}
				if (/\brequire\(/.test(data) || /\bmodule\.exports\b/.test(data)) {
					data = `(function(f){typeof define==="function"?define("${ req.path }",${ deps },f):f()})(function(require,exports,module){
${ data.trim() }
});`;
				}
			}

			res.send(data);
		});
	} else {
		next();
	}
});
app.use(express.static("public"));

app.listen(3000);