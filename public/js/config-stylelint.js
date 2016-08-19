"use strict";
const unit = require("./config-util");

function fixCfg(cfg) {
	cfg = cfg || {};
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
		return unit.cosmiconfig("stylelint", {
			configpath: baseDir,
		})

		.then(rc => fixCfg(rc.config));
	},
	set: function(baseDir, cfg) {
		return unit.cosmiconfig("stylelint", {
			configpath: baseDir,
		}).then(rc => rc.write(fixCfg(cfg)));
	},
};

module.exports = stylelint;
