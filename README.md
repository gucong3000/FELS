FELS
======

Front End Live Stream

FELS为您提供了一套由gulp驱动的动态开发环境，解决团队开发中规范化，模块化，自动化问题

## 安装 ##

1.   安装[Node.js](http://nodejs.org/download/),安装后可能需要重启电脑
1.   命令行运行 `npm install -g gulp`
1.   解压 [master.zip](https://github.com/gucong3000/FELS/archive/master.zip) 任意空白目录
1.   在此目录运行命令`npm install`

>   在国内安装时，**强烈建议**执行以下命令，使用国内镜像安装：

```bash
npm config set registry https://registry.npm.taobao.org --global
npm config set disturl https://npm.taobao.org/dist --global
npm config set sass_binary_site https://npm.taobao.org/mirrors/node-sass --global
npm config set phantomjs_cdnurl https://npm.taobao.org/mirrors/phantomjs --global
```

## [启动web服务](./docs/gulp_server.md) (dev)

```bash
gulp server <options>
```

## 文件部署

```bash
gulp publish <options>
```

## [文件自动修复](./docs/gulp_fix.md) (beta)

```bash
gulp fix --src path/to/your/js
```

按照[样式规范](./docs/style_standard.md)自动修复源文件

## [安装代码库钩子](./docs/gulp_hook.md) (dev)

```bash
gulp hook --src ../path/to/your/project
```
