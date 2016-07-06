"use strict";
var crypto = require("crypto");
var through = require("through2");

var GLOBAL_CACHE;
try {
	GLOBAL_CACHE = require("./.file_cache.json");
} catch (ex) {
	GLOBAL_CACHE = {};
}

module.exports = function(options) {
	options = options || {};

	var cache = options.cache || GLOBAL_CACHE;

	return through.obj(function(file, encoding, done) {
		// null cannot be hashed
		if (file.contents === null) {
			// if element is really a file, something weird happened, but it's safer
			// to assume it was changed (because we cannot said that it wasn't)
			// if it's not a file, we don't care, do we? does anybody transform
			// directories?
			if (file.stat.isFile()) {
				this.push(file);
			}

			return done();
		}

		var contents = file.contents.toString().trim();
		var newHash = crypto.createHash("sha1").update(contents).digest("hex");
		var currentHash = cache[file.path];
		cache[file.path] = newHash;

		if (currentHash !== newHash) {
			this.push(file);
		}

		done();
	});
};

function saveGlobalCache(sync) {
	var fs = require("fs-extra-async");
	var path = require("path");
	return fs["outputJson" + (sync ? "Sync" : "Async")](path.join(__dirname, ".file_cache.json"), GLOBAL_CACHE);
}

module.exports.saveGlobalCache = saveGlobalCache;

process.on("exit", () => {
	saveGlobalCache(true);
});
