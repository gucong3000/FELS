"use strict";

const path = require("path");
const {
	clipboard,
	ipcRenderer,
	remote,
	shell,
} = require("electron");
const dialog = remote.dialog;
const unifiedpath = remote.require("./unifiedpath");

let seleProjects = document.querySelector("aside select");
let wrap = document.querySelector("section");
let projectManger = {

	/**
	 * 项目数据
	 */
	projects: (() => {
		let data;
		try {
			data = JSON.parse(localStorage.getItem("fels-projects"));
		} catch (ex) {

		}
		if (!data) {
			data = {};
			console.log("初始化数据");
			return data;
		} else {
			let newData = {};
			Object.keys(data).forEach(projectPath => {
				newData[unifiedpath(projectPath)] = data[projectPath];
			});
			return newData;
		}
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
	 * @param {String} projectPath 项目路径
	 */
	addProject: function(projectPath, data) {
		if (!projectManger.projects[projectPath]) {
			projectManger.projects[projectPath] = data || {};
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
		localStorage.setItem("fels-projects", JSON.stringify(projectManger.projects));
	},

	update: function(data) {
		let unifiedProjectPath;
		for (let projectPath in data) {
			unifiedProjectPath = unifiedpath(projectPath);

			if (projectManger.projects[unifiedProjectPath]) {
				for (let key in data[projectPath]) {
					projectManger.projects[unifiedProjectPath][key] = data[projectPath][key];
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

let listTpl = [{
	label: "添加项目",
	click: projectManger.add
}, {
	label: "删除项目",
	click: projectManger.remove
}];

let linkTpl = [{
	label: "复制路径",
	click: function() {
		clipboard.writeText(path.normalize(document.activeElement.getAttribute("href")));
	}
}, {
	label: "在浏览器中打开连接",
	click: function() {
		shell.openExternal(document.activeElement.href);
	}
}, {
	label: "以默认打开方式打开文件",
	click: function() {
		shell.openItem(path.normalize(document.activeElement.getAttribute("href")));
	}
}, {
	label: "打开文件所在文件夹",
	click: function() {
		shell.showItemInFolder(path.normalize(document.activeElement.getAttribute("href")));
	}
}];

let listMenu = Menu.buildFromTemplate(listTpl);
let linkMenu = Menu.buildFromTemplate(linkTpl);

document.addEventListener("contextmenu", function(e) {
	e.preventDefault();
}, false);

document.querySelector("aside").addEventListener("contextmenu", function() {
	listMenu.items[1].enabled = seleProjects.selectedOptions.length > 0;
	listMenu.popup(remote.getCurrentWindow());
}, false);

wrap.addEventListener("contextmenu", function(e) {
	if (e.target.tagName === "A" && e.target.href) {

		/*		let isUrl = /^https?:\/\//i.test(e.target.href);
				listMenu.items[0].enabled = isUrl;
				listMenu.items[1].enabled = isUrl;
				listMenu.items[2].enabled = !isUrl;
				listMenu.items[3].enabled = !isUrl;
		*/
		linkMenu.popup(remote.getCurrentWindow());
	}
}, false);

projectManger.initList();

module.exports = projectManger;

ipcRenderer.send("project-ready", true);
