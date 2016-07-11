gulp fix `<options>`
=====

代码自动修复功能

> 当你处理从箱底翻出的老代码时，可使用此功能将代码转换成现代格式

## 功能

-   CSS代码修复功能
-   CSS自动格式化功能

## 启动命令

```bash
gulp fix --src src/my.css
gulp fix --src src/**/*.less --dest /fixedsrc/
```

css、less、sass等文件会按照[样式规范](./docs/style_standard.md)自动修复
