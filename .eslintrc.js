/* eslint-env node */
"use strict";
const fs = require("fs-extra-async");
const path = require("path");
const rcPath = path.join(__dirname, ".jsbeautifyrc");
let rcSource
let jsbeautifyrc;

// 读取`.jsbeautifyrc`配置
try {

	// 读取源代码
	rcSource = fs.readFileSync(rcPath).toString();

	// 转换JSON格式
	jsbeautifyrc = JSON.parse(rcSource);
} catch (ex) {
	if (rcSource) {
		try {
			// 尝试转换不规范的JSON格式
			jsbeautifyrc = eval("(" + rcSource + ")");
		} catch (ex) {

		}
		rcSource = "";
	}
	console.error(rcPath + "\t" + ex.stack);
}

// 未读取到`.jsbeautifyrc`，则获取js-beautify默认配置
jsbeautifyrc = jsbeautifyrc || require("js-beautify/js/config/defaults.json");


// 换行符的“名字”映射为名字对应的字符串
const eolMap = {
	cr: "\r",
	lf: "\n",
	crlf: "\r\n"
};

const editorconfig = require("editorconfig");

// 读取js文件的`.editorconfig`配置
editorconfig.parse(path.join(__dirname, "*.js"))

.then(config => {

	// 根据js文件的`.editorconfig`配置，调整`.jsbeautifyrc`配置
	if (/^space$/i.test(config.indent_style)) {
		// 配置缩进为空格
		jsbeautifyrc.indent_size = +config.indent_size || 4;
		jsbeautifyrc.indent_char = " ";
		jsbeautifyrc.indent_with_tabs = false;
	} else {
		// 配置缩进为tab
		jsbeautifyrc.indent_size = +config.indent_size || 1;
		jsbeautifyrc.indent_char = "\t";
		jsbeautifyrc.indent_with_tabs = true;
	}

	jsbeautifyrc.end_with_newline = !!config.insert_final_newline;

	// 其他针对jsbeautifyrc需要覆盖的默认配置
	jsbeautifyrc.unescape_strings = true;
	jsbeautifyrc.max_preserve_newlines = 3;


	// 检查是否需要更新`.jsbeautifyrc`文件
	if (!rcSource || JSON.stringify(jsbeautifyrc) !== JSON.stringify(JSON.parse(rcSource))) {
		// 加载针对`.jsbeautifyrc`配置文件的`.editorconfig`配置
		return editorconfig.parse(rcPath);
	}
})

.then(config => {

	if (!config) {
		// 不需要更新`.jsbeautifyrc`文件
		return;
	}

	// 将`.jsbeautifyrc`转化为字符串，缩进服从`.editorconfig`配置
	let newRcSource = JSON.stringify(
		jsbeautifyrc,
		0,
		/^space$/i.test(config.indent_style) ? +config.indent_size || 4 : "\t"
	);

	let eol;

	// 将`.jsbeautifyrc`转化为的字符串，换行服从`.editorconfig`配置
	if (config.end_of_line) {
		eol = eolMap[config.end_of_line.toLowerCase()];
		if (eol) {
			newRcSource.replace(/\n/g, eol);
		}
	}

	// 将`.jsbeautifyrc`转化为的字符串，文件结尾服从`.editorconfig`配置
	if (config.insert_final_newline) {
		newRcSource += eol || "\n";
	}

	// 写入`.jsbeautifyrc`文件
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


module.exports = {
	"root": true,
	"parserOptions": {
		"ecmaVersion": 6,
		"ecmaFeatures": {
			"jsx": true
		}
	},
	"env": {
		"node": true,
		"amd": true,
		"es6": true
	},
	"rules": {
		"no-negated-in-lhs": "error",
		"no-cond-assign": [
			"error",
			"except-parens"
		],
		"curly": [
			"error",
			"all"
		],
		"object-curly-spacing": [
			"error",
			"always"
		],
		"computed-property-spacing": [
			"error",
			"never"
		],
		"array-bracket-spacing": [
			"error",
			"never"
		],
		"eqeqeq": [
			"error",
			"smart"
		],

		// Shows errors where jshint wouldn't (see jshint "expr" rule)
		// clarifying this with eslint team
		// "no-unused-expressions": "error",
		"wrap-iife": [
			"error",
			"inside"
		],
		"no-caller": "error",
		"quotes": [
			"error",
			"double"
		],
		"no-undef": "error",
		"no-unused-vars": "error",
		"operator-linebreak": [
			"error",
			"after"
		],
		"comma-style": [
			"error",
			"last"
		],
		"camelcase": [
			"error", {
				"properties": "never"
			}
		],
		"dot-notation": [
			"error", {
				"allowPattern": "^[a-z]+(_[a-z]+)+$"
			}
		],
		"no-mixed-spaces-and-tabs": "error",
		"no-trailing-spaces": "error",
		"no-multi-str": "error",
		"comma-dangle": [
			"error",
			"only-multiline"
		],
		"comma-spacing": [
			"error", {
				"before": false,
				"after": true
			}
		],
		"space-before-blocks": [
			"error",
			"always"
		],
		"strict": [
			"error",
			"safe"
		],
		"space-in-parens": [
			"error",
			"never"
		],
		"keyword-spacing": [
			2
		],
		"semi": [
			"error",
			"always"
		],
		"semi-spacing": [
			"error", {
				// Because of the `for ( ; ...)` requirement
				// "before": true,
				"after": true
			}
		],
		"space-infix-ops": "error",
		"eol-last": "error",
		"lines-around-comment": [
			"error", {
				"beforeLineComment": true
			}
		],
		"linebreak-style": [
			"error",
			"unix"
		],
		"no-with": "error",
		"brace-style": "error",
		"space-before-function-paren": [
			"error",
			"never"
		],
		"no-loop-func": "error",
		"no-spaced-func": "error",
		"key-spacing": [
			"error", {
				"beforeColon": false,
				"afterColon": true
			}
		],
		"space-unary-ops": [
			"error", {
				"words": false,
				"nonwords": false
			}
		],
		"no-multiple-empty-lines": jsbeautifyrc.max_preserve_newlines - 1
	}
};
