"use strict";
// const fs = require("fs-extra-async");
const path = require("path");
const ini = require("editorconfig/lib/ini");
const fs = require("fs-extra-async");

const defaultConfig = {
	charset: "utf-8",
	end_of_line: "lf",
	indent_size: 4,
	indent_style: "tab",
	insert_final_newline: true,
	trim_trailing_whitespace: true,
};

/**
 * 转换`editorconfig`配置文件中的字符串为对象
 * @param  {String} config 配置文件中的字符串
 * @return {Object}        转换后的对象
 */
function parseString(config) {
	config = ini.parseString(config).filter(block => block[0] === "*").map(block => block[1]);
	config.unshift({});
	config.unshift(defaultConfig);
	return Object.assign.apply(Object, config);
}

let editorconfig = {
	init: function(data) {
		editorconfig.curr = data;
		return editorconfig.get();
	},
	get: function() {
		return fs.readFileAsync(path.join(editorconfig.curr.path, ".editorconfig"))

		.then(contents => editorconfig.curr.editorconfig = parseString(contents.toString()))

		.catch(() => {
			return defaultConfig;
		});
	},
	update: function(key, value) {
		let rcPath = path.join(editorconfig.curr.path, ".editorconfig");
		let config = editorconfig.curr.editorconfig;
		config[key] = value;
		let keys = Object.keys(config).sort();
		if (/^tab$/i.test(config.indent_style)) {
			keys = keys.filter(key => !/^indent_size$/i.test(key))
		}
		config = keys.map(key => `${ key } = ${ config[key] }`).join("\n");

		return fs.readFileAsync(rcPath)

		.then(contents => {
			return contents.toString().replace(/(\[\s*\*\s*\]\s*[\r\n]+)[^\[\]]+/, `$1${ config }\n\n`);
		})

		.catch(() => {
			return `[*]\n${ config }\n\n`;
		})

		.then(contents => fs.writeFileAsync(rcPath, contents));
	}
};

module.exports = editorconfig;
