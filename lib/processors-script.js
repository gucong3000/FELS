"use strict";
const sourcemaps = require("gulp-sourcemaps");
const babel = require("gulp-babel");
const uglify = require("gulp-uglify");

const eslint = require("gulp-eslint");
const uglifyOpt = {

	//保留IE的jscript条件注释
	preserveComments: (o, info) => {
		return /@(cc_on|if|else|end|_jscript(_\w+)?)\s/i.test(info.value);
	}
};
module.exports = () => {
	return [
		sourcemaps.init(),
		eslint({
			fix: true
		}),
		babel(),
		uglify(uglifyOpt)
	];
};
