"use strict";

const path = require("path");
const {
	remote,
} = require("electron");
const dialog = remote.dialog;
const unifiedpath = remote.require("./unifiedpath");
const Menu = remote.Menu;

let seleProjects;
let app;

let projectManger = {

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

			dirs = dirs.map(unifiedpath);

			let addedDirs = dirs.filter(dir => projectManger.addProject(dir));

			if (addedDirs.length) {
				projectManger.initList(addedDirs[addedDirs.length - 1]);
				projectManger.save();
			} else {
				projectManger.initList(dirs[dirs.length - 1]);
			}
		});
	},

	/**
	 * 添加项目
	 * @param {String}		projectPath 项目路径
	 * @return {Boolean}	是否添加成功
	 */
	addProject: function(projectPath) {
		if (!projectManger.projects[projectPath]) {
			projectManger.projects[projectPath] = {
				report: {}
			};
			return true;
		} else {
			return false;
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
		seleProjects.size = seleProjects.options.length;
		if (seleProjects.selectedOptions.length) {
			projectManger.initProject();
		}
	},

	/**
	 * 保存项目数据
	 */
	save: function() {
		app.set("projects", projectManger.projects);
		app.save();
	},

	update: function(data) {
		let unifiedProjectPath;
		for (let projectPath in data) {
			unifiedProjectPath = unifiedpath(projectPath);

			if (projectManger.projects[unifiedProjectPath]) {
				for (let key in data[projectPath]) {
					projectManger.projects[unifiedProjectPath][key] = Object.assign(projectManger.projects[unifiedProjectPath][key] || {}, data[projectPath][key]);
				}
			} else {
				projectManger.projects[unifiedProjectPath] = data[projectPath];
			}
		}
		projectManger.initList(unifiedProjectPath);
		projectManger.initProject(unifiedProjectPath);
		projectManger.save();
	},

	/**
	 * 初始化项目列列表
	 * @param  {String} curr 要选中的项目路径
	 */
	initList: function(curr) {
		let newOpts = Object.keys(projectManger.projects).sort().map((projectPath, index) => {
			let option = new Option(projectPath.replace(/^.+?([^\/\\]+)$/, "$1"), projectPath);
			seleProjects.options[index] = option;
			return option;
		});
		seleProjects.options.length = newOpts.length;
		if (curr) {
			seleProjects.value = curr;
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
		}
		projectManger.addProject(projectPath);
		require("./project").initProj(projectPath, projectManger.projects[projectPath]);
	},

	init: function() {
		app = require("./app");
		let projects = app.get("projects");
		projectManger.projects = {};

		if (projects) {
			Object.keys(projects).forEach(projectPath => {
				projectManger.projects[unifiedpath(projectPath)] = projects[projectPath];
			});
		}
		require("./project").init();

		let wrap = document.querySelector("section");
		seleProjects = document.querySelector("aside select");

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

		window.addEventListener("beforeunload", projectManger.save, false);

		projectManger.initList();
		let listTpl = [{
			label: "添加项目",
			click: projectManger.add
		}, {
			label: "删除项目",
			click: projectManger.remove
		}];
		let listMenu = Menu.buildFromTemplate(listTpl);
		document.querySelector("aside").addEventListener("contextmenu", function() {
			listMenu.items[1].enabled = seleProjects.selectedOptions.length > 0;
			listMenu.popup(remote.getCurrentWindow());
		}, false);
	}
};

module.exports = projectManger;
