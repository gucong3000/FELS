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
		var opts = {
			map: false
		};

		var attr;

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
			var map;

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
			var errorOptions = {
				fileName: file.path,
				showStack: true
			};
			if (error.name === "CssSyntaxError") {
				error = error.message + error.showSourceCode();
				errorOptions.showStack = false;
			}

			// Prevent stream’s unhandled exception from
			// being suppressed by Promise
			throw new gutil.PluginError("gulp-postcss", error, errorOptions);
		}

		return postcss(processors)
			.process(file.contents, opts)
			.then(handleResult)
			.catch(handleError);

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
