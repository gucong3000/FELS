"use strict";
const {
	clipboard,
	ipcRenderer,
	remote,
	shell,
} = require("electron");

const dialog = remote.dialog;
const Menu = remote.Menu;

const path = require("path");
const child_process = require("child_process");

// 获取当前活动状态的链接的href中的文件路径
function getPath() {
	return path.normalize(document.activeElement.getAttribute("href"));
}

function openInEditor() {
	let editor = app.get("editor");
	if (editor) {
		try {
			child_process.execFile(editor, [getPath()]);
		} catch (ex) {
			try {
				child_process.exec([editor, getPath()].map(arg => /\s/.test(arg) ? JSON.stringify(arg) : arg).join(" "))
			} catch (ex) {
				dialog.showErrorBox("打开编辑器时出错", editor + "\n" + ex.stack || ex.message || ex);
			}
		}
	} else {
		shell.openItem(getPath());
	}
}

let app = {
	data: (() => {
		let data;
		try {
			data = JSON.parse(localStorage.getItem("fels-config"));
		} catch (ex) {
			//
		}
		return data || {};
	})(),
	init: function() {
		app.initContextMenu();
		require("./projectmanger").init();
		ipcRenderer.send("project-ready", true);
	},
	initContextMenu: function() {
		let wrap = document.querySelector("section");
		let linkTpl = [{
			label: "新窗口中打开连接",
			click: function() {
				window.open(document.activeElement.href);
			}
		}, {
			label: "在浏览器中打开连接",
			click: function() {
				shell.openExternal(document.activeElement.href);
			}
		}];

		let fileTpl = [{
			label: "复制路径",
			click: function() {
				clipboard.writeText(getPath());
			}
		}, {
			label: "在编辑器中打开",
			click: openInEditor
		}, {
			label: "打开文件所在文件夹",
			click: function() {
				shell.showItemInFolder(getPath());
			}
		}];

		let linkMenu = Menu.buildFromTemplate(linkTpl);
		let fileMenu = Menu.buildFromTemplate(fileTpl);

		document.addEventListener("contextmenu", function(e) {
			e.preventDefault();
		}, false);

		wrap.addEventListener("contextmenu", function(e) {
			if (e.target.tagName === "A" && e.target.href) {
				let menu;
				if (/^\w+\:\/\//.test(e.target.getAttribute("href"))) {
					menu = linkMenu;
				} else {
					menu = fileMenu;
				}
				menu.popup(remote.getCurrentWindow());
			}
		}, false);
		wrap.addEventListener("click", function(e) {
			if (e.target.tagName === "A" && e.target.href) {
				if (/^(\w+)\:\/\//.test(e.target.getAttribute("href"))) {
					if (/https?/i.test(RegExp.$1)) {
						e.preventDefault();
						shell.openExternal(e.target.href);
					}
				} else {
					e.preventDefault();
					openInEditor();
				}
			}
		}, false);

		window.addEventListener("beforeunload", app.save, false);
	},
	get: function(key) {
		return app.data[key];
	},
	set: function(key, value) {
		app.data[key] = value;
		app.save();
	},
	save: function() {
		localStorage.setItem("fels-config", JSON.stringify(app.data));
	},
	setEditor: function(path) {
		app.set("editor", path && path[0]);
	}
}

document.addEventListener("DOMContentLoaded", app.init);
module.exports = app;
