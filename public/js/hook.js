"use strict";

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

		const addhook = remote.require("./task-addhooks");
		if (data.enable) {
			data.base = path;
			return addhook(data);
		} else {
			return addhook(path, "");
		}
	}
};
