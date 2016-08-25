"use strict";
const urlmap = {
	"stylelint": "http://stylelint.io/user-guide/rules/",
	"ESLint": "http://cn.eslint.org/docs/rules/",
	"JSHint": (code) => {
		let jshintMsg = require("jshint/src/messages");
		let msgTypeMap = {
			W: "warnings",
			I: "info",
			E: "errors",
		};
		if (/^((W|E|I)\d+)$/.test(code)) {
			let desc = jshintMsg[msgTypeMap[RegExp.$2]][RegExp.$1].desc;
			return "http://jslinterrors.com/?q=" + desc.replace(/^.+?→/, "");
		}
	}
};
const path = require("path");

/**
 * 将错误报告转换为HTML格式
 * @param  {String} base     项目跟目录
 * @param  {String} relative 项目相对目录
 * @param  {Array}  errors   详细的错误报告
 * @return {Array}           Markdown源代码，数组，每个数组成员为一条错误
 */
function toHTML(base, relative, errors) {
	errors = errors.map(error => {
		let message = [];
		if (error.lineNumber) {
			message.push(`<strong>[${ error.lineNumber }:${ error.columnNumber || 0 }]</strong>`)
		}

		message.push(`<span>${ error.message }</span>`)

		let subMsg = [];
		if (error.plugin) {
			subMsg.push(error.plugin);
		}
		if (error.rule) {
			let url = urlmap[error.plugin];
			if (url) {
				if (url.call) {
					url = url(error.rule);
				} else {
					url += error.rule;
				}
				subMsg.push(`<a href="${ url }" target="${ error.plugin ? error.plugin.toLowerCase() : "_blank" }">${ error.rule }</a>`);
			} else {
				subMsg.push(error.rule);
			}
		}

		if (subMsg.length) {
			message.push(`(${ subMsg.join(" ") })`);
		}

		message = `<p class="${ error.severity || "error" }">${ message.join(" ") }</p>`;

		if (error.source) {
			message += `\n<pre><code>${ error.source.replace(/^[\r\n]*/, "") }</code></pre>`;
		}

		return message;
	});

	errors.unshift(`<h3><a href="${ path.posix.join(base, relative) }" target="_blank">${ relative }</a></h3>`);
	return errors;
}

let reporter = {
	toHTML: function(data, base) {
		var result = [];
		for (let path in data) {
			if (data[path]) {
				result.push.apply(result, toHTML(base, path, data[path]));
			} else {
				delete data[path];
			}
		}
		return result.join("\n");
	}
};
module.exports = reporter;
