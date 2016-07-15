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

			// buffer转字符串
			let contents = buf.toString();

			// 替换特殊空格
			let newContents = contents.replace(/\xA0/g, " ");

			// 用来寻找换行的正则
			let reEol = config.trim_trailing_whitespace ? /[\t ]*(\r\n|\r|\n)/g : /(\r\n|\r|\n)/g;

			let eol;
			if (config.end_of_line) {

				// 尝试从配置中获取换行符
				eol = eolMap[config.end_of_line.toLowerCase()];
			}

			if (!eol) {

				// 尝试从代码中获取换行符
				eol = newContents.match(/\r\n|\r|\n/);
				eol = eol && eol[0];
			}

			// 若未获取到换行符，则假定换行符为"\n"
			eol = eol || "\n";

			// 换行符统一与删除行尾空白字符
			newContents = newContents.replace(reEol, eol);

			// 文件末尾添加或删除空行
			newContents = newContents.replace(/(?:\r\n|\r|\n)+$/, config.insert_final_newline ? eol : "");

			// 尝试获取代码的缩进尺寸
			let indentSize = newContents.match(/\n( {2,})\S/);
			if (indentSize) {

				// 将代码中出现的第一个缩进的长度，判定为此代码的缩进尺寸
				indentSize = indentSize[1].length;
			} else {

				// 代码中未发现缩进，假定缩进尺寸为4
				indentSize = 4;
			}

			// 空格缩进转tab所用正则
			let reSpaceIndent = new RegExp(" {" + indentSize + "}", "g");

			// 检查配置，是否空格缩进
			let indentWithSpace = /^space$/i.test(config.indent_style);
			let indentSpace;
			if (indentWithSpace) {

				// 根据配置中的indent_size来设定缩进用的字符串，indent_size未配置时，使用代码中原有的
				indentSpace = " ".repeat(+config.indent_size || indentSize);
			}

			// 将缩进转换为配置所要求的
			newContents = newContents.replace(/(^|\r\n|\r|\n)([ \t]+)/g, function(s, eol, indent) {

				let indentEnd;

				// 将缩进中的空格转换为tab
				indent = indent.replace(/ +$/, function(space) {

					// 保留缩进结尾余出的几个空格
					indentEnd = space.replace(reSpaceIndent, "\t");
					return "";
				}).replace(/ +/g, function(space) {

					// 将缩进中，混用的空格替换为tab
					return "\t".repeat(parseInt(space.length / indentSize - 0.1));
				});

				if (indentEnd) {
					indent += indentEnd;
				}

				if (indentWithSpace) {
					indent = indent.replace(/\t/g, indentSpace);
				}

				// 返回原有的换行符和新的缩进
				return eol + indent;
			});

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
