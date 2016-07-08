"use strict";
var through = require("through2");
var PluginError = require("gulp-util").PluginError;
var txtReport = "";
require("./jshint-msg");

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
 * 检查代码是否压缩版本
 * @param  {Buffer|String} contents 要检查的代码
 * @return {Boolean}       代码是否压缩版
 */
function isMinFile(contents) {
	contents = contents.toString();
	return !contents || /\bsourceMappingURL=[^\n]+\.map\b/.test(contents) || lineCount(contents) < 3;
}

function showError(uri, errors, title) {
	errors = errors.map(error => {
		return `[${ error[1] }:${ error[2] }]\t${ error[0] }`;
	});
	errors.unshift(`============== ${ title } ===============`, `* ${ uri } `, "=====================================");
	errors = errors.join("\r\n");
	console.error(errors);
	if (process.platform === "win32" && process.env.THG_GUI_SPAWN ) {
		txtReport += errors;
	}
}

module.exports = function(options) {
	options = options || {};
	var fails = [];
	return through.obj({
		objectMode: true
	}, function(file, encoding, done) {
		if (file.jshint && !file.jshint.success && !file.jshint.ignored) {
			if (/[\.\-]min\.\w+$/.test(file.path) || isMinFile(file.contents)) {
				file.jshint.ignored = true;
			} else {
				var uri = file.relative.replace(/\\/g, "/");
				var errors = file.jshint.results.map(result => [result.error.reason, result.error.line, result.error.character]);
				showError(uri, errors, "jshint");
				file.fail = true;
				fails.push(uri);
			}
		}
		this.push(file);
		done();
	}, function(done) {
		if (fails.length) {
			var throwErr = () => {
				this.emit("error", new PluginError("gulp-jshint", {
					message: "JSHint failed for: " + fails.join(", "),
					showStack: false
				}));
				done();
			};
			if (txtReport) {
				var filePath = require("path").join(process.env.TEMP, "txtReport.txt");
				console.log(filePath);
				var fs = require("fs-extra-async");
				fs.writeFileAsync(filePath, txtReport).then(() => {
					require("child_process").execSync(filePath);
					fs.removeAsync(filePath).then(throwErr);
				});
			} else {
				throwErr();
			}
		}
	});
};
