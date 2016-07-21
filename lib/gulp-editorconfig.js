"use strict";

const through = require("through2");
const editorconfig = require("editorconfig");
const gutil = require("gulp-util");
const eolMap = {
	cr: "\r",
	lf: "\n",
	crlf: "\r\n"
};

const fileHeader = [

	// JPEG/JPG
	[0xFF, 0xD8, 0xFF, 0xFE, 0x00],
	[0xFF, 0xD8, 0xFF, 0xE0, 0x00],

	// TGA
	[0x00, 0x00, 0x02, 0x00, 0x00],
	[0x00, 0x00, 0x10, 0x00, 0x00],

	// PNG
	string2Hex(" PNG\r\n\u001a\n"),

	// GIF 89A
	string2Hex("GIF899a"),
	string2Hex("GIF897a"),
	string2Hex("GIF89a"),

	// BMP
	string2Hex("BM"),

	// TIFF (tif)
	[0x49, 0x49, 0x2A, 0x00],

	// ICO
	[0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x20, 0x20],

	// CUR
	[0x00, 0x00, 0x02, 0x00, 0x01, 0x00, 0x20, 0x20],

	// IFF
	string2Hex("FORM"),

	// ANI
	string2Hex("RIFF"),

	// Adobe Photoshop (psd)
	string2Hex("8BPS"),

	// xls.or.doc
	[0xD0, 0xCF, 0x11, 0xE0],

	// MS Access (mdb)
	string2Hex("Standard J"),

	// Adobe Acrobat (pdf)
	string2Hex("%PDF-1."),

	// ZIP Archive (zip)
	[0x50, 0x4B, 0x03, 0x04],

	// RAR Archive (rar)
	string2Hex("Rar!"),

	// CAD (dwg)
	string2Hex("AC10"),

	// Email [thorough only] (eml)
	string2Hex("Delivery-date:"),

	// Outlook Express (dbx)
	[0xCF, 0xAD, 0x12, 0xFE, 0xC5, 0xFD, 0x74, 0x6F],

	// Outlook (pst)
	string2Hex("!BDN"),

	// MS Word/Excel (xls.or.doc)
	[0xD0, 0xCF, 0x11, 0xE0],

	// WordPerfect (wpd)
	[0xFF, 0x57, 0x50, 0x43],

	// Postscript (eps.or.ps)
	string2Hex("%!PS-Adobe"),

	// Quicken (qdf)
	[0xAC, 0x9E, 0xBD, 0x8F],

	// Windows Password (pwl)
	[0xE3, 0x82, 0x85, 0x96],

	// Wave (wav)
	string2Hex("WAVE"),

	// AVI (avi)
	string2Hex("AVI"),

	// Real Audio (ram)
	[0x2E, 0x72, 0x61, 0xFD],

	// Real Media (rm)
	string2Hex(".RMF"),

	// MPEG (mpg)
	[0x00, 0x00, 0x01, 0xBA],

	// MPEG (mpg)
	[0x00, 0x00, 0x01, 0xB3],

	// Quicktime (mov)
	string2Hex("moov"),

	// Windows Media (asf)
	[0x30, 0x26, 0xB2, 0x75, 0x8E, 0x66, 0xCF, 0x11],

	// MIDI (mid)
	string2Hex("MThd")
];

function string2Hex(string) {
	return Array.prototype.map.call(string, char => char.charCodeAt(0));
}

function compareHeader(buffer, header) {
	for (let i = 0; i < header.length; i++) {
		if (header[i] !== buffer[i]) {
			return false;
		}
	}
	return true;
}

module.exports = function(options) {

	/**
	 * gulp 插件，用于文件格式统一，使用[.editorconfig](http://editorconfig.org/)
	 * @param  {Object}  options 此参数直接传递给[editorconfig](https://www.npmjs.com/package/editorconfig)
	 */
	function fixBuffer(buf, file) {
		for (let key = 0; key < fileHeader.length; key++) {
			if (compareHeader(buf, fileHeader[key])) {
				return Promise.resolve(buf);
			}
		}

		return editorconfig.parse(file.path, options)

		.then(config => {
			file.editorconfig = config;

			// buffer转字符串
			let contents = buf.toString();

			// 替换特殊空格
			let newContents = contents.replace(/\xA0/g, " ");

			// 获取是否添加bom头的配置
			let needBom = /-bom$/i.test(config.charset);

			// 检查源代码中是否有bom头
			let hasBom = newContents.charCodeAt(0) === 0xFEFF;

			if (needBom) {
				if (!hasBom) {

					// 该添加Bom头的，添加
					newContents = "\uFEFF" + newContents;
				}
			} else {
				if (hasBom) {

					// 该删除Bom头的，删除
					newContents = newContents.slice(1);
				}
			}

			// 用来寻找换行的正则
			let reEol = config.trim_trailing_whitespace ? /[\t ]*(\r\n|\r|\n)/g : /(\r\n|\r|\n)/g;

			let eol;
			if (config.end_of_line) {

				// 尝试从配置中获取换行符
				eol = eolMap[config.end_of_line.toLowerCase()];
			}

			// 换行符统一与删除行尾空白字符
			newContents = newContents.replace(reEol, (s, eachEol) => {
				return eol || (eol = eachEol);
			});

			// 若未获取到换行符，则假定换行符为"\n"
			eol = eol || "\n";

			// 文件末尾添加或删除空行
			newContents = newContents.replace(/(?:\r\n|\r|\n)+$/, config.insert_final_newline ? eol : "");

			// 尝试获取代码的缩进尺寸
			let indentSize = newContents.match(/\n( {2,})\S/);
			if (indentSize && indentSize[1]) {

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
		}).catch(error => {
			var errorOptions = {
				fileName: file.path,
				showStack: true
			};

			// Prevent stream’s unhandled exception from
			// being suppressed by Promise
			throw new gutil.PluginError("gulp-editorconfig", error, errorOptions);
		});
	}

	return through.obj(function(file, encoding, cb) {
		var throwErr = err => {
			this.emit("error", err);
		};

		if (!file.isNull()) {
			if (file.isStream()) {
				const BufferStreams = require("bufferstreams");
				file.contents = file.contents.pipe(new BufferStreams((err, buf, done) => {
					fixBuffer(buf, file).then(buf => {
						done(null, buf);
						cb(null, file);
					}).catch(throwErr);
				}));
				return;
			} else if (file.isBuffer()) {
				fixBuffer(file.contents, file).then(buf => {
					file.contents = buf;
					cb(null, file);
				}).catch(throwErr);
				return;
			}
		}
		cb(null, file);
	});
};
