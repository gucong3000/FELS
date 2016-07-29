"use strict";
const urlmap = {
	"stylelint": "http://stylelint.io/user-guide/rules/",
	"ESLint": "http://eslint.org/docs/rules/",
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

function toMD(base, relative, errors) {
	errors = errors.map(error => {
		let pos;
		if (error.line && error.column) {
			pos = `[${ error.line }:${ error.column }] `;
		} else {
			pos = "";
		}

		let subMsg = [error.plugin];
		if (error.rule) {
			let url = urlmap[error.plugin];
			if (url) {
				if (url.call) {
					url = url(error.rule);
				} else {
					url += error.rule;
				}
				subMsg.push(`[${ error.rule }](${ url })`);
			} else {
				subMsg.push(error.rule);
			}
		}

		let message = `${ pos }${ error.message } (${ subMsg.join(" ") })`;

		if (error.source) {
			message += "\n\n```\n" + error.source + "\n```";
		}

		return message;
	});
	errors.unshift(`[${ relative }](${ path.posix.join(base, relative) })`);
	return errors;
}

let reporter = {
	toMD: function(data, base) {
		var result = [];
		for (let path in data) {
			result = result.concat(toMD(base, path, data[path]));
		}
		return result.join("\n\n");
	},
	toHTML: function(data, base) {
		return require("markdown-it")().render(reporter.toMD(data, base));
	}
};
module.exports = reporter;
