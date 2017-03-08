"use strict";
// const fs = require("fs-extra-async");
const path = require("path");
const ini = require("editorconfig/lib/ini");
const unit = require("./config-util");

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
	config = ini.parseString(config.toString()).filter(block => block[0] === "*").map(block => block[1]);
	config.unshift({});
	config.unshift(defaultConfig);
	return Object.assign.apply(Object, config);
}

let editorconfig = {
	get: function(baseDir) {
		let rcPath = path.join(baseDir, ".editorconfig");
		return unit.readFileAsync(rcPath)

		.then(parseString)

		.catch(() => {
			unit.writeFileAsync(rcPath, `# EditorConfig is awesome: http://EditorConfig.org
# top-most EditorConfig file
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = tab
insert_final_newline = true
trim_trailing_whitespace = true`);
			return defaultConfig;
		});
	},
	set: function(baseDir, config) {
		let rcPath = path.join(baseDir, ".editorconfig");
		let keys = Object.keys(config).sort();
		if (/^tab$/i.test(config.indent_style)) {
			keys = keys.filter(key => !/^indent_size$/i.test(key));
		}
		config = keys.map(key => `${ key } = ${ config[key] }`).join("\n");

		return unit.readFileAsync(rcPath)

		.then(contents => {
			return contents.toString().replace(/(\[\s*\*\s*\]\s*[\r\n]+)[^\[\]]+/, `$1${ config }\n\n`);
		})

		.catch(() => {
			return `[*]\n${ config }\n\n`;
		})

		.then(contents => unit.writeFileAsync(rcPath, contents));
	}
};

module.exports = editorconfig;
