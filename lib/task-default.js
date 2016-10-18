"use strict";

module.exports = function(cb) {
	const gutil = require("gulp-util");
	const path = require("path");

	// const open = require("open");
	gutil.log("正在为您打开GUI");

	// open("README.md", cb);

	var electron = require("electron");
	var proc = require("child_process");

	// spawn electron

	proc.spawn(electron, [path.join(__dirname, "gui.js"), "--wait-ready-signal"], {
		detached: true,
		stdio: "ignore"
	}).unref();

	cb();
};
