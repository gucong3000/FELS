为项目安装Jenkins的hook
=====

为了方便对Jenkins的调用，不用每次push代码后都去Jenkins服务器点击“构建”，可以使用本工具，为项目安装hook，让你每次pull代码后，Jenkins自动执行构建。此项功能同时支持git或hg仓库

## 方法1：通过本工具安装hook

```bash
gulp Jenkins --url http://your.jenkins.server --path /path/to/your/project
```
其中url在聚美中使用  `http://fe.int.jumei.com`
> `--url`后面请填写你的Jenkins服务器地址`--path`后面填写你要安装hook的项目的本地路径

## 使用

日后正常push代码即可，无需特别进行特殊操作
