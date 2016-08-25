"use strict";
const util = require("./config-util");

function fixCfg(cfg) {
	cfg = cfg || {};
	if (!cfg.extends) {
		cfg.extends = ["eslint:recommended"];
	}

	cfg.ecmaVersion = 7;
	cfg.sourceType = "module";
	cfg.ecmaFeatures = {
		globalReturn: false,
		impliedStrict: true,
		jsx: true,
	};

	if (!cfg.env) {
		cfg.env = {
			browser: true,
		};
	} else if (!cfg.env.browser && !cfg.env.node) {
		cfg.env.browser = true;
	}

	if (!("root" in cfg)) {
		cfg.root = true;
	}

	cfg.env.amd = cfg.env.browser || undefined;
	cfg.env.commonjs = cfg.env.browser || undefined;
	cfg.env.worker = cfg.env.browser || undefined;
	cfg.env.es6 = cfg.env.node || cfg.env.es6 || undefined;
	cfg.env["shared-node-browser"] = cfg.env.node && cfg.env.browser || undefined;
	cfg.rules = cfg.rules || {};
	cfg.rules.indent = ["warn", "tab"];
	return cfg;
}

const cosmiconfigOpt = {
	moduleName: "eslint",
	packageProp: "eslintConfig",
};

module.exports = util.create(cosmiconfigOpt, fixCfg);
