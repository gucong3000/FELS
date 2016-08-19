"use strict";
const express = require("express");
const fs = require("fs-extra-async");
const path = require("path");
const gulp = require("gulp");
const gutil = require("gulp-util");
const through = require("through2");
const concat = require("gulp-concat");
const mime_types = require("mime-types");
let app;
let wraper;
let projectManger;

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
		return buildConf;
	},
	creatServer: function() {
		let app = express();

		app.set("x-powered-by", false);
		app.set("etag", "strong");

		app.use(require("./express-concat")());

		// 读取各个项目的配置
		let projs = Object.keys(projectManger.projects).map(proj => {
			proj = projectManger.projects[proj];

			if (!proj.build.server) {
				return;
			}

			let buildConf = server.getConfig(proj);
			let gulpOpt = {
				allowEmpty: true,
				cwd: buildConf.path,
				base: path.posix.join(buildConf.path, buildConf.src),
				dest: buildConf.dest,
			};
			let styleBuilder = require("../../lib/task-style")(gulpOpt);
			let esBuilder = require("../../lib/task-es")(gulpOpt);
			let fileCache = {};

			app.use(buildConf.server, function(req, res, next) {

				let concatFilename;
				let extname;
				let mime;

				let globs;

				if (req.concat) {
					globs = Object.keys(req.concat).map(subPath => path.posix.join(req.path, subPath));
					concatFilename = globs.join(",");
					extname = path.extname(globs[0]);
					mime = mime_types.lookup(globs[0]);
					globs = globs.map(subPath => path.posix.join(buildConf.src, subPath));
				} else {
					// 普通的js、css操作
					globs = path.posix.join(buildConf.src, req.path);
					extname = path.extname(req.path);
					mime = mime_types.lookup(req.path);
				}

				let stream;

				if (/\.(?:css|less|scss)$/i.test(extname)) {
					stream = styleBuilder(globs);
				} else if (/\.(?:jsx?|es\d*|babel)$/i.test(extname)) {
					stream = esBuilder(globs);
				} else {
					let contents = fileCache[req.path];
					if (contents) {
						res.send(contents);
					} else {
						next();
					}
					return;
				}

				let contents;

				stream = stream
					.pipe(concatFilename ? concat(concatFilename) : gutil.noop())
					.pipe(buildConf.dest ? gulp.dest(buildConf.dest) : gutil.noop())
					.pipe(through.obj(function(file, encoding, cb) {
						if (!file.isNull() && file.isBuffer()) {
							if (/\.map/i.test(file.relative)) {
								fileCache[(concatFilename || req.path) + ".map"] = file.contents;
							} else {
								contents = file.contents;
								cb(null, file);
								return;
							}
						}
						cb(null, file);
						next();
					}));

				const eos = require("end-of-stream");
				const consume = require("stream-consume");
				eos(stream, {
					error: true,
					readable: stream.readable,
					writable: stream.writable && !stream.readable
				}, function(err) {
					if (err) {
						console.error(err);
					} else {
						if (contents) {
							res.type(mime).send(contents);
						} else {
							next();
						}
					}
				});
				consume(stream);

			});

			let staticRoot = path.posix.join(buildConf.path, buildConf.src);

			// 静态文件服务
			app.use(buildConf.server, express.static(staticRoot));

			let serveIndex = require("serve-index");

			// 文件索引页面，
			app.use(buildConf.server, serveIndex(staticRoot, {
				"icons": true
			}));
			return buildConf;
		}).filter(proj => proj);

		if (projs.length) {
			app.use("/", function(req, res, next) {
				if (req.path === "/") {
					res.send(projs.map(proj => `<a href="${ proj.server }">${ proj.name }</a>`).join("<br>"));
				} else {
					next();
				}
			});
			let server = require("http").createServer(app);
			return server;
		}
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
