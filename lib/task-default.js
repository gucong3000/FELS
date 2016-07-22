"use strict";

module.exports = function(cb) {
	const gutil = require("gulp-util");
	const open = require("open");
	gutil.log("正在为您打开帮助文档");
	open("README.md", cb);
};
