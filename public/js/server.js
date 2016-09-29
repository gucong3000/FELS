"use strict";
const Koa = require("koa");
const send = require("koa-send");
const concat = require("./koa-concat");
const reporter = require("./reporter");
const koa_gulp = require("./koa-vinyl");
const fs = require("fs-extra-async");
const path = require("path");
const livereload = require("koa-livereload");
const {
	remote,
} = require("electron");
let app;
let wraper;
let projectManger;
let currRev = {};

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

function index(ctx, filePath, option = {}) {
	let dir = path.join(option.root || process.cwd(), filePath || ctx.path);
	return fs.readdirAsync(dir)

	.then(subNames => Promise.all(subNames.map(item => fs.statAsync(path.join(dir, item)).then(stats => item + (stats.isDirectory() ? "/" : "")))))

	.then(subNames => {
		if (/\/$/.test(ctx.path)) {
			let parent = filePath.length > 1 ? `<a href="..">..</a><br>` : `<a href="/">/</a><br>`;
			ctx.body = `<h1>${ dir }</h1>${ parent }` + subNames.map(name => `<a href="${ name }">${ name }</a>`).join("<br>");
			ctx.type = "html";
		} else {
			ctx.redirect(ctx.originalUrl.replace(/(\?|$)/, "/$1"));
		}
	}).catch(() => undefined);
}

function checkout(cwd, rev) {
	// 代码库分支切换功能，eq: http://127.0.0.1:3000/static@default/

	return remote.require("./getreptype")(cwd)

	.then(type => {
		let cmd;

		// 根据代码库类型确定默认分支名与切换命令
		if (type === "hg") {
			cmd = "hg update --clean --rev " + (rev || "default");
		} else if (type === "git") {
			cmd = "git checkout --force " + (rev || "master");
		}

		// 判断是否已经在此分支，决定是否需要执行命令
		if (cmd && currRev[cwd] !== cmd) {
			let exec = require("mz/child_process").exec;

			// 执行命令
			return exec(cmd, {
				cwd
			})

			.then(() => {
				// 记录最后一次执行的情况
				currRev[cwd] = cmd;
			});
		}
	});
}

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
	getConfig: async function(proj) {

		// 获取package.json
		let pkg;
		try {
			pkg = await fs.readJsonAsync(path.join(proj.path, "package.json"));
		} catch (ex) {
			pkg = {};
		}

		// 将字符串中类似`${ pkg.name }`格式的字符串替换为package.json中的数据
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
		// 获取数据
		let buildConf = {};
		Object.keys(proj.build).map(cfg => {
			buildConf[cfg] = normalizePath(proj.build[cfg]);
		});

		// 读取jspm信息
		let jspm = pkg.jspm || pkg.directories;

		if (!jspm) {
			// 尝试根据本地是否有jspm_packages文件夹确定是否jspm项目
			let stats;
			try {
				stats = await fs.statAsync(path.join(proj.path, "jspm_packages"));
			} catch (ex) {
				//
			}
			// 本地有jspm_packages则确实为jspm项目
			jspm = stats && stats.isDirectory();
		}

		if (jspm) {

			// 收集jspm各项配置
			jspm = Object.assign({}, pkg.jspm, pkg.directories);
			if (!jspm.dependencies && !jspm.devDependencies) {
				jspm.dependencies = pkg.dependencies;
				jspm.devDependencies = pkg.devDependencies
			}
			if (!jspm.baseURL) {
				jspm.baseURL = ".";
			}
			if (!jspm.packages) {
				jspm.packages = path.posix.join(jspm.baseURL, "jspm_packages");
			}
			jspm.configFile = pkg.configFile || "config.js";
			buildConf.jspm = jspm;
		}

		buildConf.path = proj.path;

		// 修正buildConf.server的格式，字符串前后加上`/`
		if (buildConf.server) {
			buildConf.server = buildConf.server.replace(/^\/*/, "/").replace(/\/*$/, "/");
		}

		return buildConf;
	},
	runProj: async function(ctx, buildConf) {
		let reMatch = new RegExp(buildConf.server.replace(/^\/*/, "/").replace(/\/*$/, "(?:@(.+?))?/"));
		if (!reMatch.test(ctx.path)) {
			return;
		}

		let ver = RegExp.$1;
		let newPath = RegExp.rightContext.replace(/^\/*/, "/");

		ctx.path = newPath;

		if (ver) {
			// 代码库分支切换功能
			await checkout(buildConf.path, ver);
		}

		// 非压缩文件，执行gulp
		if (!/\Wmin\.\w+$/.test(newPath) && !buildConf.jspm) {

			let error = null;

			// koa-gulp插件
			let callgulp = koa_gulp(buildConf.src, function() {
				let processors;
				if (/\.(?:s?css|less)$/i.test(ctx.path)) {
					processors = require("../../lib/processors-style")(ctx.path);
				} else if (/\.(?:jsx?|es\d*|babel)$/i.test(ctx.path)) {
					processors = require("../../lib/processors-script")(ctx.path);
				} else {
					return;
				}

				// gulp.src函数所需参数
				return {
					allowEmpty: true,
					cwd: buildConf.path,
					base: path.posix.join(buildConf.path, buildConf.src),
					processors,
				};
			});

			// 执行gulp
			await callgulp(ctx).catch(e => {
				if (error) {
					error.push(e);
				} else {
					error = [e];
				}

				console.error(e.stack || e);
			});

			// 向GUI汇报审查报告信息
			if (error || ctx.status !== 404) {
				reporter.update(projectManger.projects[buildConf.path], {
					[path.posix.join(buildConf.src, newPath)]: error
				});
			}

			if (error && ctx.app.env === "development") {
				ctx.status = 500;
				ctx.message = error.map(error => String(error.message || error)).join(" ");
			}
		}
		if (ctx.status === 404) {
			let rootDir = path.posix.join(buildConf.path, buildConf.src);
			// 静态文件服务
			await send(ctx, newPath, {
				root: rootDir,
			});

			if (ctx.app.env === "development" && !ctx.body) {
				// 文件索引页面
				await index(ctx, newPath, {
					root: rootDir
				});
			}
		}
	},
	creatServer: function() {
		let app = new Koa();

		// 日志
		app.use(async(ctx, next) => {
			const start = new Date();
			await next();
			const ms = new Date() - start;
			console.log(`${ ctx.method } ${ decodeURIComponent(ctx.url) } - ${ ms }ms`);
		});

		// 浏览器自动刷新
		if (app.env === "development") {
			app.use(livereload());
		}

		// http请求合并
		app.use(concat());

		// 各项目文件读取
		app.use(async(ctx, next) => {
			let rawPath = ctx.path;

			// 读取各个项目的配置
			let buildInfos = await Promise.all(Object.keys(projectManger.projects).map(proj => {
				proj = projectManger.projects[proj];

				if (!proj.build.server) {
					return;
				} else {
					return server.getConfig(proj);
				}
			}).filter(proj => proj));

			// 尝试各项目配置
			if (buildInfos && buildInfos.length) {
				for (let i = 0; i < buildInfos.length && ctx.status === 404; i++) {
					await server.runProj(ctx, buildInfos[i]);
				}
				ctx.path = rawPath;
			}
			await next();

			// 首页，显示对各个项目的索引页面
			if (ctx.status === 404 && ctx.path === "/") {
				ctx.body = buildInfos.map(buildInfo => `<a href="${ buildInfo.server }">${ buildInfo.server }</a>`).join("<br>");
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
		const dialog = remote.dialog;
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
