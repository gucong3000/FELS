FELS
======

Front End Live Stream

FELS为您提供了一套由gulp驱动的动态开发环境，解决团队开发中规范化，模块化，自动化问题

## 安装 ##

1.   安装[Node.js](http://nodejs.org/download/)
1.   在你的工作目录执行以下命令：

```bash
ELECTRON_MIRROR=http://npm.taobao.org/mirrors/electron/
sudo npm config set sass_binary_site https://npm.taobao.org/mirrors/node-sass --global
sudo npm config set phantomjs_cdnurl https://npm.taobao.org/mirrors/phantomjs --global
sudo npm config set registry https://registry.npm.taobao.org --global
sudo npm install -g cnpm --registry=https://registry.npm.taobao.org
sudo cnpm i -g gulp-cli
git clone https://github.com/gucong3000/FELS.git
cd FELS
cnpm i && npm start
```

> windows用户请去掉命令中的`sudo`

> 下文所述的各项命令，均指在`FELS`目录下运行

## [启动web服务](./docs/gulp_server.md) (dev)

```bash
gulp server <options>
```

## 文件部署

```bash
gulp publish <options>
```

按照[样式规范](./docs/style_standard.md)自动修复源文件

## [安装代码库钩子](./docs/gulp_hook.md) (dev)

```bash
gulp hook --src ../path/to/your/project
```

## 更新版本

```bash
git pull
git checkout .
cnpm i
```
