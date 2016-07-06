"use strict";
var through = require("through2");

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

		var contents = file.contents.toString();

		contents = contents.replace(/[\t ]+\r?\n/g, eol);

		if (eof && contents[contents.length - 1] !== eol) {
			contents += eol;
		}


		file.contents = new Buffer(contents);

		this.push(file);
		done();
	});
};
