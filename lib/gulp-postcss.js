"use strict";

const through = require("through2");
const postcss = require("postcss");
const gutil = require("gulp-util");
const path = require("path");

module.exports = function(processors, options) {

	if (!Array.isArray(processors)) {
		throw new gutil.PluginError("gulp-postcss", "Please provide array of postcss processors!");
	}

	function fixBuffer(buf, file) {

		// Source map is disabled by default
		let opts = {
			map: false
		};

		let attr;

		// Extend default options
		if (options) {
			for (attr in options) {
				if (options.hasOwnProperty(attr)) {
					opts[attr] = options[attr];
				}
			}
		}
		opts.from = file.path;
		opts.to = opts.to || file.path;

		if (typeof opts.to === "function") {
			opts.to = opts.to(file);
		}

		// Generate separate source map for gulp-sourcemap
		if (file.sourceMap) {
			opts.map = opts.map || {
				annotation: false
			};
		}

		function handleResult(result) {
			let map;

			// Apply source map to the chain
			if (file.sourceMap) {
				map = result.map.toJSON();
				map.file = file.relative;
				map.sources = [].map.call(map.sources, function(source) {
					return path.join(path.dirname(file.relative), source);
				});
				const applySourceMap = require("vinyl-sourcemaps-apply");
				applySourceMap(file, map);
			}

			file.postcss = result;

			return new Buffer(result.css);
		}

		function handleError(error) {
			let errorOptions = {
				fileName: file.path,
				lineNumber: error.line,
				columnNumber: error.column,
				showStack: true
			};

			let newError = new gutil.PluginError("gulp-postcss", error.message || error, errorOptions);

			newError.file = file;

			if (error.line) {
				newError.line = error.line;
			}

			if (error.column) {
				newError.column = error.column;
			}

			if (error.showSourceCode) {
				newError.source = error.showSourceCode();
			}

			throw newError;
		}

		return postcss(processors)
			.process(file.contents, opts)
			.then(handleResult)
			.catch(handleError);

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
