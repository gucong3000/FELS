"use strict";
const path = require("path");
const cosmiconfig = require("cosmiconfig");
const editorconfig = require("editorconfig");

/**
 * 读取css文件的stylelint配置，同时使用editconfig配置覆盖stylelint相关规则,
 * @param  {[type]} file 要查找配置的css文件路径
 * @param  {[type]} root 向上查找的根目录
 * @return {Promise}      cosmiconfig格式的配置文件，其中stylelint配置已被editconfig覆盖
 */
module.exports = function(file, root) {
	// 读取stylelint配置文件和editorconfig配置文件
	return Promise.all([cosmiconfig("stylelint", {
		stopDir: root,
		cwd: path.dirname(file),
		moduleName: "stylelint",
		rcExtensions: true,
		argv: false,
	}).catch(() => {
		return {
			config: {
				rules: {}
			}
		};
	}), editorconfig.parse(file, {
		root
	})])

	.then(([stylelintrc, editorconfig]) => {
		if (!stylelintrc.config.rules) {
			stylelintrc.config.rules = {};
		}

		// 使用editorconfig的配置覆盖stylelint配置
		if (editorconfig) {

			if (editorconfig.indent_style) {
				if (/^space$/i.test(editorconfig.indent_style)) {
					// 使用空格
					stylelintrc.config.rules.indentation = +editorconfig.indent_size || 4;
				} else {
					// 使用tab缩进
					stylelintrc.config.rules.indentation = "tab";
				}
			}
			if (editorconfig.insert_final_newline) {
				// 文件结尾加入一个空行
				stylelintrc.config.rules["no-missing-end-of-source-newline"] = true;
			}
			if (editorconfig.trim_trailing_whitespace) {
				// 删除行末尾多余空格
				stylelintrc.config.rules["no-eol-whitespace"] = true;
			}
		}
		return stylelintrc;
	});
}
