"use strict";
const gulp = require("gulp");

module.exports = function(config) {
	// jshint检查js文件
	const eslint = require("gulp-eslint");
	const uglifyOpt = {

		//保留IE的jscript条件注释
		preserveComments: (o, info) => {
			return /@(cc_on|if|else|end|_jscript(_\w+)?)\s/i.test(info.value);
		}
	};
	return function(globs) {
		return gulp.src(globs, config)

		.pipe(eslint({
			fix: true
		}))

		// js代码压缩
		.pipe(require("gulp-uglify")(uglifyOpt));
	}
};
