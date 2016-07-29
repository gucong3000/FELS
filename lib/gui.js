"use strict";

const net = require("net");
const PIPE_PATH = process.platform !== "win32" ? "/tmp/FELS.sock" : 8848;
const electron = require("electron");
const path = require("path");
const readyMsg = "project-ready";

// 结束进程之前要完成的任务
let work = [];

// 保持一个对于 window 对象的全局引用，如果你不这样做，
// 当 JavaScript 对象被垃圾回收， window 会被自动地关闭
let mainWindow;

if (process.argv.indexOf("precommit") < 0) {
	let projectReady = new Promise(resolve => electron.ipcMain.on(readyMsg, resolve))

	.then(() => {
		if (process.argv.indexOf("--wait-ready-signal") > 0) {
			console.log(readyMsg);
		}
		return readyMsg;
	});
	let server = net.createServer(function(socket) {
		socket.on("data", function(data) {
			data = JSON.parse(data.toString());
			projectReady.then(() => electron.ipcMain.emit(data.event, data.data));
			socket.end();
		});
	});

	server.listen(PIPE_PATH, function() {
		initgui();
	});

	server.on("error", (e) => {
		if (e.code === "EADDRINUSE") {
			icpBind();
			electron.ipcMain.emit("process", {
				pid: process.pid,
				argv: process.argv,
			});
		} else {
			console.error(e);
		}
	});
} else {
	icpBind();
	require("./task-precommit")(error => {
		Promise.all(work).catch((e) => {
			if (e) {
				console.error(e);
			}
		}).then(() => {
			return guiClosePromise;
		}).then(() => {
			process.exit(error ? 1 : 0);
		});
	});
}

function icpBind() {
	["update", "process"].forEach(event => {
		electron.ipcMain.on(event, function(data) {
			work.push(client({
				event,
				data,
			}));
		});
	});
	return work;
}

function client(data) {
	return new Promise((resolve, reject) => {
		let client = net.createConnection(PIPE_PATH, function() {
			client.end(JSON.stringify(data));
		});
		client.on("data", (data) => {
			data = data.toString();

			try {
				eval(data);
			} catch (ex) {
				console.log(data);
			}
		});
		client.on("end", resolve);
		client.on("error", reject);
		client.on("timeout", reject);
	}).catch(() => {
		return startgui().then(() => client(data));
	});
}

let guiReadyPromise;
let guiClosePromise;

function startgui() {
	if (!guiReadyPromise) {
		const childProcess = require("child_process");
		guiReadyPromise = new Promise((resolve, reject) => {
			const ls = childProcess.execFile(process.execPath, [__filename, "--wait-ready-signal"], (error, stdout, stderr) => {
				if (stderr) {
					console.error(stderr);
				}
				if (error) {
					reject(error);
				}
			});
			guiClosePromise = new Promise(resolve => ls.on("close", resolve));
			ls.stdout.on("data", data => {
				if (data.toString().trim() === readyMsg) {
					resolve(readyMsg);
				}
			});
		});
	}
	return guiReadyPromise;
}


function initgui() {

	const {

		// 控制应用生命周期的模块。
		app,

		// 创建原生浏览器窗口的模块。
		BrowserWindow,

		Menu,
	} = electron;

	function createWindow() {

		// 创建浏览器窗口。
		mainWindow = new BrowserWindow();

		// 加载应用的 index.html。

		mainWindow.loadURL(`file://${ path.join(require("./unifiedpath")(__dirname), "../public/index.html") }`);

		// 启用开发工具。
		// mainWindow.webContents.openDevTools();

		// 当 window 被关闭，这个事件会被触发。
		mainWindow.on("closed", () => {

			// 取消引用 window 对象，如果你的应用支持多窗口的话，
			// 通常会把多个 window 对象存放在一个数组里面，
			// 与此同时，你应该删除相应的元素。
			mainWindow = null;
		});
	}

	// Electron 会在初始化后并准备
	// 创建浏览器窗口时，调用这个函数。
	// 部分 API 在 ready 事件触发后才能使用。
	app.on("ready", createWindow);

	// 当全部窗口关闭时退出。
	app.on("window-all-closed", () => {

		// 在 macOS 上，除非用户用 Cmd + Q 确定地退出，
		// 否则绝大部分应用及其菜单栏会保持激活。
		if (process.platform !== "darwin") {
			app.quit();
		}
	});

	app.on("activate", () => {

		// 在 macOS 上，当点击 dock 图标并且该应用没有打开的窗口时，
		// 绝大部分应用会重新创建一个窗口。
		if (mainWindow === null) {
			createWindow();
		}
	});

	electron.ipcMain.on("update", data => {
		mainWindow.webContents.executeJavaScript(`require("./js/projectmanger").update(${ JSON.stringify(data) })`);
	});

	var template = [{
		label: "文件",
		role: "file",
		submenu: [{
			label: "关闭",
			role: "close",
		}]
	}, {
		label: "视图",
		role: "view",
		submenu: [{
			label: "重新加载",
			accelerator: "F5",
			click: function(item, focusedWindow) {
				if (focusedWindow) {
					focusedWindow.reload();
				}
			}
		}, {
			label: "切换全屏",
			accelerator: "F11",
			click: function(item, focusedWindow) {
				if (focusedWindow) {
					focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
				}
			}
		}, {
			label: "打开开发者工具",
			accelerator: "F12",
			click: function(item, focusedWindow) {
				if (focusedWindow) {
					focusedWindow.toggleDevTools();
				}
			}
		}]
	}, {
		label: "帮助",
		role: "help",
		submenu: [{
			label: "访问网站",
			click: function() {
				require("electron").shell.openExternal(require("../package.json").homepage);
			}
		}]
	}];

	if (process.platform === "darwin") {
		var name = require("electron").remote.app.getName();
		template.unshift({
			label: name,
			submenu: [{
				label: "About " + name,
				role: "about"
			}, {
				type: "separator"
			}, {
				label: "Services",
				role: "services",
				submenu: []
			}, {
				type: "separator"
			}, {
				label: "Hide " + name,
				accelerator: "Command+H",
				role: "hide"
			}, {
				label: "Hide Others",
				accelerator: "Command+Alt+H",
				role: "hideothers"
			}, {
				label: "Show All",
				role: "unhide"
			}, {
				type: "separator"
			}, {
				label: "Quit",
				accelerator: "Command+Q",
				click: function() {
					app.quit();
				}
			}]
		});

		// Window menu.
		template[3].submenu.push({
			type: "separator"
		}, {
			label: "Bring All to Front",
			role: "front"
		});
	}

	var menu = Menu.buildFromTemplate(template);
	Menu.setApplicationMenu(menu);

}