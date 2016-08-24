"use strict";
const util = require("./config-util");

function fixCfg(cfg) {
	cfg = cfg || {};
	cfg.rules = cfg.rules || {};
	return cfg;
}

const cosmiconfigOpt = {
	moduleName: "stylelint",
};

module.exports = util.creat(cosmiconfigOpt, fixCfg);
