样式文件书写规范
====

## 文件格式 ##

IDE或编辑器中，需要支持 [.editorconfig](../.editorconfig) 配置文件，如 Sublime Text 需要安装插件 [EditorConfig](https://packagecontrol.io/packages/EditorConfig)

## 禁用的css语句 ##

- `!important` 除非为了覆盖不可修正的第三方js生成的行内样式，否则禁用
- `z-index` 在调整DOM顺序可实现预期效果时禁用。取值慎重，避免很大的数值。

## 代码格式 ##

- 缩进每条属性
- 每条属性使用单独一行
- 左大括号`{`不使用新的一行，其前加入空格，其后另起一行；右大括号`}`单独占一行
- 每条选择器独占一行，使用逗号分隔

范例：
```CSS
.myShortStyle {
	Color: #000;
}
.myLongStyle1,
.myLongStyle2 {
	padding: 5px 10px;
	background: #F0F0F0;
	line-height: 1.5;
	border-top: 1px solid #FFF;
}
```

## 编码风格规范 ##

-   尽量避免使用css expection，除非没有可供选择的方案
-   优先使用W3C的下一代CSS标准方式完成css，而非sass或less
-   css选择符号层级不可过多，务必控制在4级以内，如果使用tag选择符，可适当多用一级，例如：`.layer1 .layer4 { color:blue; }` 优于 `.layer1 .layer2 .layer3 .layer4 { color:blue; }`
-   css的规则嵌套尽可能不超过两层，以避免生成过于详尽的选择符，子对象为tag选择符时，可适当多用1层
-   css命名只允许使用小写字母、短横线、数字
-   单词尽量避免采用缩写的形式，除非是已经被公认的缩写，例如：`.route-list{}`不能缩写成`.rlist{}`，而`.application-wrapper{}`可以写成`.app-wrap{}`；原则是保持可读性
-   较为常见的class名，如`top-list，top-nav`，应写写在父元素下，以免与他人css冲突，或者迫使他人使用更长的class名字，如`.order-page .top-nav, .order-page top-list`
-   必要时为html根元素增加顶级class，例如：`<html class="lang-tw order-page">`
-   CSS3各浏览器私有前缀在源文件中不写，在编译阶段使用autoprefixer自动控制
-   z-index滥用超大的数值，应尽量避免使用z-index，非用不可时，1-10用于页面布局，100-110用于浮动元素，1000-1100用于对话框
-   代码段前后使用注释说明用途

## 扩展工具

-   [stylelint - 代码风格审查](stylelint_config.md)
-   [CSScomb - 代码格式化](csscomb_config.md)
