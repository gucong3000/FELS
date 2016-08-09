"use strict";
const path = require("path");
const reporter = require("./reporter");
const hook = require("./hook");
const eslint = require("./eslint");
const stylelint = require("./stylelint");
const editorconfig = require("./editorconfig");
const wrap = document.querySelector("section");
const planHook = wrap.querySelector("#hook");
const planStylelint = wrap.querySelector("#stylelint");
const planEsint = document.querySelector("#eslint");
const planEditorconfig = document.querySelector("#editorconfig");
const {
	shell,
	remote,
} = require("electron");

let project = {
	init: function(projectPath, data) {
		project.curr = data;
		data.path = projectPath;
		wrap.querySelector("h1").innerHTML = path.normalize(projectPath);
		project.getHook();
		editorconfig.init(data).then(project.setEditorconfig);
		stylelint.init(data).then(project.setStylelint);
		project.getReport();
		project.setEslint(eslint.init(data));
		remote.require("./getreptype")(projectPath)

		.then(type => {
			planHook.classList.remove("hg");
			planHook.classList.remove("git");
			planHook.classList.remove("error");
			planHook.classList.add(type);
		})

		.catch(()=>{
			planHook.classList.remove("hg");
			planHook.classList.remove("git");
			planHook.classList.add("error");
		})
	},
	setEditorconfig: function(cfg) {
		Array.from(planEditorconfig.elements).forEach(elem => {
			if (elem.name && elem.name in cfg) {
				if (elem.type === "checkbox") {
					elem.checked = cfg[elem.name];
				} else if (elem.type === "radio") {
					elem.checked = elem.value === cfg[elem.name];
				} else {
					elem.value = cfg[elem.name];
				}
			}
		})
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
	if (elem.type === "checkbox") {
		return elem.checked;
	} else if (elem.type === "radio" && !!elem.checked) {
		elem = elem.form.querySelector(`[name="${ elem.name }"]:checked`);
	}
	return elem.value;
}

/**
 * 使用默认编辑器打开文件
 * @param  {String} subPath 文件的相对路径
 * @return {undefined}
 */
function openFile(subPath) {
	shell.openItem(path.join(project.curr.path, subPath));
}

planEsint.onchange = function(e) {
	eslint.update(e.target.name, getElemVal(e.target));
};

planStylelint.onchange = function(e) {
	stylelint.update(e.target.name, getElemVal(e.target));
};
planEditorconfig.onchange = function(e) {
	editorconfig.update(e.target.name, getElemVal(e.target));
};

planHook.querySelector(".hg [name=edit]").onclick = function() {
	openFile(".hg/hgrc");
};

planHook.querySelector(".git [name=edit]").onclick = function() {
	openFile(".git/hooks/pre-commit");
};

planEsint.querySelector("[name=edit]").onclick = function() {
	openFile(".eslintrc.json");
};

planStylelint.querySelector("[name=edit]").onclick = function() {
	openFile(".stylelintrc");
};

planEditorconfig.querySelector("[name=edit]").onclick = function() {
	openFile(".editorconfig");
};

planHook.onchange = project.setHook;
module.exports = project;
