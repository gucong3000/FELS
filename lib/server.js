#!/usr/bin/env node

"use strict";
var express = require("express");
var app = express();
var cwd = process.cwd();
const staticRoot = __dirname === cwd ? "public" : cwd;
var logger = require("morgan");
var bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");
var compress = require("compression");

app.use(logger("dev"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: true
}));
app.use(cookieParser());
app.use(compress({
	level: 9
}));
app.set("x-powered-by", false);
app.set("etag", "strong");

var gulp = require("./gulpfile")(staticRoot, app.get("env"));

function readFileByGulp(filePath) {

	var pathname;
	try {
		pathname = require("./config/pathmap")(filePath, staticRoot) || filePath;
	} catch (ex) {
		//
	}

	if (!(pathname instanceof Promise)) {
		pathname = Promise.resolve(pathname);
	}

	return pathname.then(gulp);
}

// 只有dev环境使用
if (app.get("env") === "development") {
	// 将所有html请求加入livescript功能
	app.use(require("connect-livereload")());
	app.use((req, res, next) => {
		next();
	});
} else {
	// SEO 预渲染
	app.get("/*", (req, res, next) => {
		var promise = require("./render")(req);
		if (promise) {
			promise.then(contents => {
				res.type("html").send(contents);
			}).catch(url => {
				console.error(url.pathname + "\t服务器端预渲染失败");
				next();
			});
		} else {
			next();
		}
	});
}

// 将文件请求转发给gulp
app.get("/*", (req, res, next) => {

	var combo = req.originalUrl.match(/^(.+?)\?\?+(.+?)$/);
	var promise;
	if (combo) {
		let url = require("url");
		// combo方式文件请求合并
		combo = combo[2].split(/\s*,\s*/).map(filePath => url.parse(url.resolve(combo[1], filePath)).pathname);
		promise = Promise.all(combo.map(readFileByGulp)).then((files) => {
			files = files.filter(file => file);
			return {
				etag: files.map(file => file.etag || "").join(","),
				contents: files.map(file => file.contents).join("\n")
			};
		});
	} else {
		// 普通的js、css操作
		promise = readFileByGulp(req.path);
	}

	if (!promise) {
		// gulp木有接受请求
		return next();
	}

	// 将promise的数据传送给res.send()
	promise.then(file => {
		if (!file) {
			// gulp木有接受请求
			return next();
		}

		// 根据文件的扩展名，先给他设置一个contents-type，后面可能覆盖
		var type = req.path.replace(/^.*?(\.\w+)?$/, "$1") || req.originalUrl.replace(/^.*?(?:(\.\w+)(?:\?.*)?)?$/, "$1");
		if (type) {
			res.type(type);
		}
		if (file.etag) {
			res.set("ETag", file.etag);
		}
		res.send(file.contents);
		if (!combo && req.path.slice(1) !== file.relative.replace(/\\/g, "/")) {
			console.warn(`路径发生映射 ${ req.path } => ${ file.relative }`);
		}
	}).catch(err => {
		next(err);
	});
});

// 静态资源
app.use((req, res, next) => {
	var mime;
	try {
		mime = require("mime-types").lookup(req.path);
	} catch (ex) {
		//
	}
	if (mime) {
		res.type(mime);
	}
	next();
});
app.use(express.static(staticRoot));
