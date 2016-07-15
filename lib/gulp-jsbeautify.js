"use strict";

const through = require("through2");
const beautify = require("js-beautify").js_beautify;


const RcLoader = require("rcloader");
const path = require("path");

var rcLoader = new RcLoader(".jsbeautifyrc", {
	defaultFile: path.join(process.cwd(), ".jsbeautifyrc")
});

function loadConfig(filePath, userConfig) {
	return new Promise((resolve) => {
		rcLoader.for(filePath, (err, jsbeautifyrc) => {
			resolve(Object.assign({}, jsbeautifyrc || require("js-beautify/js/config/defaults.json"), userConfig || {}));
		});
	});
}

/**
 * gulp 插件，用于json格式化,js格式化功能暂未完成，使用[js-beautify](https://www.npmjs.com/package/js-beautify)
 * 强烈建议前置在`gulp-editorconfig.js`使用
 * @param  {Object}  options 此参数直接传递给[js-beautify](https://www.npmjs.com/package/js-beautify)
 */
module.exports = function(options) {


	function fixBuffer(buf, file) {

		return loadConfig(file.path, options)

		.then(jsbeautifyrc => {
			file.jsbeautify = jsbeautifyrc;
			let code = buf.toString();
			let newCode = beautify(code, jsbeautifyrc);
			file.jsbeautify.fixed = code !== newCode;

			if (file.jsbeautify.fixed) {
				return new Buffer(newCode);
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
