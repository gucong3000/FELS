gulp server `<options>`
=====

开发用web服务器

## 功能

-   文件动态编译 (dev)
	- css next 支持 (beta)
	- css 自动 hack (dev)
	- css格式化 (beta)
	- css规范化 (beta)
	- css压缩 (beta)
	- css自动私有前缀 (release)
	- css错误浏览器端提示 (dev)
	- js模块化 (beta)
	- js格式化 (beta)
	- js规范化 (beta)
	- js压缩 (release)
	- js错误浏览器端提示 (beta)
-   浏览器自动刷新 (bug)
-   SEO服务器端预渲染模式 (beta)
-   combo方式文件请求合并 (beta)
-   简单的翻墙服务 (release)
-   文件回源、线上文件映射本地调试 (release)
-   http/2协议下开发 (release)

## 启动命令

```bash
  Usage: gulp fix [options]
  Options:
    --env [development]       服务器运行环境，默认`development`
    --path [path]             服务器根目录
    --port [Number|path]      监听端口号，或者unix套接字, 默认`80`
    --reporter [Number|path]  是否打开客户端代码错误汇报
```