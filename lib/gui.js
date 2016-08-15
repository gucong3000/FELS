#!../node_modules/.bin/electron

"use strict";
require("./lib-envpath.js");
const net = require("net");
const PIPE_PATH = process.platform !== "win32" ? "/tmp/FELS.sock" : 8848;
const path = require("path");
const readyMsg = "project-ready";
let electron;
try {
	electron = require("electron");
} catch (ex) {
	console.error("应该在electron环境下运行本程序。");
}

// 结束进程之前要完成的任务
let work = [];

// 保持一个对于 window 对象的全局引用，如果你不这样做，
// 当 JavaScript 对象被垃圾回收， window 会被自动地关闭
let mainWindow;

if (process.platform !== "win32") {
	const fs = require("fs-extra-async");

	fs.unlinkAsync(PIPE_PATH)

	.catch(ex => ex)

	.then(server);
} else {
	server();
}

/**
 * 启动服务端
 * @return {undefined}
 */
function server() {

	let projectReady = new Promise(resolve => electron.ipcMain.on(readyMsg, resolve))

	.then(() => {
		if (process.argv.indexOf("--wait-ready-signal") > 0) {
			console.log(readyMsg);
		}
		return readyMsg;
	});
	let server = net.createServer(function(socket) {
		socket.on("data", function(data) {
			data = data.toString();
			try {
				data = JSON.parse(data);
			} catch (ex) {
				return console.error(data);
			}
			projectReady.then(() => {
				electron.ipcMain.emit(data.event, data.data);
				createWindow();
				mainWindow.setAlwaysOnTop(true);
				mainWindow.setAlwaysOnTop(false);
			});
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
			Promise.all(work).then(() => electron.app.quit());
		} else {
			console.error(e);
		}
	});
}

/**
 * electron的icp上收到的数据绑定到tcp协议上发送出去
 * @return {undefined}
 */
function icpBind() {
	["update", "process"].forEach(event => {
		electron.ipcMain.on(event, function(data) {
			work.push(client({
				event,
				data,
			}));
		});
	});
}

/**
 * 作为客户端发送数据
 * @param  {Object} data 可以被序列化的数据
 * @return {undefined}
 */
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
	});
}

/**
 * 打开GUI窗口
 * @return {undefined}
 */
function createWindow() {
	if (mainWindow) {
		return;
	}

	// 创建浏览器窗口。
	mainWindow = new electron.BrowserWindow();

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

/**
 * 启动GUI
 * @return {undefined}
 */
function initgui() {

	const {
		// 控制应用生命周期的模块。
		app,
		shell,
	} = electron;

	// Electron 会在初始化后并准备
	// 创建浏览器窗口时，调用这个函数。
	// 部分 API 在 ready 事件触发后才能使用。
	app.on("ready", () => {
		let pkg = require("../package.json")
		app.setName(pkg.name.toUpperCase());
		app.setVersion(pkg.version);
		initMenu();
		createWindow();
	});

	// 当全部窗口关闭时退出。
	app.on("window-all-closed", () => {

		// 在 macOS 上，除非用户用 Cmd + Q 确定地退出，
		// 否则绝大部分应用及其菜单栏会保持激活。
		mainWindow = null;
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

	// 为windows创建桌面快捷方式
	if (shell.writeShortcutLink && process.env.HOME) {
		let lnkPath = path.join(process.env.HOME, "Desktop/FELS.lnk");
		shell.writeShortcutLink(lnkPath, {
			target: process.execPath,
			cwd: path.resolve(__dirname, "../"),
			args: __filename,
		});
	}
}

/**
 * 为应用程序创建菜单
 */
function initMenu() {
	const {

		// 控制应用生命周期的模块。
		app,
		Menu,
	} = electron;

	let template = [{
		label: "文件",
		role: "file",
		submenu: [{
			label: "关闭",
			role: "close",
		}]
	}, {
		label: '编辑',
		submenu: [{
			label: '撤销',
			accelerator: 'CmdOrCtrl+Z',
			role: 'undo'
		}, {
			label: '重做',
			accelerator: 'Shift+CmdOrCtrl+Z',
			role: 'redo'
		}, {
			type: 'separator'
		}, {
			label: '剪切',
			accelerator: 'CmdOrCtrl+X',
			role: 'cut'
		}, {
			label: '复制',
			accelerator: 'CmdOrCtrl+C',
			role: 'copy'
		}, {
			label: '粘贴',
			accelerator: 'CmdOrCtrl+V',
			role: 'paste'
		}, {
			label: '全选',
			accelerator: 'CmdOrCtrl+A',
			role: 'selectall'
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
		}, {
			label: "关于",
			role: "about",
		}]
	}];

	if (process.platform === "darwin") {
		let name = app.getName();
		template.unshift({
			label: name,
			submenu: [{
				label: "关于 " + name,
				role: "about"
			}, {
				type: "separator"
			}, {
				label: "服务",
				role: "services",
				submenu: []
			}, {
				type: "separator"
			}, {
				label: "隐藏 " + name,
				accelerator: "Command+H",
				role: "hide"
			}, {
				label: "隐藏其他",
				accelerator: "Command+Alt+H",
				role: "hideothers"
			}, {
				label: "显示全部",
				role: "unhide"
			}, {
				type: "separator"
			}, {
				label: "退出",
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

	let menu = Menu.buildFromTemplate(template);
	Menu.setApplicationMenu(menu);
}
