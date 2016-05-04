脚本文件书写规范
=====

## 文件格式 ##

文件编码 UTF-8

换行符 LF (Unix)

> 请在浏览器或IDE中安装与[JS Beautifier](http://jsbeautifier.org/)兼容的代码格式化工具。比如Sublime Text的[JsFormat](https://packagecontrol.io/packages/JsFormat)、[HTMLPrettify](https://github.com/victorporof/Sublime-HTMLPrettify)


## 禁用、慎用的js语句 ##

-   `setTimeout`和`setInterval`函数禁止使用字符串参数

	setTimeout('sortDis()', 1000);	//禁用
	setTimeout(sortDis, 1000);		//推荐

-   eval禁止再当前上下文使用

	var obj = eval(json);			//禁用
	var obj = $.parseJSON(json);	//推荐

	eval(strJs);					//禁用
	$.globalEval(strJs);			//慎用
	eval.call(window, strJs);		//慎用

-   `new Function()` 应该慎用，绝不用在“用户生成内容”
-   `JSON.parse(json)`应该慎用,因为IE6、7下需要依赖额外的js文件，推荐使用`$.parseJSON(json)`替代
-   不得以字符串形式传递函数，如 `checkLoginToDo('fn');`，应直接传递此函数 `checkLoginToDo(fn);`
-   with语句完全禁用
-   尽可能少使用全局变量，应使用模块方式传递信息

## 编码风格规范 ##

-   闭包，无特别需要不要声明全局变量
-   显式声明全局变量 `window.myNum = 0;`
-   对象原型使用帕斯卡命名法，如 `HTMLElement，ValidityState`
-   对象私有成员以下划线开头，例如：`this._name = "Robert";`
-   常量使用大写，单词间使用下划线分隔，例如：`var CLIENT_APP = {};`
-   其他采用骆驼命名法，需描述数据类型时,数据类型前置，如 `var textboxName, textboxPass, strName, strPass`
-   代码块使用java风格：必须用大括号包裹`{}`。左大括号`{`不使用新的一行，其前加入空格，其后另起一行；右大括号`}`单独占一行
-   使用单个var语句声明变量，并放在函数头部。
-   立即调用的匿名函数需要括号包裹，如: `var value = (function() { return {}; })()`
-   相等 `===`，不等`!==`
-   分号`;`不可省略
-   必须使用`"use strict";`。
-   字符串使用双引号包裹
-   注释使用[YUIDoc规范](http://yui.github.io/yuidoc/syntax/index.html)或[jsDoc规范](http://usejsdoc.org/index.html)


## js模块规范

-   必须使用`"use strict";`，声明在文件头部
-   使用CommonJS规范或ES6模块规范
-   使用前端构建工具编译，不要写amd或cmd规范的包裹函数

> 一个兼容旧的未模块化代码的例子

```Javascript
(function($) {
	var self;
	try {
		module.exports = self;
	} catch (e) {
		window.units = self;
	}
})(window.$ || require("jquery"));
```

## 使用JSHint

应使用[JSHint](http://jshint.com/)进行代码审查[详见文档](jshint_config.md)

## 使用[JS Beautifier](http://jsbeautifier.org/)格式化代码