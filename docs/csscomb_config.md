[CSScomb](http://csscomb.com/)
=====

## 项目配置文件

### 配置文件

[.csscomb.json](../.csscomb.json) 此文件控制其所在目录及子目录的CSScomb规则

### .csscomb.json配置详解

```JSON
{
	// 最后一个属性后是否添加封号
	"always-semicolon": true,
	// 代码块缩进字符，包括媒体查询和套式规则。
	"block-indent": "\t",
	// 统一颜色大小写
	"color-case": "lower",
	// 使用颜色的缩写
	"color-shorthand": true,
	// 元素选择器的大小写
	"element-case": "lower",
	// 文件结尾添加或删除空行
	"eof-newline": true,
	// 要排除的文件
	"exclude": [
		".hg/**",
		".git/**",
		"node_modules/**",
		"bower_components/**"
	],
	// 添加或删除前导0
	"leading-zero": false,
	// 引号风格
	"quotes": "double",
	// 删除空的规则
	"remove-empty-rulesets": true,
	// 默认排序方式
	"sort-order-fallback": "abc",
	// 规则中`:`后的字符
	"space-after-colon": " ",
	// `>`之后的字符(如`p > a`)
	"space-after-combinator": " ",
	// 在`{`之后的字符
	"space-after-opening-brace": "\n",
	// 选择符中`,`之后的字符
	"space-after-selector-delimiter": "\n",
	// `}`之后的字符
	"space-before-closing-brace": "\n",
	// `:`之前的字符
	"space-before-colon": "",
	// `>`之前的字符(如`p > a`)
	"space-before-combinator": " ",
	// `{`之前的字符。
	"space-before-opening-brace": " ",
	// 选择符中`,`之前的字符
	"space-before-selector-delimiter": "",
	// 每个属性的之间的分隔符
	"space-between-declarations": "\n",
	// 去除多余的空白字符
	"strip-spaces": true,
	// tab的大小
	"tab-size": 4,
	// 取值为0时删除单位
	"unitless-zero": true,
	// 为私有属性前缀对齐
	"vendor-prefix-align": false,
}
```

## 编辑器插件支持
-   [CSScomb for Sublime Text](https://packagecontrol.io/packages/CSScomb)
-   [brackets-csscomb](https://github.com/i-akhmadullin/brackets-csscomb)

## 参考阅读
-   [CSScomb 官方文档（英文）](https://github.com/csscomb/csscomb.js/blob/master/doc/options.md)
