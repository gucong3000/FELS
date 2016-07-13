"use strict";

const through = require("through2");
const editorconfig = require("editorconfig");

const eolMap = {
	cr: "\r",
	lf: "\n",
	crlf: "\r\n"
};

/**
 * gulp 插件，用于文件格式统一，使用[.editorconfig](http://editorconfig.org/)
 * @param  {String}  options.eol 行结尾，默认"\n"
 * @return {Boolean} options.eof 文件结尾是否添加换行符
 */
module.exports = function(options) {

	function fixBuffer(buf, file) {

		return editorconfig.parse(file.path, options)

		.then(config => {
			file.editorconfig = config;
			let eol = "\n";

			// buffer转字符串
			let contents = buf.toString();

			// 用来寻找换行的正则
			let reEol = config.trim_trailing_whitespace ? /[\t ]*(\r\n|\r|\n)/g : /(\r\n|\r|\n)/g;

			// 换行符统一
			let newContents = contents.replace(reEol, config.end_of_line ? eolMap[ config.end_of_line.toLowerCase() ] : function(s, eachEol) {
				eol = eachEol;
				return eachEol;
			});

			// 文件末尾添加或删除空行
			if (config.insert_final_newline != null) {
				newContents = newContents.replace(/\n+$/, config.insert_final_newline ? eol : "");
			}

			// 将tab缩进转换为配置所要求的
			if (/^space$/i.test(config.indent_style)) {
				newContents = newContents.replace(/^\t/g, " ".repeat(+config.indent_size));
			}

			config.fixed = contents !== newContents;

			if (config.fixed) {
				return new Buffer(newContents);
			} else {
				return buf;
			}
		});
	}

	return through.obj(function(file, encoding, cb) {
		if (!file.isNull()) {

			if (file.isStream()) {
				const BufferStreams = require("bufferstreams");
				file.contents = file.contents.pipe(new BufferStreams((err, buf, done) => {
					fixBuffer(buf, file).then(buf => {
						done(null, buf);
						cb(null, file);
					});
				}));
				return;
			} else if (file.isBuffer()) {
				fixBuffer(file.contents, file).then(buf => {
					file.contents = buf;
					cb(null, file);
				});
				return;
			}
		}
		cb(null, file);
	});
};
