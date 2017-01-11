
const path = require("path");
const fs = require("fs-extra-async");
const chokidar = require("chokidar");
const reporter = require("./reporter");
const config = require("./config-util");
const server = require("./server");
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

const initFns = ["hook", "editorconfig", "eslint", "stylelint"].map(initPlan);
let projectmanger;
let build;
let watcher;

const project = {
	init() {
		projectmanger = require("./projectmanger");
		build = wrap.querySelector("#build");
		build.onchange = function(e) {
			if (e.target.name && e.target.validity.valid) {
				project.curr.build[e.target.name] = e.target.value;
				projectmanger.save();
			}
		};
		Array.from(build.querySelectorAll("[type=\"button\"][value=\"…\"]")).forEach(btn => {
			const textbox = btn.previousElementSibling;

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
			};
		});
	},

	initProj: async(projectPath, data) => {
		project.curr = data;
		data.path = projectPath;
		if (!data.name) {
			data.name = projectPath.replace(/^.*?([^\/\\]+)$/, "$1");
		}
		wrap.querySelector("h1").innerHTML = path.normalize(projectPath);
		remote.require("./getreptype")(projectPath)

		.then(type => {
			wrap.className = "";
			wrap.classList.add(type);
		});

		await project.getReport();
		await project.getBuild();
		project.initWatcher();
		initFns.forEach(fn => fn(projectPath, data));
	},

	initWatcher() {
		if (watcher) {
			watcher.close();
		}

		let srcPath = path.join(project.curr.path, project.curr.build.src);
		watcher = chokidar.watch(srcPath, {
			ignoreInitial: true,
			ignored: /[\/\\](?:node_modules|jspm_packages|bower_components|\.[^\/\\]*)(?:[\/\\]|$)/,
		});

		function refresh(path, exists) {
			if (exists) {
				if (path.indexOf(process.cwd()) === 0) {
					location.reload();
				}else if (server.livereload) {
					server.livereload.refresh(path);
				}
			}else {
				reporter.update(project.curr);
			}
		}

		watcher
			.on("add", path => refresh(path, true))
			.on("change", path => refresh(path, true))
			.on("unlink", path => refresh(path));
	},

	getBuild: async() => {
		build.reset();
		let options = project.curr.build;
		if (!options) {
			options = {};
			project.curr.build = options;
		}
		let pkg;
		try {
			pkg = await fs.readJson(path.join(project.curr.path, "package.json"));
		}catch (ex) {
			//
		}
		Array.from(build.elements).forEach(elem => {
			if (elem.name) {
				if (!pkg) {
					elem.value = elem.value.replace(/\/?\$\{\s*pkg\b.*?\}/g, "");
				}
				if (elem.name in options) {
					elem.value = options[elem.name];
				}else {
					options[elem.name] = elem.value;
				}
			}
		});
		projectmanger.save();
	},

	getReport: async() => {
		await reporter.update(project.curr);
		reporter.toHTML(project.curr);
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
	let value;
	if (elem.tagName === "SELECT") {
		value = elem.value;
	}else if (elem.type === "checkbox") {
		if (elem.getAttribute("value") == null) {
			value = elem.checked;
		}else if (/\[\]$/.test(elem.name)) {
			value = Array.from(elem.form.querySelectorAll(`[name="${elem.name}"]:checked`)).map(elem => elem.value);
		}else {
			value = elem.checked ? elem.value : null;
		}
	}else if (elem.type === "radio") {
		if (!elem.checked) {
			elem = elem.form.querySelector(`[name="${elem.name}"]:checked`);
		}
		value = elem.value;
	}
	if (typeof value === "string") {
		try {
			value = JSON.parse(value);
		}catch (ex) {
			//
		}
	}
	if (Array.isArray(value) && !value.length) {
		return;
	}
	return value;
}

/**
 * 初始化各个配置模块
 * @param  {String} 	name 模块名
 * @return {Function}   项目初始化函数
 */
function initPlan(name) {
	const plan = wrap.querySelector("#" + name);
	let rcProxy;
	let currPath;
	let changed;

	function saveVal(elem) {
		rcProxy.set(elem.name.replace(/\[\]$/, ""), getElemVal(elem));
	}

	plan.onchange = function(e) {
		saveVal(e.target);
		rcProxy.save();
	};

	Array.from(plan.querySelectorAll("[name=edit]")).forEach((btn, i) => {
		btn.onclick = function() {
			// 此模块拥有查找配置文件位置的函数，则使用这个函数查找配置文件

			if (rcProxy.getPath) {
				rcProxy.getPath(currPath)

				.then(rcPath => {
					// 打开配置文件
					app.openInEditor(path.resolve(currPath, rcPath));
				});
			}else {
				// 直接打开配置文件
				app.openInEditor(path.join(currPath, rcPath[name][i]));
			}
		};
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
						saveVal(elem);
						changed = true;
						return;
					}
					if (elem.type === "radio") {
						elem.checked = elem.value === String(value);
					}else if (elem.type === "checkbox") {
						if (elem.getAttribute("value") == null) {
							elem.checked = !!value;
						}else if (Array.isArray(value)) {
							elem.checked = value.indexOf(elem.value) >= 0;
						}else {
							elem.checked = elem.value === String(value);
						}
					}else {
						elem.value = value;
					}
				}
			});
			if (changed) {
				config.save();
			}
		});
	};
}

module.exports = project;
