"use strict";
const {
	clipboard,
	ipcRenderer,
	remote,
	shell,
} = require("electron");

const dialog = remote.dialog;
const Menu = remote.Menu;
const url = require("url");
const path = require("path");
const child_process = require("child_process");
const projectmanger = require("./projectmanger");

// 获取当前活动状态的链接的href中的文件路径
function getPath(link) {

	let uri = url.parse((link || document.activeElement).href);

	if (uri.protocol === "file:") {
		return path.normalize(uri.path.replace(/^\/(\w\:)/, "$1"));
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
		app.initweb();
		projectmanger.init();
		ipcRenderer.send("project-ready", true);
	},
	initweb: function() {
		let wrap = document.querySelector("section");
		let linkTpl = [{
			label: "新窗口中打开连接",
			click: function() {
				window.open(document.activeElement.href, document.activeElement.target);
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
			click: function() {
				app.openInEditor();
			}
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
				let menu = getPath(e.target) ? fileMenu : linkMenu;
				menu.popup(remote.getCurrentWindow());
			}
		}, false);

		wrap.addEventListener("click", function(e) {
			if (e.target.tagName === "A" && e.target.href) {
				e.preventDefault();
				let filePath = getPath(e.target);
				if (filePath) {
					app.openInEditor(filePath);
				} else {
					shell.openExternal(e.target.href);
				}
			}
		}, false);

		window.addEventListener("beforeunload", app.save, false);

		let editorCmd = wrap.querySelector("[name=\"editor-cmd\"]");

		editorCmd.value = app.get("editor") || "";

		wrap.querySelector("[name=\"editor-pick\"]").onclick = function() {
			let defaultPath;
			if (/^("|')(.+?)\1/.test(editorCmd.value)) {
				defaultPath = path.dirname(RegExp.$2);
			} else if (/^(\S+)/.test(editorCmd.value)) {
				defaultPath = path.dirname(RegExp.$1);
			} else {
				defaultPath = process.env.ProgramFiles || "/"
			}

			dialog.showOpenDialog(remote.getCurrentWindow(), {
				properties: ["openFile"],
				defaultPath: defaultPath,
				filters: [{
					name: '可执行文件',
					extensions: process.platform === "win32" ? ["exe", "com", "bat", "cmd"] : ["*"]
				}]
			}, path => {
				let cmd;
				if (path && path[0]) {
					path = path[0].replace(/\bsublime_text(\.exe)?$/, "subl$1");

					let type = path.match(/(\w+)(?:\.\w+)?$/);
					if (/\s/.test(path)) {
						cmd = [`"${ path }"`];
					} else {
						cmd = [path];
					}
					if (type && type[1]) {
						type = type[1].toLocaleLowerCase();
						if (type === "subl") {
							cmd.push("--add", "\"%V\"", "\"%1\"");
						} else if (type === "atom") {
							cmd.push("\"%V\"", "\"%1\"");
						} else if (type === "brackets") {
							cmd.push("\"%1\"", "&&", "%0", "\"%V\"");
							// } else if (type === "code") {
							// cmd.push("\"%1\"", "&&", "%0", "\"%V\"");
						}
					}
					cmd = cmd.join(" ");
					editorCmd.value = cmd;
					app.set("editor", cmd);
				}
			});
		};

		editorCmd.onchange = function() {
			app.set("editor", editorCmd.value);
		}
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
	openInEditor: function(filePath) {
		filePath = filePath || getPath();
		if (!filePath) {
			throw new Error("文件路径不能为空");
		}
		let editor = app.get("editor");
		if (editor) {
			if (/%1/.test(editor)) {
				editor = editor
					.replace(/%0/g, s => {
						if (/^(\S+)/.test(editor) || /^(("|').+?\2)/.test(editor)) {
							return RegExp.$1;
						} else {
							return s;
						}
					})
					.replace(/%1/g, filePath)
					.replace(/%V/g, s => document.querySelector("aside select").value || s)
				app.nohup(editor);
			} else {
				app.nohup(`${ editor } "${ filePath }"`);
			}
		} else {
			shell.openItem(filePath);
		}
	},
	nohup: function(cmd) {
		cmd = "nohup" + " " + cmd.replace(/\s*(\&\&|\|\|)\s*/g, " $1 nohup ");
		// cmd += process.platform === "win32" ? ">NUL 1>NUL" : ">/dev/null 2>&1 &";
		try {
			child_process.exec(cmd, {
				timeout: 6000,
			});
		} catch (ex) {
			dialog.showErrorBox("打开外部命令时出错", cmd + "\n" + ex.stack || ex.message || ex);
		}
	}
}

document.addEventListener("DOMContentLoaded", app.init);
module.exports = app;
