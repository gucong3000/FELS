#!../node_modules/.bin/electron
require("babel-register");
"use strict";
let electron;
try {
	electron = require("electron");
} catch (ex) {
	console.error("应该在electron环境下运行本程序。");
}
require("./lib-envpath");
const pkg = require("../package.json");
const net = require("net");
const fs = require("fs-extra-async");
const PIPE_PATH = process.platform !== "win32" ? "/tmp/FELS.sock" : 8848;
const path = require("path");
const readyMsg = "app-ready";
const appIconImage = path.join(__dirname, "../public/img/icon.png");
const {
	// 控制应用生命周期的模块。
	app,
	dialog,
	shell,
	Menu,
	Tray,
} = electron;

// 结束进程之前要完成的任务
const work = [];

// 保持一个对于 window 对象的全局引用，如果你不这样做，
// 当 JavaScript 对象被垃圾回收， window 会被自动地关闭
let mainWindow;
let webAppReady;
let appIcon;

if (process.platform !== "win32") {
	fs.unlink(PIPE_PATH, server);
} else {
	server();
}

/**
 * 向控制台发送启动成功信号
 */
function sendReadySignal() {
	if (process.argv.indexOf("--wait-ready-signal") >= 0) {
		console.log(readyMsg);
	}
}

/**
 * 启动服务端
 * @return {undefined}
 */
function server() {
	const server = net.createServer(function(socket) {
		let result = [];
		socket.on("data", function(data) {
			result.push(data);
		});
		socket.on("end", function() {
			let data = Buffer.concat(result).toString();
			try {
				data = JSON.parse(data);
			} catch (ex) {
				return;
			}
			electron.ipcMain.emit(data.event, data.data);
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
			Promise.all(work).then(() => {
				sendReadySignal();
				electron.app.quit();
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
		const client = net.createConnection(PIPE_PATH, function() {
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
		if (!mainWindow.isVisible()) {
			mainWindow.show();
		}
		if (!mainWindow.isFocused()) {
			mainWindow.focus();
		}
		return webAppReady;
	}

	// 创建浏览器窗口。
	mainWindow = new electron.BrowserWindow({
		blinkFeatures: "CSSStickyPosition",
		icon: appIconImage,
		show: false,
	});

	webAppReady = new Promise(resolve => {
		mainWindow.webContents.on(readyMsg, () => {
			resolve(mainWindow.webContents);
			process.nextTick(() => mainWindow.show());
		});
	});

	// 加载应用的 index.html。
	mainWindow.loadURL(`file://${require("./unifiedpath")(path.resolve(__dirname, "../public/index.html"))}`);

	// 启用开发工具。
	// mainWindow.webContents.openDevTools();

	// 当 window 被关闭，这个事件会被触发。
	mainWindow.on("closed", () => {
		// 取消引用 window 对象，如果你的应用支持多窗口的话，
		// 通常会把多个 window 对象存放在一个数组里面，
		// 与此同时，你应该删除相应的元素。
		mainWindow = null;
	});

	return webAppReady;
}

/**
 * 启动GUI
 * @return {undefined}
 */
function initgui() {
	// Electron 会在初始化后并准备
	// 创建浏览器窗口时，调用这个函数。
	// 部分 API 在 ready 事件触发后才能使用。
	app.on("ready", () => {
		app.setName(pkg.name.toUpperCase());
		app.setVersion(pkg.version);
		createWindow().then(() => {
			sendReadySignal();
		});
		initMenu();
		shortcutLink();
		electron.ipcMain.on("update", data => {
			createWindow().then(webContents => {
				webContents.executeJavaScript(`require("./js/projectmanger").update(${JSON.stringify(data)})`);
			});
		});
		electron.ipcMain.on("process", () => createWindow());

	});

	// 当全部窗口关闭时退出。
	app.on("window-all-closed", () => {
		// 在 macOS 上，除非用户用 Cmd + Q 确定地退出，
		// 否则绝大部分应用及其菜单栏会保持激活。
		mainWindow = null;
	});

	app.on("activate", () => {
		// 在 macOS 上，当点击 dock 图标并且该应用没有打开的窗口时，
		// 绝大部分应用会重新创建一个窗口。
		createWindow();
	});

	app.on("before-quit", () => {
		if (mainWindow) {
			mainWindow.webContents.executeJavaScript('require("./js/app").save()');
		}
	});

}

function shortcutLink() {
	if (process.argv.indexOf("--shortcut") >= 0) {
		if (process.platform === "win32") {
			// 为windows创建桌面快捷方式
			shortcutLinkwin32();
		} else if (process.platform === "darwin") {
			// 为Mac OS创建桌面快捷方式
			shortcutLinkdarwin();
		} else {
			// 为Linux创建桌面快捷方式
			shortcutLinklinux();
		}
	}
}

function shortcutLinklinux() {
	const entries = `[Desktop Entry]

# The type as listed above
Type=Application

# The version of the desktop entry specification to which this file complies
Version=${app.getVersion()}

# The name of the application
Name=${app.getName()}

# A comment which can/will be used as a tooltip
Comment=${pkg.description}

# The path to the folder in which the executable is run
Path=${path.resolve(__dirname, "../")}

# The executable of the application.
Exec=${process.execPath + " " + __filename}

# The name of the icon that will be used to display this entry
Icon=${appIconImage}

# Describes whether this application needs to be run in a terminal or not
Terminal=false

# Describes the categories in which this entry should be shown
Categories=${pkg.keywords.join(";")}
`;
	["/usr/share/applications", "/usr/local/share/applications"].forEach(dir => {
		fs.accessAsync(dir, fs.W_OK)

		.then(() => fs.outputFile(path.join(dir, app.getName() + ".desktop"), entries));
	});
}

function shortcutLinkdarwin() {
	app.dock.setIcon(appIconImage);
	app.dock.show();
}

function shortcutLinkwin32() {
	const fileName = app.getName() + ".lnk";
	const shortcutOpts = {
		target: process.execPath.replace(/\\[\w\.]+@(electron-prebuilt\\)/, "\\$1"),
		cwd: path.resolve(__dirname, "../"),
		args: __filename,
		icon: path.resolve(__dirname, "../public/favicon.ico"),
		iconIndex: 0,
	};
	[
		[app.getPath("desktop")],
		[path.join(process.env.ALLUSERSPROFILE, "Microsoft/Windows/Start Menu/Programs"), app.getName()],
	].forEach(dir => {
		fs.accessAsync(dir[0], fs.W_OK)

		.then(() => {
			if (dir[1]) {
				const subdir = path.join(dir[0], dir[1]);
				return fs.mkdirsAsync(subdir).then(() => subdir);
			} else {
				return dir[0];
			}
		})

		.then(dir => shell.writeShortcutLink(path.join(dir, fileName), shortcutOpts))

		.catch(e => console.error(e));
	});
}

/**
 * 为应用程序创建菜单
 */
function initMenu() {
	const template = [{
		label: "文件",
		role: "file",
		submenu: [{
			label: "关闭",
			role: "close",
		}],
	}, {
		label: "编辑",
		submenu: [{
			label: "撤销",
			accelerator: "CmdOrCtrl+Z",
			role: "undo",
		}, {
			label: "重做",
			accelerator: "Shift+CmdOrCtrl+Z",
			role: "redo",
		}, {
			type: "separator",
		}, {
			label: "剪切",
			accelerator: "CmdOrCtrl+X",
			role: "cut",
		}, {
			label: "复制",
			accelerator: "CmdOrCtrl+C",
			role: "copy",
		}, {
			label: "粘贴",
			accelerator: "CmdOrCtrl+V",
			role: "paste",
		}, {
			label: "全选",
			accelerator: "CmdOrCtrl+A",
			role: "selectall",
		}],
	}, {
		label: "视图",
		role: "view",
		submenu: [{
			label: "重新加载",
			accelerator: "F5",
			click(item, focusedWindow) {
				if (focusedWindow) {
					focusedWindow.reload();
				}
			},
		}, {
			label: "切换全屏",
			accelerator: "F11",
			click(item, focusedWindow) {
				if (focusedWindow) {
					focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
				}
			},
		}, {
			label: "打开开发者工具",
			accelerator: "F12",
			click(item, focusedWindow) {
				if (focusedWindow) {
					focusedWindow.toggleDevTools();
				}
			},
		}],
	}, {
		label: "帮助",
		role: "help",
		submenu: [{
			label: "访问网站",
			click() {
				require("electron").shell.openExternal(pkg.homepage);
			},
		}, {
			label: "关于",
			role: "about",
		}],
	}];

	const name = app.getName();
	if (process.platform === "darwin") {
		template.unshift({
			label: name,
			submenu: [{
				label: "关于 " + name,
				role: "about",
			}, {
				type: "separator",
			}, {
				label: "服务",
				role: "services",
				submenu: [],
			}, {
				type: "separator",
			}, {
				label: "隐藏 " + name,
				accelerator: "Command+H",
				role: "hide",
			}, {
				label: "隐藏其他",
				accelerator: "Command+Alt+H",
				role: "hideothers",
			}, {
				label: "显示全部",
				role: "unhide",
			}, {
				type: "separator",
			}, {
				label: "退出",
				accelerator: "Command+Q",
				click() {
					app.quit();
				},
			}],
		});

		// Window menu.
		template[3].submenu.push({
			type: "separator",
		}, {
			label: "Bring All to Front",
			role: "front",
		});
	}

	const menu = Menu.buildFromTemplate(template);
	Menu.setApplicationMenu(menu);

	appIcon = new Tray(appIconImage);
	const contextMenu = Menu.buildFromTemplate([{
		label: "显示窗口",
		click: createWindow,
	}, {
		label: "退出",
		click() {
			dialog.showMessageBox({
				type: "question",
				title: "确定退出？",
				buttons: ["退出", "取消"],
				defaultId: 1,
				cancelId: 1,
				message: `是否确定要退出 ${ name }？\n退出后您可能不能及时收到错误报告。`,
				noLink: true,
			}, response => {
				if (response === 0) {
					app.quit();
				}
			});
		},
	}]);
	appIcon.on("double-click", createWindow);
	appIcon.setToolTip(name);
	appIcon.setContextMenu(contextMenu);
}
