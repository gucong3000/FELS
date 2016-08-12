"use strict";

const through = require("through2");
const gutil = require("gulp-util");
const stringify = require("json-stable-stringify");


/**
 * gulp 插件，用于json格式化
 * 强烈建议前置在`gulp-editorconfig.js`使用
 * @param  {Object}  options 此参数直接传递给[json-stable-stringify](https://www.npmjs.com/package/json-stable-stringify)
 * @return {Function}	gulp插件
 */
module.exports = function(options) {

	/**
	 * 之中buffer对象中的代码
	 * @param  {Buffer} buf  包含代码的buffer对象
	 * @param  {Vinyl}  file  文件对象
	 * @return {Promise}  Promise对象
	 */
	function fixBuffer(buf, file) {

		return new Buffer(buf.toString().replace(/\{[\s\S]+\}/, json => {
			try {
				return stringify(JSON.parse(json), options);
			} catch (error) {
				let errorOptions = {
					fileName: file.path,
					showStack: true
				};

				// Prevent stream’s unhandled exception from
				// being suppressed by Promise
				throw new gutil.PluginError("gulp-json-stable", error, errorOptions);
			}
		}));
	}

	return through.obj(function(file, encoding, cb) {
		let throwErr = err => {
			this.emit("error", err);
			cb(null, file);
		};

		if (!file.isNull()) {
			if (file.isStream()) {
				const BufferStreams = require("bufferstreams");
				file.contents = file.contents.pipe(new BufferStreams((err, buf, done) => {
					try {
						done(null, fixBuffer(buf, file));
					} catch (ex) {
						done(ex);
						throwErr(ex);
					}
				}));
				return;
			} else if (file.isBuffer()) {
				try {
					file.contents = fixBuffer(file.contents, file);
				} catch (ex) {
					throwErr(ex);
				}
			}
		}
		cb(null, file);
	});
};
