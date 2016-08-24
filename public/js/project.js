"use strict";
const path = require("path");
const reporter = require("./reporter");
const config = require("./config-util");
const app = require("./app");
const wrap = document.querySelector("section");
const {
	remote,
} = require("electron");
const dialog = remote.dialog;
const unifiedpath = remote.require("./unifiedpath");

const rcPath = {
	"hook": [".git/hooks/pre-commit", ".hg/hgrc"],
	"editorconfig": [".editorconfig"],
	"eslint": [".eslintrc.json"],
	"stylelint": [".stylelintrc.json"],
};

let initFns = ["hook", "editorconfig", "eslint", "stylelint"].map(initPlan);
let projectmanger;
let build;

let project = {
	init: function() {
		projectmanger = require("./projectmanger");
		build = wrap.querySelector("#build");
		build.onchange = function(e) {
			if (e.target.name && e.target.validity.valid) {
				project.curr.build[e.target.name] = e.target.value;
				projectmanger.save();
			}
		}
		Array.from(build.querySelectorAll("[type=\"button\"][value=\"…\"]")).forEach(btn => {
			let textbox = btn.previousElementSibling;

			function save() {
				if (textbox.validity.valid) {
					project.curr.build[textbox.name] = textbox.value;
					projectmanger.save();
				}
			}

			btn.onclick = function() {
				dialog.showOpenDialog(remote.getCurrentWindow(), {
					defaultPath: path.join(project.curr.path, textbox.value),
					properties: ["openDirectory"],
				}, dirs => {
					if (dirs) {
						let relative = unifiedpath(path.relative(project.curr.path, dirs[0]));
						if (relative === ".") {
							relative = "";
						}
						if (relative !== textbox.value) {
							textbox.value = relative;
							save();
						}
					}
				});
			}
		});
	},
	initProj: function(projectPath, data) {
		project.curr = data;
		data.path = projectPath;
		if (!data.name) {
			data.name = projectPath.replace(/^.*?([^\/\\]+)$/, "$1");
		}
		wrap.querySelector("h1").innerHTML = path.normalize(projectPath);
		remote.require("./getreptype")(projectPath)

		.then(type => {
			wrap.className = "";
			wrap.classList.add(type)
		});

		project.getReport();
		project.getBuild();
		initFns.forEach(fn => fn(projectPath, data));
	},

	getBuild: function() {
		build.reset();
		let options = project.curr.build;
		if (!options) {
			options = {};
			project.curr.build = options;
		}
		Array.from(build.elements).forEach(elem => {
			if (elem.name) {
				if (elem.name in options) {
					elem.value = options[elem.name];
				} else {
					options[elem.name] = elem.value;
				}
			}
		});
		projectmanger.save();
	},

	getReport: function() {
		wrap.querySelector("#reporter+div").innerHTML = reporter.toHTML(project.curr.report, project.curr.path) || "无错误";
	},
};

/**
 * 获取表单项的值，checkbox返回是否选中，radio返回选中了的元素的值，其他直接发挥元素值
 * @param  {Element} elem 表单项DOM元素
 * @return {String|Boolean}      保单元素值
 */
function getElemVal(elem) {
	if (!elem.checkValidity()) {
		elem.focus();
		throw elem.validationMessage;
	}
	if (elem.tagName === "SELECT") {
		return elem.value === "null" ? null : elem.value;
	} else if (elem.type === "checkbox") {
		if (elem.getAttribute("value") == null) {
			return elem.checked;
		} else if (/\[\]$/.test(elem.name)) {
			return Array.from(elem.form.querySelectorAll(`[name="${ elem.name }"]:checked`)).map(elem => elem.value);
		} else {
			return elem.checked ? elem.value : null;
		}
	} else if (elem.type === "radio") {
		if (!elem.checked) {
			elem = elem.form.querySelector(`[name="${ elem.name }"]:checked`);
		}
	}
	return elem.value;
}

/**
 * 初始化各个配置模块
 * @param  {String} 	name 模块名
 * @return {Function}   项目初始化函数
 */
function initPlan(name) {

	let plan = wrap.querySelector("#" + name);
	let rcProxy;
	let currPath;

	plan.onchange = function(e) {
		rcProxy.set(e.target.name.replace(/\[\]$/, ""), getElemVal(e.target));
		rcProxy.save();
	}

	Array.from(plan.querySelectorAll("[name=edit]")).forEach((btn, i) => {
		btn.onclick = function() {

			// 此模块拥有查找配置文件位置的函数，则使用这个函数查找配置文件

			if (rcProxy.getPath) {
				rcProxy.getPath(currPath)

				.then(rcPath => {
					// 打开配置文件
					app.openInEditor(path.relative(currPath, rcPath));

				});

			} else {
				// 直接打开配置文件
				app.openInEditor(path.join(currPath, rcPath[name][i]));
			}
		}
	});

	return function(projectPath) {
		currPath = projectPath;
		plan.reset();

		config.proxy(name, projectPath)

		.then(config => {
			rcProxy = config;
			Array.from(plan.elements).forEach(elem => {
				if (elem.name && elem.type !== "button") {
					let value;
					value = config.get(elem.name.replace(/\[\]$/, ""));
					if (typeof value === "undefined") {
						return;
					}
					if (elem.type === "radio") {
						elem.checked = elem.value === String(value);
					} else if (elem.type === "checkbox") {
						if (elem.getAttribute("value") == null) {
							elem.checked = !!value;
						} else if (Array.isArray(value)) {
							elem.checked = value.indexOf(elem.value) >= 0;
						} else {
							elem.checked = elem.value === String(value);
						}
					} else {
						elem.value = value;
					}
				}
			});
		});
	};
}

module.exports = project;
