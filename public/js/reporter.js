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
const fs = require("fs-extra-async");
const {
	remote,
} = require("electron");
const unifiedpath = remote.require("./unifiedpath");

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

/**
 * 将错误等级的字符串转化为排序所用的权重
 * @param  {String} severity 错误等级
 * @return {Int}          排序权重
 */
function severity2num(severity) {
	if (!severity) {
		severity = 0;
	} else if (severity === "error") {
		severity = 1
	} else if (severity === "warn") {
		severity = 2
	} else {
		severity = 3
	}
	return severity;
}

/**
 * 对错误信息排序的函数
 * @param  {Array} errors 待排序的错误数组与
 * @return {Array}        [description]
 */
function sortError(errors) {
	return errors.sort(function(err1, err2) {
		if (err1.severity !== err2.severity) {
			return severity2num(err1.severity) - severity2num(err2.severity)
		} else if (err1.lineNumber === err2.lineNumber) {
			return (err1.columnNumber || 0) - (err1.columnNumber || 0);
		} else {
			return (err1.lineNumber || 0) - (err2.lineNumber || 0);
		}
	});
}

function fixError(error) {
	return {
		// 错误等级
		severity: error.severity === "warning" ? "warn" : (error.severity || "error"),
		// 文件名
		fileName: error.fileName || (error.file ? (error.file.path || error.file) : error.fileName),
		// 行号
		lineNumber: error.lineNumber || error.line,
		// 列号
		columnNumber: error.columnNumber || error.column || error.character,
		// 错误信息
		message: error.message || error.reason || String(error),
		// 错误上下文
		source: error.source || error.evidence,
		// 错误规则
		rule: error.rule || error.ruleId || error.code,
		// 插件名
		plugin: error.plugin,
	};
}

function concat2Obj(obj, key, arr) {
	if (obj[key]) {
		if (arr) {
			obj[key] = obj[key].concat(arr);
		}
	} else {
		obj[key] = arr;
	}
}

let curr;

let reporter = {
	update: async function(proj, report) {

		// 错误报告数据的追加或者整理
		let data = report || proj.report;

		if (!data) {
			return;
		}

		let paths = Object.keys(data);

		// 过滤掉本地不存在的文件
		let pathStat = await Promise.all(paths.map(filterPath => {
			return fs.statAsync(path.resolve(proj.path, filterPath))

			.catch(() => false);
		}));

		paths = paths.filter((path, i) => pathStat[i] && pathStat[i].isFile());

		// 文件路径转为相对路径
		let dataRelativePath = {};
		paths.forEach(filePath => {
			if (path.isAbsolute(filePath)) {
				filePath = path.relative(proj.path, filePath);
				if (path.isAbsolute(filePath) || /^\.+/.test(filePath)) {
					return;
				}
			}
			concat2Obj(dataRelativePath, filePath, data[filePath]);
		});

		// 文件路径转为统一的`/`
		let dataUnifiedPath = {};
		Object.keys(dataRelativePath).forEach(filePath => {
			concat2Obj(dataUnifiedPath, unifiedpath(filePath), dataRelativePath[filePath]);
		});

		// 将错误消息排序
		Object.keys(dataUnifiedPath).forEach(filePath => {
			if (dataUnifiedPath[filePath]) {
				dataUnifiedPath[filePath] = reporter.fix(dataUnifiedPath[filePath]);
			}
		});

		if (report && proj.report) {
			// 在错误报告旧数据中追加数据
			Object.assign(proj.report, dataUnifiedPath);
		} else {
			// 整理错误报告数据
			proj.report = dataUnifiedPath;
		}

		if (curr === proj.path && report) {
			reporter.toHTML(proj);
		}
	},
	toHTML: function(proj) {
		let base = proj.path;
		let data = proj.report;
		curr = base;
		var result = [];
		Object.keys(data).sort().forEach(filePath => {
			if (data[filePath]) {
				result.push.apply(result, toHTML(base, filePath, data[filePath]));
			} else {
				delete data[filePath];
			}
		});

		result = result.join("\n");

		document.querySelector("#reporter+div").innerHTML = result || "无错误";
		if (result) {
			document.querySelector("[for=reporter]").click();
		}
		return result;
	},
	fix: function(error) {
		if (Array.isArray(error)) {
			return sortError(error.map(fixError));
		} else {
			return [fixError(error)];
		}
	}
};
module.exports = reporter;
