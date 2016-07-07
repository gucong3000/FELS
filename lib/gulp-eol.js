"use strict";
var through = require("through2");

/**
 * gulp 插件，用于换行符统一
 * @param  {String}  options.eol 行结尾，默认"\n"
 * @return {Boolean} options.eof 文件结尾是否添加换行符
 */
module.exports = function(options) {
	options = options || {};

	var eol = options.eol || "\n";
	var eof = options.eof;

	if (eof == null) {
		eof = true;
	}

	return through.obj(function(file, encoding, done) {
		if (file.isStream()) {
			this.push(file);
			return done();
		}

		// buffer转字符串
		var contents = file.contents.toString();

		// 换行符统一
		contents = contents.replace(/[\t ]+\r?\n/g, eol);

		// 文件末尾添加换行符
		if (eof && contents[contents.length - 1] !== eol) {
			contents += eol;
		}

		// 字符串转Buffer，回写入文件
		file.contents = new Buffer(contents);

		this.push(file);
		done();
	});
};
