"use strict";
const child_process = require("child_process");
const electron = require("electron-prebuilt");
const readyMsg = "app-ready";
let child = child_process.spawn(electron, [require.resolve("../lib/gui"), "--wait-ready-signal"], {
	detached: true,
	stdio: "pipe",
});

child.stdout.on("data", data => {
	if (data.toString().trim() === readyMsg) {
		child.unref();
		process.exit(0);
	}
});
child.on("error", () => process.exit(1));
