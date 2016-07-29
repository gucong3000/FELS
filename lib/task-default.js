"use strict";

module.exports = function(cb) {
	const gutil = require("gulp-util");
	const path = require("path");

	// const open = require("open");
	gutil.log("正在为您打开GUI");

	// open("README.md", cb);

	var electron = require("electron-prebuilt");
	var proc = require("child_process");

	// spawn electron
	var child = proc.spawn(electron, [path.resolve(__dirname, "gui")]);
	child.stdout.on("data", (data) => {
		console.log(`stdout: ${data}`);
	});

	child.stderr.on("data", (data) => {
		console.log(`stderr: ${data}`);
	});

	child.on("close", () => {
		cb();
	});
};
