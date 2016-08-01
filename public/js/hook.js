"use strict";

const {

	remote,

} = require("electron");

let hook = {
	get: function(baseDir) {
		const getreptype = remote.require("./getreptype");
		const path = require("path");
		const fs = require("fs-extra-async");
		let hookPath;
		return getreptype(baseDir)

		.then(type => {
			if (type === "git") {
				hookPath = path.join(baseDir, ".git/hooks/pre-commit");
				return fs.readFileAsync(hookPath)
					.then(contents => contents.toString().replace(/^\s*#.+?\n/, ""));
			} else if (type === "hg") {
				let ini = require("ini");

				// 读取hg配置文件
				hookPath = path.join(baseDir, ".hg/hgrc");
				return fs.readFileAsync(hookPath)
					.then(contents => ini.parse(contents.toString()).hooks["precommit.fels"]);
			} else {
				throw baseDir;
			}
		}).then(cmd => {
			cmd = String(cmd).trim();
			return {
				enable: /\s+--gulpfile\s+/.test(cmd),
				color: !cmd || /\s+--color\s+/.test(cmd),
				gui: !cmd || /\s+--gui\s+/.test(cmd),
			};
		}).catch(() => {
			let config = {
				base: baseDir,
				enable: true,
				color: true,
				gui: true,
			};
			return hook.set(config)

			.then(() => config);
		});
	},
	set: remote.require("./task-addhooks")
};

module.exports = hook;
