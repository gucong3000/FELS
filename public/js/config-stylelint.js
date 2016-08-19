"use strict";
const util = require("./config-util");

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

const cosmiconfigOpt = {
	moduleName: "stylelint",
};

module.exports = util.creat(cosmiconfigOpt, fixCfg);
