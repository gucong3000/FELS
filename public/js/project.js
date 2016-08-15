"use strict";
const path = require("path");
const reporter = require("./reporter");
const config = require("./config-util");
const app = require("./app");
const wrap = document.querySelector("section");
const {
	remote,
} = require("electron");

const rcPath = {
	"hook": [".git/hooks/pre-commit", ".hg/hgrc"],
	"editorconfig": [".editorconfig"],
	"eslint": [".eslintrc.json"],
	"stylelint": [".stylelintrc"],
};

let initFns = ["hook", "editorconfig", "eslint", "stylelint"].map(initPlan);
let project = {
	init: function(projectPath, data) {
		project.curr = data;
		data.path = projectPath;
		wrap.querySelector("h1").innerHTML = path.normalize(projectPath);
		remote.require("./getreptype")(projectPath)

		.then(type => {
			wrap.classList.remove("hg");
			wrap.classList.remove("git");
			wrap.classList.remove("error");
			wrap.classList.add(type);
		})

		.catch(() => {
			wrap.classList.remove("hg");
			wrap.classList.remove("git");
			wrap.classList.add("error");
		});

		project.getReport();
		initFns.forEach(fn => fn(projectPath, data));
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
		rcProxy.set(e.target.name, getElemVal(e.target));
		rcProxy.save();
	}

	Array.from(plan.querySelectorAll("[name=edit]")).forEach((btn, i) => {
		btn.onclick = function() {
			app.openInEditor(path.join(currPath, rcPath[name][i]));
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
					value = config.get(elem.name);
					if (typeof value === "undefined") {
						return;
					}
					if (elem.type === "radio") {
						elem.checked = elem.value === String(value);
					} else if (elem.type === "checkbox") {
						if (elem.getAttribute("value") == null) {
							elem.checked = !!value;
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
