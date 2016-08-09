"use strict";

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
			data = JSON.parse(data.toString());
			projectReady.then(() => {
				electron.ipcMain.emit(data.event, data.data);
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
 * 启动GUI
 * @return {undefined}
 */
function initgui() {

	const {

		// 控制应用生命周期的模块。
		app,

		// 创建原生浏览器窗口的模块。
		BrowserWindow,

		Menu,
	} = electron;

	/**
	 * 打开GUI窗口
	 * @return {undefined}
	 */
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
		var name = app.getName();
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
