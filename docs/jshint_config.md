[JSHint](http://jshint.com/)
======

[JSHint](http://jshint.com/)是一个由javascript社区驱动开发的用于检查javascript代码错误和问题的工具，有了他，可以使你保持一个良好的编码风格。

## 项目配置文件

### 配置文件

[.jshintignore](../.jshintignore) (忽略文件列表)此文件控制其所在目录及子目录忽略列表

[.jshintrc](../.jshintrc) (配置文件)此文件控制其所在目录及子目录的JSHint规则

### .jshintrc配置详解

```json
{
	//声明浏览器环境
	"browser": true,
	//允许在if，for，while语句中使用赋值
	"boss": true,
	//使用if和while等结构语句时必须加上大括号来明确代码块
	"curly": true,
	//使用===或者是!==，而不是==和!=
	"eqeqeq": true,
	//允许使用"== null"作比较
	"eqnull": true,
	//允许应该出现赋值或函数调用的地方使用表达式
	"expr": true,
	//匿名函数调用，使用(function(){ ... })(); 而不是(function(){ ... }());;
	"immed": true,
	//禁止使用arguments.caller和arguments.callee
	"noarg": true,
	//true表示字符串可以使用单引号和双引号，但必须保持一致，double表示必须使用双引号
	"quotmark": true,
	//所有的非全局变量，在使用前都必须被声明
	"undef": true,
	//变量声明了但不使用会被警告
	"unused": true,
	//必须使用use strict;语法 
	"strict": true,
	//ECMAScript 版本号
	"esversion": 6,
	// 声明 node 运行环境
	"node": true,
	// 不得写入全局变量
	"globals": false
}
```

## 文件局部配置方法

在项目中任意js文件中，可以使用注释的方式指明对当前文件范围内有效的配置

### 覆盖全局配置

```javascript
/* jshint evil:true, boss:true */
```

可供配置的项目可参考[配置详解](#.jshintrc配置详解)

### 声明全局变量

```javascript
/* global DISQUS, CLIENTSTATUS */
```

### 声明要忽略检查的代码

```javascript
// 这里的代码会被JSHint做语法检查
/* jshint ignore:start */
// JSHint根本察觉不到这里有代码的存在
/* jshint ignore:end */
```

## Sublime Text配置

1.  安装插件 [SublimeLinter](https://sublimelinter.readthedocs.org/)
1.  安装插件 [SublimeLinter-jshint](https://packagecontrol.io/packages/SublimeLinter-jshint)
1.  使用以下配置代替原来的：

```JSON
{
	jshintrc: true
}
```

## 参考阅读

* [JSHint 官方文档（英文）](http://www.jshint.com/docs/)
* [JSHint 使用说明（翻译）](http://zhang.zipeng.info/vimwiki/Entries/Reference/Tools/jshint.html)
