"use strict";

const {

	remote,

} = require("electron");

let hook = {
	get: function(baseDir) {
		const getreptype = remote.require("./getreptype");
		const path = require("path");
		const unit = require("./config-util");
		let hookPath;
		return getreptype(baseDir)

		.then(type => {
			if (type === "git") {
				hookPath = path.join(baseDir, ".git/hooks/pre-commit");
				return unit.readFileAsync(hookPath)
					.then(contents => contents.toString().replace(/^\s*#.+?\n/, ""));
			} else if (type === "hg") {
				let ini = require("ini");

				// 读取hg配置文件
				hookPath = path.join(baseDir, ".hg/hgrc");
				return unit.readFileAsync(hookPath)
					.then(contents => ini.parse(contents.toString()).hooks["precommit.fels"]);
			} else {
				throw baseDir;
			}
		}).then(cmd => {
			cmd = String(cmd).trim();
			return {
				enable: /\s+--gulpfile\b/.test(cmd),
				color: !cmd || /\s+--color\b/.test(cmd),
				gui: !cmd || /\s+--gui\b/.test(cmd),
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
	set: (base, config)=>{
		config.base = base;
		remote.require("./task-addhooks")(config)
	}
};

module.exports = hook;
