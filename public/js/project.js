"use strict";
const path = require("path");
const reporter = require("./reporter");
const hook = require("./hook");
const eslint = require("./eslint");
const stylelint = require("./stylelint");
const wrap = document.querySelector("section");
const planHook = wrap.querySelector("#hook");
const planStylelint = wrap.querySelector("#stylelint");
const planEsint = document.querySelector("#eslint");
const {
	shell,
} = require("electron");

let project = {
	init: function(projectPath, data) {
		project.curr = data;
		data.path = projectPath;
		wrap.querySelector("h1").innerHTML = path.normalize(projectPath);
		project.getHook();
		stylelint.init(data).then(project.setStylelint);
		project.getReport();
		project.setEslint(eslint.init(data));
	},
	setEslint: function(cfg) {
		planEsint.querySelector("[name=\"env.es6\"]").checked = cfg.env.es6;
		planEsint.querySelector("[name=\"env.browser\"]").checked = cfg.env.browser;
		planEsint.querySelector("[name=\"env.node\"]").checked = cfg.env.node;
	},
	setStylelint: function(cfg) {
		planStylelint.querySelector("[name=\"defaultSeverity\"]").value = cfg.defaultSeverity;
	},
	getReport: function() {
		wrap.querySelector("#reporter+div").innerHTML = reporter.toHTML(project.curr.report, project.curr.path) || "无错误";
	},
	setHook: function() {
		let hookConfig = project.curr.hook || {};
		Array.from(planHook.querySelectorAll("[type=checkbox]")).forEach(elem => {
			hookConfig[elem.id.replace(/^\w+-/, "")] = elem.checked;
		});
		hookConfig.base = project.curr.path;
		hook.set(hookConfig);
	},
	getHook: function() {
		let curr = project.curr;
		return hook.get(curr.path).then(hookConfig => {
			curr.hook = hookConfig;
			Array.from(planHook.querySelectorAll("[type=checkbox]")).forEach(elem => {
				elem.checked = hookConfig[elem.id.replace(/^\w+-/, "")];
			});
			return hookConfig;
		});
	},

};

planEsint.onchange = function(e) {
	eslint.update(e.target.name, e.target.type === "checkbox" ? e.target.checked : e.target.value);
};

planStylelint.onchange = function(e) {
	stylelint.update(e.target.name, e.target.type === "checkbox" ? e.target.checked : e.target.value);
};

planStylelint.querySelector("[name=edit]").onclick = function() {
	shell.openItem(path.join(project.curr.path, ".stylelintrc"));
};
planEsint.querySelector("[name=edit]").onclick = function() {
	shell.openItem(path.join(project.curr.path, ".eslintrc.json"));
};
planHook.onchange = project.setHook;
module.exports = project;
