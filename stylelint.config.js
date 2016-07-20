/* eslint-env node */
"use strict";
const fs = require("fs-extra-async");
const path = require("path");
const rcPath = path.join(__dirname, ".csscomb.json");
let rcSource;
let rcObject;

// 读取`.csscomb.json`配置
try {

	// 读取源代码
	rcSource = fs.readFileSync(rcPath).toString();

	// 转换JSON格式
	rcObject = JSON.parse(rcSource);
} catch (ex) {
	if (rcSource) {
		try {

			// 尝试转换不规范的JSON格式
			rcObject = eval("(" + rcSource + ")");
		} catch (ex) {

		}
		rcSource = "";
	}
	console.error(rcPath + "\t" + ex.stack);
}

// 未读取到`.csscomb.json`，则获取csscomb默认配置
rcObject = rcObject || (() => {
	try {
		return require("csscomb/config/csscomb.json");
	} catch (ex) {
		return path.join(process.cwd(), "csscomb/config/csscomb.json");
	}
})();

// 换行符的“名字”映射为名字对应的字符串
const eolMap = {
	cr: "\r",
	lf: "\n",
	crlf: "\r\n"
};

const editorconfig = require("editorconfig");

// 读取js文件的`.editorconfig`配置
editorconfig.parse(path.join(__dirname, "*.css"))

.then(config => {

	// 根据js文件的`.editorconfig`配置，调整`.csscomb.json`配置
	if (/^space$/i.test(config.indent_style)) {

		// 配置缩进为空格
		rcObject["tab-size"] = +config.indent_size || 4;
		rcObject["block-indent"] = " ";
	} else {

		// 配置缩进为tab
		rcObject["block-indent"] = "\t";
		rcObject["tab-size"] = false;
	}

	// 调整文件末尾空行设置
	rcObject["eof-newline"] = !!config.insert_final_newline;

	// 其他针对`.csscomb.json`需要覆盖的默认配置
	// https://github.com/csscomb/csscomb.js/blob/dev/doc/options.md
	rcObject["vendor-prefix-align"] = false;
	if (!rcObject.quotes) {
		rcObject.quotes = "double";
	}

	// 检查是否需要更新`.csscomb.json`文件
	if (!rcSource || JSON.stringify(rcObject) !== JSON.stringify(JSON.parse(rcSource))) {

		// 加载针对`.csscomb.json`配置文件的`.editorconfig`配置
		return editorconfig.parse(rcPath);
	}
})

.then(config => {

	if (!config) {

		// 不需要更新`.csscomb.json`文件
		return;
	}

	// 将`.csscomb.json`转化为字符串，缩进服从`.editorconfig`配置
	let newRcSource = JSON.stringify(
		rcObject,
		0,
		/^space$/i.test(config.indent_style) ? +config.indent_size || 4 : "\t"
	);

	let eol;

	// 将`.csscomb.json`转化为的字符串，换行服从`.editorconfig`配置
	if (config.end_of_line) {
		eol = eolMap[config.end_of_line.toLowerCase()];
		if (eol) {
			newRcSource.replace(/\n/g, eol);
		}
	}

	// 将`.csscomb.json`转化为的字符串，文件结尾服从`.editorconfig`配置
	if (config.insert_final_newline) {
		newRcSource += eol || "\n";
	}

	// 写入`.csscomb.json`文件
	fs.writeFile(rcPath, newRcSource, error => {
		if (error) {
			console.error("Can not write file: \t" + rcPath);
		} else {
			console.error("File write success: \t" + rcPath);

			// 改变配置，需要重启进程
			process.exit(1);
		}
	});
});

// https://github.com/stylelint/stylelint/blob/master/docs/user-guide/rules.md
module.exports = {
	"rules": {
		"block-no-empty": true,
		"color-no-invalid-hex": true,
		"declaration-colon-space-after": "always",
		"declaration-colon-space-before": "never",
		"function-comma-space-after": "always",
		"function-url-quotes": "always",
		"indentation": rcObject["block-indent"] === " " ? +rcObject["tab-size"] || 4 : "tab",
		"max-empty-lines": 2,
		"media-feature-colon-space-after": "always",
		"media-feature-colon-space-before": "never",
		"media-feature-name-no-vendor-prefix": true,
		"number-leading-zero": "never",
		"number-no-trailing-zeros": true,
		"property-no-vendor-prefix": !rcObject["vendor-prefix-align"],
		"selector-list-comma-newline-after": "always",
		"selector-list-comma-space-before": "never",
		"string-quotes": rcObject.quotes || "double",

		// 这项暂时设置为true，等日后在构建流程中加入了autoprefixer之后再打开
		"value-no-vendor-prefix": null,
		// "no-missing-end-of-source-newline": !!rcObject["eof-newline"]
	},
};
