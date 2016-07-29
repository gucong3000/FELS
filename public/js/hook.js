"use strict";


const {

	remote,

} = require("electron");

const unifiedpath = remote.require("./unifiedpath");

module.exports = {
	get: function(data) {
		if (!data.hook) {
			data.hook = {
				enable: true,
				color: true,
				gui: true,
			};
		}
		return data.hook;
	},
	save: function(path, data) {
		const {
			remote
		} = require("electron");

		const addhook = remote.require("./lib-addhook");
		if (data.enable) {
			let cmd = [
				unifiedpath(remote.process.execPath),
				unifiedpath(remote.process.mainModule.filename),
				"precommit",
				"--src",
				unifiedpath(path),
				data.color ? "--color" : "--no-color",
				data.gui ? "--gui" : "--no-gui",
			];
			return addhook(path, cmd.join(" "));
		} else {
			return addhook(path, "");
		}

	}
};
