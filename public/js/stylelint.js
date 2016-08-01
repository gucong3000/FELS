"use strict";

const {

	remote,

} = require("electron");

const defaultOpt = remote.require("../stylelint.config");
const fs = require("fs-extra-async");
const path = require("path");

let stylelint;

function tryRequire(path) {
	try {
		return require(path);
	} catch (ex) {
		return {};
	}
}

stylelint = {
	get: function(baseDir, oldCfg) {
		return Promise.all([
			fs.readJsonAsync(path.join(baseDir, "package.json")).then(pkg => pkg.stylelint).catch(() => {}),
			fs.readJsonAsync(path.join(baseDir, ".stylelintrc")).catch(() => {}),
			tryRequire(path.join(baseDir, "stylelint.config.js")),
		]).then(cfg => {
			cfg = cfg.map(cfg => cfg || {});
			cfg = Object.assign.apply(Object, cfg);
			let newCfg = Object.assign(oldCfg || {}, defaultOpt, cfg);
			if (JSON.stringify(cfg) !== JSON.stringify(newCfg)) {
				return stylelint.set(baseDir, newCfg).then(() => newCfg);
			}
			return newCfg;
		});
	},
	set: function(baseDir, cfg) {
		let pkgPath = path.join(baseDir, "package.json");
		let rcPath = path.join(baseDir, ".stylelintrc");

		return fs.readJsonAsync(pkgPath)

		.then(pkg => {
			if (!pkg.stylelint) {
				throw pkg;
			}
			pkg.stylelint = cfg;
			return fs.writeFileAsync(pkgPath, JSON.stringify(pkg, 0, "\t"))

			.then(result => {
				return fs.unlinkAsync(rcPath).then(() => result);
			});
		})

		.catch(() => {
			return fs.writeFileAsync(rcPath, JSON.stringify(cfg, 0, "\t"));
		})

		.then(result => {
			return fs.unlinkAsync(path.join(baseDir, "stylelint.config.js")).then(() => result);
		});

	}
};
module.exports = stylelint;
