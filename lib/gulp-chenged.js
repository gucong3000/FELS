"use strict";
const crypto = require("crypto");
const through = require("through2");

let GLOBAL_CACHE;
try {
	GLOBAL_CACHE = require("./.file_cache.json");
} catch (ex) {
	GLOBAL_CACHE = {};
}

module.exports = function(options) {
	options = options || {};

	let cache = options.cache || GLOBAL_CACHE;
	let tag = options.tag;

	if (tag == null) {
		tag = "";
	} else {
		tag = "#" + tag;
	}

	return through.obj(function(file, encoding, done) {

		function changed(savenew) {
			if (file.isBuffer() && !file.isNull() && file.contents) {
				let newHash = crypto.createHash("sha1").update(file.contents).digest("hex");
				let key = file.path + tag;
				let currentHash = cache[key];
				if (savenew) {
					cache[key] = newHash;
				}
				return currentHash !== newHash;
			}
		};
		if (!file.changed) {
			file.changed = changed;
			changed(true);
			done(null, file);
		}
	});
};

function saveGlobalCache(sync) {
	let fs = require("fs-extra-async");
	let path = require("path");
	return fs["outputJson" + (sync ? "Sync" : "Async")](path.join(__dirname, ".file_cache.json"), GLOBAL_CACHE);
}

module.exports.saveGlobalCache = saveGlobalCache;

process.on("exit", () => {
	saveGlobalCache(true);
});
