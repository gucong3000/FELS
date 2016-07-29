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
	setReport: function(report) {
		project.curr.report = report;
	},
	getReport: function() {
		wrap.querySelector("#reporter+div").innerHTML = reporter.toHTML(project.curr.report, project.curr.path) || "无错误";
	},
	setHook: function() {
		let hookConfig = hook.get(project.curr);
		Array.from(planHook.querySelectorAll("[type=checkbox]")).forEach(elem=>{
			hookConfig[elem.id.replace(/^\w+-/, "")] = elem.checked;
		});
		hook.save(project.curr.path, hookConfig);
	},
	getHook: function() {
		let hookConfig = hook.get(project.curr);
		Array.from(planHook.querySelectorAll("[type=checkbox]")).forEach(elem=>{
			elem.checked = hookConfig[elem.id.replace(/^\w+-/, "")];
		});
	},
};

planHook.onchange = project.setHook;
module.exports = project;
