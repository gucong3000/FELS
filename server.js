#!/usr/bin/env node

"use strict";
var express = require("express");
var url = require("url");
var app = express();
var serveIndex = require("serve-index");
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
	return gulp(filePath);
}

var errMsgMap = {
	"EACCES": "权限不足，对此文件的访问被操作系统拒绝",
	"EISDIR": "该路径是目录而不是文件",
	"EMFILE": "当前打开的文件太多，请稍后再试",
	"ENOENT": "没有找到该文件或目录",
};

var errCodeMap = {
	"EACCES": 403,
	"EISDIR": 422,
	"EMFILE": 421,
	"ENOENT": 404,
};

// 只有dev环境使用
if (app.get("env") === "development") {
	// 将所有html请求加入livescript功能
	app.use(require("connect-livereload")());
}

// 将文件请求转发给gulp
app.use((req, res, next) => {

	var combo = req.originalUrl.match(/^(.+?)\?\?+(.+?)$/);
	var promise;
	if (combo) {
		// combo方式文件请求合并
		combo = combo[2].split(/\s*,\s*/).map(filePath => url.parse(url.resolve(combo[1], filePath)).pathname);
		promise = Promise.all(combo.map(readFileByGulp))
			.then((files) => {
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

	if (promise) {
		// 将promise的数据传送给res.send()
		promise.then(file => {
			// 根据文件的扩展名，先给他设置一个contents-type，后面可能覆盖
			var type = req.path.replace(/^.*?(\.\w+)?$/, "$1") || req.originalUrl.replace(/^.*?(?:(\.\w+)(?:\?.*)?)?$/, "$1");
			if (type) {
				res.type(type);
			}
			if (file.etag) {
				res.set("ETag", file.etag);
			}
			res.send(file.contents);
		}).catch(err => {
			if (err && err.code && errMsgMap[err.code]) {
				var newErr = errMsgMap[err.code] + "\t" + req.originalUrl;
				newErr = new Error(newErr);
				newErr.status = errCodeMap[err.code] || 400;
				next(newErr);
			} else {
				next(err);
			}
		});
	} else {
		// gulp木有接受请求
		next();
	}
});

// 只有dev环境使用
if (app.get("env") === "development") {
	// 将所有*.jumei.com的访问请求重定向到*.jumeicd
	app.use((req, res, next) => {
		if (/^(.*?)\.jumei\.com$/.test(req.hostname)) {
			res.redirect(`http://${ RegExp.$1 }.jumeicd.com${ req.originalUrl }`);
		} else {
			next();
		}
	});
	// jsHint报错查询
	let jshintMsg = require("jshint/src/messages");
	let msgTypeMap = {
		W: "warnings",
		I: "info",
		E: "errors",
	};
	let apiDataCache = {};
	app.use((req, res, next) => {
		let msgCode;
		let desc;

		function render() {
			let data = apiDataCache[msgCode];
			require("fs").readFile("markdown.html", function(err, html) {
				let type;
				if (!err) {
					data = html.toString().replace(/(<title>)\s*(<\/title>)/i, `$1${ data.title }$2`).replace(/(<div class="row">\n*)\s*(\n*<\/div>)/i, "$1" + require("markdown-it")().render("## " + data.title + "\n\n" + data.explanation) + "$2");
					type = "html";
				} else {
					type = "markdown";
				}
				res.type(type).send(data);
			});
		}
		if (/\bjs[hl]int\/((W|E|I)\d+)$/.test(req.path)) {
			msgCode = RegExp.$1;
			if (apiDataCache[msgCode]) {
				render();
				return;
			}
			desc = jshintMsg[msgTypeMap[RegExp.$2]][RegExp.$1].desc.replace(/^.+?→/, "");
			if (desc) {
				// res.send(desc);
				var request = require("request");
				var apiurl = "http://api.jslinterrors.com/explain?format=md&message=" + desc.replace(/\.+$/, "");
				request(url.parse(apiurl).href, function(error, response, body) {
					var data;
					try {
						data = JSON.parse(body);

					} catch (ex) {

					}
					if (data && data.explanation) {
						apiDataCache[msgCode] = data;
						render();
					} else {
						res.send(desc);
					}
				});
			} else {
				next();
			}
		} else {
			next();
		}
	});
}

// 静态资源
app.use(express.static(staticRoot));

// 只有dev环境使用
if (app.get("env") === "development") {
	// 文件索引页面，
	app.use(serveIndex(staticRoot, {
		"icons": true
	}));
}

// production error handler
// no stacktraces leaked to user
app.use((err, req, res, next) => {
	if (err && err.stack) {
		var errLog = err.stack.toString();
		if (errLog.length < 800) {
			// 控制台显示完整报错信息
			console.error(errLog);
		}

		// 前台的报错信息，如果是开发环境，则报err.stack，否则只报err.message
		var isDev = app.get("env") === "development";
		var status = err.status || 500;
		res.status(status).type("html").send(`<!DOCTYPE html>
<!-- Ticket #11289, IE bug fix: always pad the error page with enough characters such that it is greater than 512 bytes, even after gzip compression abcdefghijklmnopqrstuvwxyz1234567890aabbccddeeffgghhiijjkkllmmnnooppqqrrssttuuvvwwxxyyzz11223344556677889900abacbcbdcdcededfefegfgfhghgihihjijikjkjlklkmlmlnmnmononpopoqpqprqrqsrsrtstsubcbcdcdedefefgfabcadefbghicjkldmnoepqrfstugvwxhyz1i234j567k890laabmbccnddeoeffpgghqhiirjjksklltmmnunoovppqwqrrxsstytuuzvvw0wxx1yyz2z113223434455666777889890091abc2def3ghi4jkl5mno6pqr7stu8vwx9yz11aab2bcc3dd4ee5ff6gg7hh8ii9j0jk1kl2lmm3nnoo4p5pq6qrr7ss8tt9uuvv0wwx1x2yyzz13aba4cbcb5dcdc6dedfef8egf9gfh0ghg1ihi2hji3jik4jkj5lkl6kml7mln8mnm9ono -->
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>Server Error - ${ status }</title>
</head>
<body>
<pre>
${ isDev ? err.stack : err.message }
</pre>
</body>
</html>`);
	} else {
		res.status(404).send();
	}
});

// 启动web服务
(function() {

	const fs = require("fs");
	const isDev = app.get("env") === "development";
	let options;

	try {
		options = {
			pfx: fs.readFileSync("ssl/ssl.pfx")
		};
	} catch (ex) {

	}

	// 开发环境下，自动刷新服务端进程与自动刷新浏览器页面
	if (isDev) {

		let livereloadServer;

		// 浏览器端自动刷新
		let livereload;
		try {
			livereload = require("livereload");
		} catch (ex) {

		}
		if (livereload) {
			livereloadServer = livereload.createServer({
				https: options
			});
			livereloadServer.watch(staticRoot);
			// livereloadServer.filterRefresh();
			console.log("\nlivereload\t\t" + livereloadServer.config.port);

		} else {
			console.error("缺少node组件，请通过npm命令安装：livereload");
		}
	}
	let port = normalizePort(process.env.PORT);
	let defaultPort;
	/**
	 * Normalize a port into a number, string, or false.
	 */

	function normalizePort(val) {
		let port = parseInt(val, 10);

		if (isNaN(port)) {
			// named pipe
			return val;
		}

		if (port >= 0) {
			// port number
			return port;
		}

		return false;
	}

	let http;
	let server;

	/**
	 * Create HTTP server.
	 */

	if (options) {
		http = require("spdy");
		server = http.createServer(options, app);
		defaultPort = isDev ? 3000 : 443;
	} else {
		http = require("http");
		server = http.createServer(app);
		defaultPort = isDev ? 3000 : 80;
	}

	port = port || defaultPort;

	/**
	 * Listen on provided port, on all network interfaces.
	 */

	server.listen(port);
	server.on("error", onError);
	server.on("listening", onListening);

	/**
	 * Event listener for HTTP server "error" event.
	 */

	function onError(error) {
		if (error.syscall !== "listen") {
			throw error;
		}

		let bind = typeof port === "string" ? "Pipe " + port : "Port " + port;

		// handle specific listen errors with friendly messages
		switch (error.code) {
			case "EACCES":
				console.error(bind + " requires elevated privileges");
				process.exit(1);
				break;
			case "EADDRINUSE":
				console.error(bind + " is already in use");
				process.exit(1);
				break;
			default:
				throw error;
		}
	}
	/**
	 * Event listener for HTTP server "listening" event.
	 */

	function onListening() {
		console.log(`web\t\t\t${ port }
process ID:\t\t${ process.pid }
env \t\t\t${ app.get("env") }`);
	}
})();
