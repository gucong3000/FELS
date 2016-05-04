FELS
======

Front End Live Stream

FELS为您提供了一套由gulp驱动的动态开发环境，解决团队开发中规范化，模块化，自动化问题

## 安装 ##

1.   安装[Node.js](http://nodejs.org/download/),安装后可能需要重启电脑
1.   命令行运行 `npm install -g gulp`
1.   解压 [master.zip](https://github.com/gucong3000/build-script/archive/master.zip) 到项目根目录
1.   运行`npm install`

>   由于众所周知的网络原因，从npm官方源拖代码时会遇上麻烦。请先将npm仓库源替换为国内镜像：

```shell
npm config set registry https://registry.npm.taobao.org
npm config set disturl https://npm.taobao.org/dist
npm config set phantomjs_cdnurl https://npm.taobao.org/dist/phantomjs
```

## 启动web服务(dev)

```shell
node server.js
```

## 文件部署

```shell
gulp publish <options>
```

## 文件自动修复(beta)

```shell
gulp fix <options>
```
按照[CSS规范](./docs/style_standard.md)或者[JS规范](./docs/script_standard.md)自动修复源文件

> 功能名称后的括号内，代表该功能目前开发状态