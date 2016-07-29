/**
 * stylelint 配置文件
 * @see http://stylelint.io/user-guide/rules/
 */
"use strict";
module.exports = {
	"rules": {
		"block-no-empty": [true, {
			"message": "不允许空的语句块",
			"severity": "error"
		}],
		"color-no-invalid-hex": [true, {
			"message": "无效的十六进制颜色",
			"severity": "error"
		}],
		"declaration-bang-space-after": ["never", {
			"message": "感叹号之后不要空格",
			"severity": "warning"
		}],
		"declaration-bang-space-after": ["always", {
			"message": "感叹号之前需要空格",
			"severity": "warning"
		}],
		"declaration-colon-space-after": ["always", {
			"message": "冒号之后需要空格",
			"severity": "warning"
		}],
		"declaration-colon-space-before": ["never", {
			"message": "冒号之前不要空格",
			"severity": "warning"
		}],
		"declaration-colon-newline-after": ["always-multi-line", {
			"message": "声明写为多行时，冒号后需要换行",
			"severity": "warning"
		}],
		"declaration-no-important": [true, {
			"message": "禁用`!important`",
			"severity": "warning"
		}],
		"function-comma-space-after": ["always", {
			"message": "逗号后需要空格",
			"severity": "warning"
		}],
		"function-comma-space-before": ["never", {
			"message": "逗号前不要空格",
			"severity": "warning"
		}],
		"function-comma-newline-after": ["never-multi-line", {
			"message": "逗号后不要换行",
			"severity": "warning"
		}],
		"function-comma-newline-before": ["never-multi-line", {
			"message": "逗号前不要换行",
			"severity": "warning"
		}],
		"function-calc-no-unspaced-operator": [true, {
			"message": "运算符前后需要空格",
			"severity": "warning"
		}],
		"function-linear-gradient-no-nonstandard-direction": [true, {
			"message": "`linear-gradient` 方向声明 [语法错误](https://developer.mozilla.org/zh-CN/docs/Web/CSS/linear-gradient#语法)",
			"severity": "error"
		}],
		"function-max-empty-lines": [0, {
			"message": "不允许空行",
			"severity": "warning"
		}],
		"function-url-quotes": ["always", {
			"message": "url必须用双引号",
			"severity": "warning"
		}],
		"function-whitespace-after": ["always", {
			"message": "函数后需要空格",
			"severity": "warning"
		}],
		"function-parentheses-space-inside": ["never-single-line", {
			"message": "括号内侧不要空格",
			"severity": "warning"
		}],
		"function-parentheses-newline-inside": ["always-multi-line", {
			"message": "括号内应该全部换行或全部不换行",
			"severity": "warning"
		}],
		"indentation": ["tab", {
			"message": "应使用tab缩进",
			"severity": "warning"
		}],
		"max-nesting-depth": [4, {
			"message": "嵌套层级太深",
			"severity": "warning"
		}],
		"no-descending-specificity": [true, {
			"message": "权重小的规则，请放在前部",
			"severity": "warning"
		}],
		"no-duplicate-selectors": [true, {
			"message": "重复的选择器",
			"severity": "warning"
		}],
		"no-empty-source": [true, {
			"message": "不要一整行全是空白",
			"severity": "warning"
		}],
		"no-eol-whitespace": [true, {
			"message": "行尾不要有多余的空格",
			"severity": "warning"
		}],
		"no-extra-semicolons": [true, {
			"message": "重复的分号",
			"severity": "warning"
		}],
		"max-empty-lines": [2, {
			"message": "空行不要超过两行",
			"severity": "warning"
		}],
		"number-no-trailing-zeros": [true, {
			"message": "小数数字不要以0结尾",
			"severity": "warning"
		}],
		"number-leading-zero": ["never", {
			"message": "数字不需要前导0",
			"severity": "warning"
		}],
		"media-feature-colon-space-after": ["always", {
			"message": "冒号之后需要空格",
			"severity": "warning"
		}],
		"media-feature-colon-space-before": ["never", {
			"message": "冒号之前不要空格",
			"severity": "warning"
		}],
		"selector-list-comma-newline-after": ["always", {
			"message": "逗号之后需要换行",
			"severity": "warning"
		}],
		"selector-list-comma-space-before": ["never", {
			"message": "逗号之前不要空格",
			"severity": "warning"
		}],
		"string-quotes": ["double", {
			"message": "字符串所用的引号不对",
			"severity": "error"
		}],
		"value-no-vendor-prefix": [true, {
			"message": "属性值不应使用私有属性前缀",
			"severity": "warning",
		}],
		"property-no-vendor-prefix": [true, {
			"message": "属性名不应使用私有属性前缀",
			"severity": "warning",
		}],
		"selector-no-vendor-prefix": [true, {
			"message": "选择器不应使用私有属性前缀",
			"severity": "warning",
		}],
		"media-feature-name-no-vendor-prefix": [true, {
			"message": "媒体查询不应使用私有属性前缀",
			"severity": "warning",
		}],
		"at-rule-no-vendor-prefix": [true, {
			"message": "@规则不应使用私有属性前缀",
			"severity": "warning",
		}]
	},
};
