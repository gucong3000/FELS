"use strict";

const path = require("path");

if (path.sep === "/") {
	module.exports = path.normalize;
} else {
	module.exports = function() {
		return path.normalize.apply(path, arguments).replace(/\\/g, "/").replace(/^\w\:\//g, s => s.toUpperCase());
	};
}
