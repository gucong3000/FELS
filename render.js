/*
 * SEO页面渲染
 * 为了少写一个文件，此文件实为两套脚本，一套在node环境下使用，另一套在PhantomJS中使用
 */
/* global phantom */
"use strict";

if (typeof phantom === "undefined") {
	// 如果当前运行于node环境下，则启动node
	node_init();
} else {
	// 如果当前运行于PhantomJS环境下，则启动node_init
	phantom_init();
}

function phantom_init() {
	var sys = require("system"),
		urls = sys.args[sys.args.length - 1].split(","),
		cont = 0;

	urls.forEach(function(url, i) {
		setTimeout(function() {
			var page = require("webpage").create();
			page.open(url, function(status) {
				if (status === "success") {
					// 页面加载成功！
					console.log(JSON.stringify(page));
				} else {
					console.error(url);
				}

				page.close();

				if (++cont >= urls.length) {
					phantom.exit();
				}
			});
		}, 800 * i);
	});
}

function node_init() {

	// 各大搜索引擎的userAgent中的关键字
	var crawlerUserAgents = new RegExp("\\b(?:" + [
		// "googlebot",
		// "yahoo",
		// "bingbot",
		"baiduspider",
		"facebookexternalhit",
		"twitterbot",
		"rogerbot",
		"linkedinbot",
		"embedly",
		"quora link preview",
		"showyoubot",
		"outbrain",
		"pinterest",
		"developers.google.com/+/web/snippet",
		"slackbot",
		"vkShare",
		"W3C_Validator",
		"redditbot",
		"Applebot"
	].join("|") + ")\\b", "i");

	module.exports = function(req, res) {
		if ((req.method === "GET" || req.method === "HEAD") && req.accepts("text/html") && (req.get("x-bufferbot") || crawlerUserAgents.test(req.get("user-agent") || "") || (req.query && req.query.hasOwnProperty("_escaped_fragment_")))) {
			var url = require("url");

			var urlObj = {
				host: req.get("host"),
				protocol: req.get("x-forwarded-proto") ? req.get("x-forwarded-proto").split(",")[0] : req.protocol,
				pathname: url.parse(req.query._escaped_fragment_ ? url.resolve(req.originalUrl, req.query._escaped_fragment_) : req.originalUrl).pathname,
			};

			delete req.query._escaped_fragment_;
			urlObj.query = req.query;
			console.log(req.cookies);

			require("child_process").execFile(require("phantomjs").path, ["--local-to-remote-url-access=true", "--ignore-ssl-errors=true", "--load-images=false", __filename, url.format(urlObj)], function(err, stdout, stderr) {

				if (err || stderr) {
					res.status(500).send(stderr || urlObj.pathname);
				} else {
					stdout = JSON.parse(stdout);
					stdout = {
						content: stdout.content.replace(/(<html\b[^>]*)\s+manifest=("|')[^>]*\2/i, "$1"),
						loadingProgress: stdout.loadingProgress,
						title: stdout.title,
						url: stdout.url,
					};
					res.send(stdout.content);
				}
				// handle results 
			});
			return true;
		}
	};
}