"use strict";
const reporter = require("./reporter");
const hook = require("./hook");
const stylelint = require("./stylelint");
let wrap = document.querySelector("section");
let planHook = wrap.querySelector("#hook");
let planStylelint = wrap.querySelector("#stylelint");
let project = {
	init: function(projectPath, data) {
		project.curr = data;
		data.path = projectPath;
		wrap.querySelector("h1").innerHTML = projectPath;
		project.getHook();
		project.getReport();
		project.getStylelint();
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
	getStylelint: function() {
		let curr = project.curr;
		return stylelint.get(curr.path, curr.stylelint).then(stylelintRc => {
			curr.stylelint = stylelintRc;

			Array.from(planStylelint.querySelectorAll("fieldset")).forEach(fieldset => {
				let rule = stylelintRc.rules[fieldset.querySelector("legend").textContent.trim()];
				if (!Array.isArray(rule)) {
					rule = [rule, {}];
				}
				let severity = rule[1].severity;
				let value = rule[0];
				let selSeverity = fieldset.querySelector("[name='severity']");
				let selValue = fieldset.querySelector("[name='value']");

				if (value) {
					if (typeof value === "boolean") {
						value = String(value);
					}
					selSeverity.value = severity || selSeverity.querySelector("[selected]").value;
					selValue = value;

				} else {
					selSeverity.value = "null";
					selValue.value = selValue.querySelector("[selected]").value;
				}
			});
			return stylelintRc;
		});
	},
	setStylelint: function() {
		let curr = project.curr;

		let stylelintRc = curr.stylelint || {};

		Array.from(planStylelint.querySelectorAll("fieldset")).forEach(fieldset => {
			let severity = fieldset.querySelector("[name='severity']");
			let value = fieldset.querySelector("[name='value']").selectedOptions[0];
			let message = value.label;


			if (severity.value === "null") {
				severity = severity.querySelector("[selected]").value;
				value = null;
			} else {
				severity = severity.value;
				value = value.value;
				try {
					value = eval(value);
				} catch (ex) {

				}
			}

			stylelintRc.rules[fieldset.querySelector("legend").textContent.trim()] = [value, {
				message,
				severity,
			}];
		});
		return stylelint.set(curr.path, curr.stylelint);
	},
};

planStylelint.onchange = project.setStylelint;
planHook.onchange = project.setHook;
module.exports = project;
