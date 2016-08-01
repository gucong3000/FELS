"use strict";

const path = require("path");

let seleProjects = document.querySelector("aside select");
let wrap = document.querySelector("section");

const {

	remote,
	ipcRenderer,

} = require("electron");
const dialog = remote.dialog;

let projectManger = {

	/**
	 * 项目数据
	 */
	projects: (() => {
		try {
			return JSON.parse(localStorage.getItem("fels-projects")) || {};
		} catch (ex) {
			console.log("初始化数据", ex);
		}
		return {};
	})(),

	/**
	 * 添加新项目
	 */
	add: function() {
		dialog.showOpenDialog(remote.getCurrentWindow(), {
			defaultPath: path.resolve(__dirname, "../../.."),
			properties: ["openDirectory", "multiSelections"],
		}, dirs => {
			if (!dirs) {
				return;
			}

			dirs.forEach(projectManger.addProject);

			projectManger.normal();
			projectManger.save();
		});
	},

	/**
	 * 添加项目
	 * @param {String} projectPath 项目路径
	 */
	addProject: function(projectPath, force) {
		projectPath = remote.require("./unifiedpath")(projectPath);
		if (force || !projectManger.projects[projectPath]) {
			seleProjects.appendChild(new Option(projectPath.replace(/^.+?([^\/\\]+)$/, "$1"), projectPath));
			projectManger.projects[projectPath] = projectManger.projects[projectPath] || {};
		}
	},

	/**
	 * 删除选中的项目
	 */
	remove: function() {
		Array.from(seleProjects.selectedOptions).forEach(opt => {
			delete projectManger.projects[opt.value];
			seleProjects.removeChild(opt);
		});
		projectManger.normal();
		projectManger.save();
	},

	/**
	 * 设置项目列表的样式
	 */
	normal: function() {
		if (seleProjects.selectedOptions.length <= 0) {
			seleProjects.selectedIndex = 0;
		}
		if (seleProjects.selectedOptions.length) {
			projectManger.initProject();
		}
		seleProjects.size = seleProjects.options.length;
	},

	/**
	 * 保存项目数据
	 */
	save: function() {
		let keys = Object.keys(projectManger.projects).sort();
		let data = {};
		for (let index = 0; index < keys.length; index++) {
			data[keys[index]] = projectManger.projects[keys[index]];
		}

		localStorage.setItem("fels-projects", JSON.stringify(data));
	},

	update: function(data) {
		let projectPath;
		for (projectPath in data) {
			if (projectManger.projects[projectPath]) {
				for (let key in data[projectPath]) {
					projectManger.projects[projectPath][key] = data[projectPath][key];
				}
			} else {
				projectManger.projects[projectPath] = data[projectPath];
			}
		}
		projectManger.initProject(projectPath);
		projectManger.save();
	},

	/**
	 * 初始化项目列列表
	 */
	initList: function() {
		for (let projectPath in projectManger.projects) {
			projectManger.addProject(projectPath, true);
		}
		projectManger.normal();
	},

	/**
	 * 初始化项目
	 * @param {String} [projectPath] 项目路径，默认seleProjects.value
	 */
	initProject(projectPath) {
		if (!projectPath) {
			projectPath = seleProjects.value;
		} else {
			if (!projectManger.projects[projectPath]) {
				projectManger.addProject(projectPath);
			}
			if (!Array.from(seleProjects.selectedOptions).some(opt => opt.value === projectPath)) {
				seleProjects.value = projectPath;
			}
		}
		require("./project").init(projectPath, projectManger.projects[projectPath]);
	},
};
wrap.querySelector("nav").onclick = e => {
	if (e.target.htmlFor) {
		Array.from(wrap.querySelectorAll("nav label")).forEach(label => {
			if (e.target !== label) {
				label.classList.remove("curr");
			}
		});
		e.target.classList.add("curr");
	}
};
seleProjects.onchange = e => {
	projectManger.initProject(e.target.value);
};

window.onbeforeunload = projectManger.save;

const Menu = remote.Menu;

var template = [{
	label: "添加项目",
	click: projectManger.add
}, {
	label: "删除项目",
	click: projectManger.remove
}];

let listMenu = Menu.buildFromTemplate(template);

document.querySelector("aside").addEventListener("contextmenu", function() {
	let currWin = remote.getCurrentWindow();
	process.nextTick(() => {
		listMenu.popup(currWin);
	});
}, false);

projectManger.initList();

module.exports = projectManger;

ipcRenderer.send("project-ready", true);
