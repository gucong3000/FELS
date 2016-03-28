"use strict";
var express = require("express");
var path = require("path");
var url = require("url");
var app = express();
var fs = require("fs");
var etag = require("etag");
var serveIndex = require("serve-index");
var jshintrc = {};
var memFs = {};
const staticRoot = "public";

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

function jsHint(code, options) {
	var JSHINT = require("jshint").JSHINT;
	try {
		JSHINT(code, Object.assign({}, jshintrc, options));
		return JSHINT.data();
	} catch (ex) {
		return {
			options
		};
	}
}

function jsModule(data, path) {
	// 模块加载器、非js模块普通文件，cmd规范模块，不作处理
	if (/\/common(?:\Wmin)\.js$/.test(path) || !/\b(?:define|module|exports)\b/.test(data) || /\bdefine\.cmd\b/.test(data)) {
		return data;
	}
	var isAmd;
	data = data.replace(/\bdefine\.amd\b/, function() {
		isAmd = true;
		return "define.useamd()";
	});
	if (isAmd) {
		return data;
	}
	// CommonJS 规范的 js module.
	var deps = [];

	data.replace(/\/\/[^\r\n]+/g, "").replace(/\/\*.+?\*\//g, "").replace(/\brequire\(\s*(["'])([^"']+)\1\s*\)/g, function(s, quotes, moduleName) {
		// 分析代码中的`require("xxxx")`语句，提取出模块名字
		deps.push(JSON.stringify(moduleName));
		return "";
	}).replace(/\bimport\b[^;]+?\bfrom\s+(["'])([^"']+)\1/g, function(s, quotes, moduleName) {
		// 分析代码中的`import`语句，提取出模块名字
		deps.push(JSON.stringify(moduleName));
		return "";
	});

	if (deps.length) {
		deps = `,[${ deps.join(",") }]`;
	} else {
		deps = "";
	}

	data = data.trim();

	// 对整个js块包裹CMD规范的标准Wrap
	data = `(function(f){typeof define==="function"?define("${ path }"${ deps },f):f()})(function(require,exports,module){
${ data }
});`;
	return data;
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

function pathMap(filePath) {
	return filePath.replace(/^\/static_account\/dist\/(?:dev|local|[\d_]+)\/js\/boot.js$/, "/static_account/boot.js").replace(/^\/static_account\/dist\/(?:dev|local|[\d_]+)\/(.*)$/, "/static_account/src/$1");
}

function readFile(filePath) {
	filePath = pathMap(filePath) || filePath;
	return new Promise((resolve, reject) => {
		var absPath = path.join(staticRoot, filePath);

		function sendErr(err) {
			var newErr = errMsgMap[err.code] ? errMsgMap[err.code] + "\t" + filePath : err.stack;
			newErr = new Error(newErr);
			newErr.status = errCodeMap[err.code] || 400;
			reject(newErr);
		}

		function getMtime(callback) {
			fs.stat(absPath, (err, stats) => {
				if (!err) {
					stats = +stats.mtime;
				}
				callback(err, stats);
			});
		}

		function readIo() {
			// 从磁盘读取文件内容
			fs.readFile(absPath, (err, data) => {
				if (err) {
					// 文件无法读取，走报错流程
					sendErr(err);
				} else {
					// 文件数据转换为字符串
					data = data.toString();

					// 调用js构建流程
					if (/\.js$/.test(filePath)) {
						try {
							data = jsModule(data, filePath);
						} catch (ex) {
							console.error(ex);
						}
					} else if (/\.css$/.test(filePath)) {
						// data = cssModule(data, filePath);
					}

					// 声明文件缓存
					var fileCache = {
						data: data,
						etag: etag(data),
					};

					// 读取本地文件修改时间
					getMtime((err, mtime) => {
						if (err) {
							sendErr(err);
						} else {
							fileCache.mtime = mtime;
							memFs[filePath] = fileCache;
							saveMemFs();
							resolve(fileCache);
						}
					});
				}
			});
		}

		// 优先在内存中寻找文件
		if (memFs[filePath]) {
			// 读取本地文件的最后修改时间
			getMtime((err, mtime) => {
				if (err) {
					// 本地文件不能正常访问，删除缓存中的对应数据，并走报错流程
					delete memFs[filePath];
					sendErr(err);
				} else if (mtime !== memFs[filePath].mtime) {
					// 本地文件的最后修改时间与缓存中不一致，走磁盘读取流程
					readIo();
				} else {
					// 缓存中的数据最后修改时间与磁盘上的一致，发送缓存中的数据
					resolve(memFs[filePath]);
				}
			});
		} else {
			// 内存中无此文件直接走磁盘读取流程
			readIo();
		}
	});
}

function readJSON(path, callback) {
	fs.readFile(path, (err, data) => {
		// 读取.jshintrc配置文件
		try {
			data = JSON.parse(data);
		} catch (ex) {
			try {
				data = eval.call(null, "(" + data + ")");
			} catch (ex) {

			}
		}
		callback(data || {});
	});
}

var fsTimer;

function saveMemFs() {
	clearTimeout(fsTimer);
	fsTimer = setTimeout(() => {
		fs.writeFile("files.cache", JSON.stringify(memFs), (err) => {
			if (!err) {
				console.log("Memory file cache saved");
			}
		});
	}, 3000);
}

readJSON(".jshintrc", (data) => jshintrc = data);

readJSON("files.cache", (data) => memFs = data);

// 本地文件访问与combo文件合并
app.use((req, res, next) => {

	var type = req.path.replace(/^.*?(\.\w+)?$/, "$1") || req.originalUrl.replace(/^.*?(?:(\.\w+)(?:\?.*)?)?$/, "$1");
	if (type) {
		res.type(type);
	}
	var combo = req.originalUrl.match(/^(.+?)\?\?+(.+?)$/);
	var promise;
	if (combo) {
		// combo方式文件请求合并
		combo = combo[2].split(/\s*,\s*/).map(filePath => url.parse(url.resolve(combo[1], filePath)).pathname);
		promise = Promise.all(combo.map(filePath => readFile(filePath)))
			.then((files) => {
				return {
					etag: etag(files.map(file => file.etag).join("")),
					data: files.map(file => file.data).join("\n")
				};
			});
	} else if (/\.(?:js|css)$/.test(req.path)) {
		// 普通的js、css操作
		promise = readFile(req.path);
	} else {
		return next();
	}
	// 将promise的数据传送给res.send()
	promise.then(file => {
		res.set("ETag", file.etag).send(file.data);
	}).catch(() => {
		next();
	});
});


// 将所有*.jumei.com的访问请求重定向到*.jumeicd
app.use((req, res, next) => {
	if (/^(.*?)\bjumei.com$/.test(req.hostname)) {
		res.redirect(`http://${RegExp.$1}.jumeicd.com${ req.path }`);
	} else {
		next();
	}
});

app.use(express.static(staticRoot));

app.use(serveIndex(staticRoot, {
	"icons": true
}));

// production error handler
// no stacktraces leaked to user
app.use((err, req, res, next) => {
	if (err) {
		console.error(err.stack);
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
${ err.message }
</pre>
</body>
</html>`);
	} else {
		next();
	}
});

// 启动web服务
(function() {

	var fs = require("fs");
	var port = normalizePort(process.env.PORT);
	var defaultPort;
	var options;

	try {
		options = {
			pfx: fs.readFileSync("ssl/ssl.pfx")
		};
	} catch (ex) {

	}


	/**
	 * Normalize a port into a number, string, or false.
	 */

	function normalizePort(val) {
		var port = parseInt(val, 10);

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

	var http;
	var server;

	/**
	 * Create HTTP server.
	 */



	if (options) {
		http = require("spdy");
		server = http.createServer(options, app);
		defaultPort = 443;
	} else {
		http = require("http");
		server = http.createServer(app);
		defaultPort = 80;
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

		var bind = typeof port === "string" ? "Pipe " + port : "Port " + port;

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
		console.log("This process is pid " + process.pid + ".\tListening on " + port);
	}
})();