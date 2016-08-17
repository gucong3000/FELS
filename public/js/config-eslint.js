"use strict";
const unit = require("./config-util");
const path = require("path");

function fixCfg(cfg) {
	if (!cfg.extends) {
		cfg.extends = ["eslint:recommended"];

	} else if (Array.isArray(cfg.extends)) {
		if (cfg.extends.indexOf("eslint:recommended") < 0) {
			cfg.extends.unshift("eslint:recommended");
		}
	} else if (cfg.extends === "eslint:recommended") {
		cfg.extends = [cfg.extends];
	} else {
		cfg.extends = ["eslint:recommended", cfg.extends];
	}

	cfg.ecmaVersion = 7;
	cfg.sourceType = "module";
	cfg.ecmaFeatures = {
		globalReturn: false,
		impliedStrict: true,
		jsx: true,
	}

	if (!cfg.env) {
		cfg.env = {
			browser: true,
		}
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
	return cfg;
}


let eslint = {
	get: function(baseDir) {
		return Promise.all([
			unit.readRcAsync(path.join(baseDir, "package.json")).then(pkg => pkg.eslintConfig || {}).catch(() => {
				return {};
			}),
			unit.readRcAsync(path.join(baseDir, ".eslintrc.json")),
			unit.readRcAsync(path.join(baseDir, ".eslintrc.js")),
			unit.readRcAsync(path.join(baseDir, ".eslintrc")),
		]).then(cfgs => Object.assign.apply(Object, cfgs))

		.then(fixCfg);
	},
	set: function(baseDir, cfg) {
		let pkgPath = path.join(baseDir, "package.json");
		let rcPath = path.join(baseDir, ".eslintrc.json");
		cfg = fixCfg(cfg);

		return unit.readRcAsync(pkgPath)

		.then(pkg => {
			if (pkg.eslintConfig) {
				pkg.eslintConfig = cfg;
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


module.exports = eslint;
