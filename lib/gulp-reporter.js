"use strict";
var through = require("through2");
require("./jshint-msg");

function err_log(message) {
	if (process.env.THG_GUI_SPAWN) {
		// TortoiseHg不支持utf8格式的中文,需要转码
		process.stderr.write(require("iconv-lite").encode(message + "\n", "GBK"));
	} else {
		console.error(message);
	}
}

function showError(uri, errors, title) {
	errors = errors.map(error => {
		return `[${ error[1] }:${ error[2] }] ${ error[0] }`;
	});
	errors.unshift(`============== ${ title } ===============`, `* ${ uri } `, "=====================================");
	err_log(errors.join("\n"));
}

module.exports = function(options) {
	options = options || {};
	return through.obj(function(file, encoding, done) {
		if (file.jshint && !file.jshint.success && !file.jshint.ignored && !/[\\/]jquery(?:-\d.*?)?(?:[-\.]min)?.js$/.test(file.path)) {
			var uri = file.relative.replace(/\\/g, "/");
			var errors = file.jshint.results.map(result => [result.error.reason, result.error.line, result.error.character]);
			showError(uri, errors, "jshint");
		}
		this.push(file);
		done();
	});
};
