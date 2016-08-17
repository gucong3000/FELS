"use strict";
const path = require("path");
const unit = require("./config-util");

function fixCfg(cfg) {
	cfg.defaultSeverity = cfg.defaultSeverity || "warning";
	if (!cfg.extends) {
		cfg.extends = ["stylelint-config-standard"];
	} else if (Array.isArray(cfg.extends)) {
		if (cfg.extends.indexOf("stylelint-config-standard") < 0) {
			cfg.extends.unshift("stylelint-config-standard");
		}
	} else if (cfg.extends !== "stylelint-config-standard") {
		cfg.extends = ["stylelint-config-standard", cfg.extends];
	}

	if (!cfg.defaultSeverity) {
		cfg.defaultSeverity = "warning";
	}
	return cfg;
}
let stylelint = {
	get: function(baseDir) {
		return Promise.all([
			unit.readRcAsync(path.join(baseDir, "package.json")).then(pkg => pkg.stylelint || {}).catch(() => {
				return {};
			}),
			unit.readRcAsync(path.join(baseDir, ".stylelintrc")),
			unit.readRcAsync(path.join(baseDir, "stylelint.config.js")),
		]).then(cfgs => Object.assign.apply(Object, cfgs))

		.then(fixCfg);
	},
	set: function(baseDir, cfg) {
		let pkgPath = path.join(baseDir, "package.json");
		let rcPath = path.join(baseDir, ".stylelintrc");
		cfg = fixCfg(cfg);

		return unit.readRcAsync(pkgPath)

		.then(pkg => {
			if (pkg.stylelint) {
				pkg.stylelint = cfg;
				cfg = pkg;
				return pkgPath;
			} else {
				return rcPath;
			}
		})

		.catch(() => rcPath)

		.then(rcPath => unit.writeRcAsync(rcPath, cfg))
	},
};

module.exports = stylelint;
