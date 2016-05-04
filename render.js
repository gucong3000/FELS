/*
 * SEO页面渲染
 * 为了少写一个文件，此文件实为两套脚本，一套在node环境下使用，另一套在PhantomJS中使用
 */
"use strict";

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
	"developers\.google\.com/\+/web/snippet",
	"slackbot",
	"vkShare",
	"W3C_Validator",
	"redditbot",
	"Applebot"
].join("|") + ")\\b", "i");

var url = require("url");
var phantom;

/**
 * 判断请求是否来自搜索引擎
 * @param  {ClientRequest}  req 请求对象
 * @return {Boolean}     是否来自搜索引擎
 */
function isSpider(req) {
	return (req.method === "GET" || req.method === "HEAD") && (req.headers["x-bufferbot"] || ("_escaped_fragment_" in url.parse(req.url, true).query) || crawlerUserAgents.test(req.headers["user-agent"] || ""));
}

/**
 * 判断搜索引擎想访问的URL
 * @param  {ClientRequest}  req 请求对象
 * @return {String}     URL
 */
function getUrl(req) {
	// 将原始的请求转换为对象
	var urlObj = url.parse(req.url, true);

	// 是否由nginx之类的负载均衡服务器，做过htts反代
	var forwardedProto = req.headers["x-forwarded-proto"];

	// 获取原始想访问的主机名
	urlObj.host = req.headers.host;

	if (forwardedProto) {
		// 用https反代替换http协议
		urlObj.protocol = forwardedProto.split(",")[0];
	} else {
		// 使用正常的协议
		urlObj.protocol = req.protocol;
	}

	// google约定了用_escaped_fragment_代替url中的hash
	if ("_escaped_fragment_" in urlObj.query) {
		urlObj.hash = "#" + urlObj.query._escaped_fragment_;
		delete urlObj.query._escaped_fragment_;
	}
	delete urlObj.search;
	delete urlObj.href;
	delete urlObj.path;

	return urlObj;
}

module.exports = function(req) {
	if (isSpider(req)) {
		if (!phantom) {
			phantom = require("phantom").create(["--local-to-remote-url-access=true", "--ignore-ssl-errors=true", "--load-images=false"]);
		}
		var sitepage;
		var urlObj = getUrl(req);

		return phantom.then(ph => {
			return ph.createPage();
		})

		.then(page => {
			sitepage = page;
			return page.open(url.format(urlObj));
		})

		.then(status => {
			if (status === "success") {
				return sitepage.property("content");
			} else {
				throw urlObj;
			}
		})

		.then(content => {
			sitepage.close();
			return content;
		});
	}
};
