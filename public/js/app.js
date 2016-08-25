"use strict";
const {
	clipboard,
	remote,
	shell,
} = require("electron");

const dialog = remote.dialog;
const Menu = remote.Menu;
const url = require("url");
const path = require("path");
const child_process = require("child_process");
const projectmanger = require("./projectmanger");
const server = require("./server");

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
		server.init();
		remote.getCurrentWebContents().emit("app-ready")
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

		function setEditorCmd(cmd) {
			if (cmd) {
				app.set("editor", cmd.length > 1 ? cmd : cmd[0]);
			}
			if (Array.isArray(cmd)) {
				cmd = cmd.map(arg => /\s/.test(arg) ? `"${ arg }"` : arg).join(" ");
			} else if (!cmd) {
				cmd = "";
			}

			if (editorCmd.value !== cmd) {
				editorCmd.value = cmd;
			}
		}

		setEditorCmd(app.get("editor"));

		wrap.querySelector("[name=\"editor-pick\"]").onclick = function() {
			let dir = app.get("editor");

			dir = Array.isArray(dir) ? dir[0] : dir;

			if (dir) {
				dir = path.dirname(dir);
			} else if (process.platform === "win32") {
				dir = process.env.ProgramFiles;
			} else {
				dir = "/usr/bin/"
			}

			dialog.showOpenDialog(remote.getCurrentWindow(), {
				properties: ["openFile"],
				defaultPath: dir,
				filters: [{
					name: "可执行文件",
					extensions: process.platform === "win32" ? ["exe", "com", "bat", "cmd"] : ["*"]
				}]
			}, cmd => {
				if (cmd) {
					cmd[0] = cmd[0]
						.replace(/([\/\\])sublime_text(\.exe)?$/, "$1subl$2")
						.replace(/\\command\\brackets\.bat$/, "\\Brackets.exe");

					let type = cmd[0].match(/(\w+)(?:\.\w+)?$/);
					if (type && type[1]) {
						type = type[1].toLocaleLowerCase();
						if (type === "subl") {
							cmd.push("--add", "%V", "%1");
						} else if (type === "atom" || type === "brackets") {
							cmd.push("%1", "%V");
						}
					}
					setEditorCmd(cmd);
				}
			});
		};

		editorCmd.onchange = function() {
			let args = [];
			editorCmd.value.replace(/(?:('|")(.+?)\1|\S+)/g, (s, $1, val) => {
				args.push(val || s);
			});

			setEditorCmd(args);
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
		if (!filePath) {
			filePath = getPath();
		}

		let editor = app.get("editor");
		if (editor) {
			if (Array.isArray(editor)) {
				let hasFile;

				let args = editor.slice(1).map(arg => {
					let newArg;
					if (arg === "%1") {
						hasFile = true;
						newArg = filePath;
					} else if (arg === "%V") {
						newArg = document.querySelector("aside select").value;
					}
					return newArg ? path.normalize(newArg) : arg
				});

				if (!hasFile) {
					args.push(filePath);
				}
				app.spawn(editor[0], args);
			} else {
				app.spawn(editor, [filePath]);
			}
		} else {
			shell.openItem(filePath);
		}
	},
	spawn: function(command, args) {
		command = app.which(command) || command;
		command = app.readbat(command) || command;
		let child = child_process.spawn(command, args, {
			detached: true,
			stdio: "ignore"
		});
		child.on("error", function(ex) {
			dialog.showErrorBox("打开外部命令时出错", command + " " + args.join(" ") + "\n" + ex.stack || ex.message || ex);
		});
		child.unref();
	},
	which: function(filePath) {
		if (!path.isAbsolute(filePath)) {
			let checkExt = extChecker(filePath);
			let child = child_process.spawnSync(process.platform === "win32" ? "where" : "which", [filePath]);
			if (!child.status && child.stdout.toString().trim().split(/\r?\n/g).some(stdout => {
				if (stdout && checkExt(stdout)) {
					filePath = stdout;
					return true;
				}
			})) {
				return filePath;
			}
		}
	},
	readbat: function(filePath, contents) {
		if (/\.(cmd|bat)$/i.test(filePath)) {
			const fs = require("fs");
			if (!contents) {
				try {
					contents = fs.readFileSync(filePath);
				} catch (ex) {
					//
				}
			}

			contents = contents.toString();

			if (contents && /(?:^|\r\n)\s*(?:start\s+)?(?:("|')(.+?)\1|(\S+))\s+%\*\s*(?:\r\n|$)/ig.test(contents)) {
				let dir = path.dirname(filePath);
				filePath = RegExp.$2 || RegExp.$3;
				if (/%~dp0/g.test(filePath)) {
					filePath = path.normalize(filePath.replace(/%~dp0/g, dir));
				} else {
					filePath = path.join(dir, filePath);
				}

				try {
					fs.accessSync(filePath)
				} catch (ex) {
					return;
				}

				return app.readbat(filePath) || filePath;
			}
		}
	}
}

function extChecker(filePath) {
	if (process.platform === "win32" && !/\.\w+$/.test(filePath)) {
		let regExt = new RegExp("\\.(?:" + process.env.PATHEXT.split(/\s*;\s*/).map(ext => ext.replace(/^\W+/, "")).join("|") + ")$", "i");
		return function(filePath) {
			return regExt.test(filePath);
		}
	} else {
		return function() {
			return true;
		}
	}
}
if (document.readyState === "complete") {
	app.init()
} else {
	window.addEventListener("load", app.init);
}
module.exports = app;
