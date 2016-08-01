"use strict";
const reporter = require("./reporter");
const hook = require("./hook");
let wrap = document.querySelector("section");
let planHook = wrap.querySelector("#hook");
let project = {
	init: function(projectPath, data) {
		project.curr = data;
		data.path = projectPath;
		wrap.querySelector("h1").innerHTML = projectPath;
		project.getHook();
		project.getReport();
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

planHook.onchange = project.setHook;
module.exports = project;
