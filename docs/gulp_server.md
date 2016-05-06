gulp server `<options>`
=====

开发用web服务器

## 功能

-   [文件动态编译 (dev)](#文件动态编译)
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
    - js sourceMapping (release)
-   [浏览器自动刷新 (bug)](#浏览器自动刷新)
-   [SEO服务器端预渲染模式 (beta)](#seo服务器端预渲染模式)
-   [concat文件请求合并 (beta)](#concat文件请求合并)
-   [jsHint报错查询 (beta)](#jshint报错查询)
-   [markdown文档查看 (dev)](#markdown文档查看)
-   [简单的翻墙服务 (release)](#简单的翻墙服务)
-   [文件回源、线上文件映射本地调试 (release)](#文件回源线上文件映射本地调试)
-   [http/2协议下开发 (release)](#http2协议下开发)

## 启动命令

```bash
  Usage: gulp server [options]
  Options:
    --env [development]       服务器运行环境，默认`development`
    --path [path]             服务器根目录
    --port [Number|path]      监听端口号，或者unix套接字, 默认`80`/`443`
    --reporter [Number|path]  是否打开客户端代码错误汇报，默认
    --dns [ip]                回源功能使用的DNS服务器
```
## 功能详解

### 文件动态编译

有待完善

### 浏览器自动刷新

让浏览器打开页面后，在编辑器修改源代码时，浏览器自动刷新css或刷新整个页面，无需做任何配置，即开即用

### SEO服务器端预渲染模式

对来自搜索引擎的请求，使用`PhantomJS`浏览器预渲染页面后输出，本地debug可使用URL参数`_escaped_fragment_`来替换hash。此参数是[google的约定](https://developers.google.com/webmasters/ajax-crawling/docs/specification)

### concat文件请求合并

类似于apache中的mod_concat模块，用于合并多个文件在一个响应报文中。
请求参数需要用两个问号（'??'）例如：

```
http://example.com/??style1.css,style2.css,foo/style3.css
```

参数中某位置只包含一个‘?’，则'?'后表示文件的版本，例如：

```
http://example.com/??style1.css,style2.css,foo/style3.css?v=102234
```

前端支持：[seajs-combo](https://github.com/seajs/seajs-combo/issues/3)
后端支持：[Tengine](http://tengine.taobao.org/),  [nginx-http-concat](https://github.com/alibaba/nginx-http-concat)

### jsHint报错查询

查询 jsHint常见错误信息中文翻译、实例。如：

```
http://127.0.0.1/jshint/W019
```

### markdown文档查看

有待完善

### 简单的翻墙服务

解决google api服务被翻，导致N多国外网站打开缓慢的问题，修改hosts文件即可

```HOSTS
127.0.0.1	fonts.googleapis.com	ajax.googleapis.com
```

### 文件回源、线上文件映射本地调试

将要调试的线上网站主机名，写入本地hosts

```HOSTS
127.0.0.1 a3.jmstatic.com	a4.jmstatic.com
```

启动命令中需加入`--dns xx.xx.xx.xx`，即dns服务器地址

```bash
gulp server --path ../work --dns 192.168.0.1
```

本地文件路径与线上有差异，需要映射的，可以修改配置文件[config/pathmap.js](../config/pathmap.js)

### http/2协议下开发

`ssl.key`, `ssl.crt`, `ssl.crt`
将这三个文件放进FELS所在目录下的`ssl`目录中，重启服务，然后使用https协议访问本地环境即可