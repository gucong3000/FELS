"use strict";
const Koa = require("koa");
const send = require("koa-send");
const concat = require("./koa-concat");
const koa_gulp = require("./koa-gulp");
const fs = require("fs-extra-async");
const path = require("path");
const gulp = require("gulp");
const gutil = require("gulp-util");
let app;
let wraper;
let projectManger;


/**
 * Check if `prefix` satisfies a `path`.
 * Returns the new path.
 *
 * match('/images/', '/lkajsldkjf') => false
 * match('/images', '/images') => /
 * match('/images/', '/images') => false
 * match('/images/', '/images/asdf') => /asdf
 *
 * @param {String} prefix
 * @param {String} path
 * @return {String|Boolean}
 * @api private
 */

function match(prefix, path) {
	// does not match prefix at all
	if (0 != path.indexOf(prefix)) return false;

	var newPath = path.replace(prefix, "") || "/";
	var trailingSlash = "/" == prefix.slice(-1);
	if (trailingSlash) return newPath;

	// `/mount` does not match `/mountlkjalskjdf`
	if ("/" != newPath[0]) return false;
	return decodeURIComponent(newPath);
}

function index(ctx, filePath, option = {}) {
	let dir = path.join(option.root || process.cwd(), filePath || ctx.path);
	return fs.readdirAsync(dir)

	.then(subNames => Promise.all(subNames.map(item => fs.statAsync(path.join(dir, item)).then(stats => item + (stats.isDirectory() ? "/" : "")))))

	.then(subNames => {
		if (/\/$/.test(ctx.path)) {
			let parent = filePath.length > 1 ? `<a href="..">..</a><br>` : "";
			ctx.body = `<h1>${ dir }</h1>${ parent }` + subNames.map(name => `<a href="${ name }">${ name }</a>`).join("<br>");
			ctx.type = "html";
		} else {
			ctx.redirect(ctx.path + "/");
		}
	}).catch(() => undefined);
}

let callgulp = (ctx, filePath, buildConf) => {
	let gulpOpt = {
		allowEmpty: true,
		cwd: buildConf.path,
		base: path.posix.join(buildConf.path, buildConf.src),
		dest: buildConf.dest,
	};
	// 普通的js、css操作
	let styleBuilder = require("../../lib/task-style")(gulpOpt);
	let esBuilder = require("../../lib/task-es")(gulpOpt);
	let globs = path.posix.join(buildConf.src, filePath || ctx.path);
	let extname = path.extname(globs);
	let type;

	let stream;
	if (/\.(?:css|less|scss)$/i.test(extname)) {
		stream = styleBuilder(globs);
		type = "css";
	} else if (/\.(?:jsx?|es\d*|babel)$/i.test(extname)) {
		stream = esBuilder(globs);
		type = "js";
	}
	if (stream) {
		stream = stream.pipe(buildConf.dest ? gulp.dest(buildConf.dest) : gutil.noop());
		ctx.type = type;
		return stream;
	}
};

let server = {
	init: function() {
		app = require("./app");
		projectManger = require("./projectmanger");
		wraper = document.querySelector("#server");
		let options = app.get("server");

		// 初始化页面表单元素与配置
		wraper.reset();

		if (options) {
			Object.keys(options).forEach(name => {
				wraper.querySelector(`[name="${ name }"]`).value = options[name];
			});
		} else {

			// 初始化配置
			options = {};
			Array.from(wraper.elements).forEach(elem => {
				if (elem.name) {
					options[elem.name] = +elem.value || elem.value;
				}
			});
			app.set("server", options);
		}

		// 表单元素发生变化是，保存配置
		wraper.onchange = (e) => {
			server.set(e.target.name, e.target.value);
		}

		// 开始服务
		server.initServer();
	},
	getConfig: function(proj) {
		let pkg;
		try {
			pkg = fs.readJsonSync(path.join(proj.path, "package.json"));
		} catch (ex) {
			pkg = {};
		}

		function normalizePath(strPath) {
			return strPath.replace(/\$\{\s*(.+?)\s*\}/g, function(s, key) {
				try {
					s = new Function("pkg", "return " + key)(pkg) || s;
				} catch (ex) {
					//
				}
				return s;
			});
		}
		let buildConf = {};
		Object.keys(proj.build).map(cfg => {
			buildConf[cfg] = normalizePath(proj.build[cfg]);
		});
		buildConf.path = proj.path;
		buildConf.name = proj.name;
		if (buildConf.server) {
			buildConf.server = buildConf.server.replace(/^\/*/, "/").replace(/\/*$/, "/");
		}
		return buildConf;
	},
	creatServer: function() {
		let app = new Koa();

		// 日志
		app.use(async(ctx, next) => {
			const start = new Date();
			await next();
			const ms = new Date() - start;
			console.log(`${ctx.method} ${ctx.url} - ${ms}ms`);
		});

		// http请求合并
		app.use(concat());

		// 各项目文件读取
		app.use(async(ctx, next) => {
			let prev = ctx.path;

			// 读取各个项目的配置
			let projConfig = Object.keys(projectManger.projects).map(proj => {
				proj = projectManger.projects[proj];

				if (!proj.build.server) {
					return;
				}

				return server.getConfig(proj);
			}).filter(proj => proj);

			// 查找远程地址配置与url相符的项目页
			let proj = projConfig.map(buildConf => {
				let serverRoot = buildConf.server;
				var newPath = match(serverRoot, prev);
				if (newPath) {
					return async() => {
						// 使用gulp读取文件
						await koa_gulp(() => callgulp(ctx, newPath, buildConf))(ctx, async() => {
							if (!ctx.body) {
								let rootDir = path.join(buildConf.path, buildConf.src);
								// 静态文件服务
								await send(ctx, newPath, {
									root: rootDir
								});

								if (ctx.app.env === "development" && !ctx.body) {
									// 文件索引页面
									await index(ctx, newPath, {
										root: rootDir
									});
								}
							}
						});
					};
				}
			}).filter(proj => proj);

			// 尝试各项目配置
			if (proj && proj.length) {
				for (let i = 0; i < proj.length && !ctx.body; i++) {
					await proj[i]();
				}
			}
			await next();

			// 首页，显示对各个项目的索引页面
			if (!ctx.body && ctx.path === "/") {
				ctx.body = projConfig.map(proj => `<a href="${ proj.server }">${ proj.name }</a>`).join("<br>");
			}
		});

		let httpServer = require("http").createServer(app.callback());
		return httpServer;
	},
	get: function(key) {
		// 读取配置
		return app.get("server")[key];
	},
	set: function(key, value) {
		// 保存配置，然后重启服务
		let options = app.get("server");
		options[key] = +value || value;
		app.set("server", options);
		server.initServer();
	},
	showError: function(message, title) {
		// 在GUI错误对话框中弹出消息
		const dialog = require("electron").remote.dialog;
		setTimeout(() => {
			dialog.showErrorBox(title || "监听网络端口时出错", message);
		}, 200);
	},
	initServer: function() {
		//
		let msgWrap = wraper.querySelector("p");
		let serObj = server.server;
		if (serObj) {
			serObj.close();
		}
		let port = server.get("port");
		serObj = server.creatServer();
		if (!serObj) {
			msgWrap.innerHTML = "未启动，请至少为一个项目配置编译服务。";
			return;
		}

		serObj.on("error", function(error) {
			let msg;
			switch (error.code) {
				case "EACCES":
					msg = `权限不足，无法使用${ port }端口`;
					server.showError(msg);
					break;
				case "EADDRINUSE":
					msg = `${ port }端口已被占用`;
					server.showError(msg);
					break;
				default:
					msg = error.message || error;
					server.showError(msg);
					throw error;
			}
			msgWrap.innerHTML = "错误：" + msg;
		});
		serObj.on("listening", function() {
			msgWrap.innerHTML = `服务状态正常 <a href="http://127.0.0.1:${ port }" target="buildserver">在浏览器中打开`;
		});
		server.server = serObj;
		serObj.listen(port);
	}
};


module.exports = server;
