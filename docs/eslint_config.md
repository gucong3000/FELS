[ESLint](http://cn.eslint.org/) 配置
======

可组装的JavaScript和JSX检查工具

## 配置方法

[.eslintignore](http://cn.eslint.org/docs/user-guide/configuring#ignoring-files-and-directories) (忽略文件列表)此文件控制其所在目录及子目录忽略列表

[.eslintrc.js](http://cn.eslint.org/docs/user-guide/configuring#comments-in-configuration-files) (配置文件)此文件控制其所在目录及子目录的JSHint规则

[全局变量声明](http://cn.eslint.org/docs/user-guide/configuring#disabling-rules-with-inline-comments)

[文件内部规则配置](http://cn.eslint.org/docs/user-guide/configuring#configuring-rules)

[文件内容局部忽略](http://cn.eslint.org/docs/user-guide/configuring#disabling-rules-with-inline-comments)

[ESLint 规则详解](http://cn.eslint.org/docs/rules/)


## ID中使用

大多数IDE都需要你的系统里全局安装或者项目中安装[ESLint](http://cn.eslint.org/)才能正常使用相关插件

全局安装：

```
cnpm i -g eslint
```

项目中安装（项目根目录运行）：

```
cnpm i eslint
```
### Sublime Text配置

1.  安装插件 [SublimeLinter](https://sublimelinter.readthedocs.org/)
1.  安装插件 [SublimeLinter-contrib-eslint](https://packagecontrol.io/packages/SublimeLinter-contrib-eslint)

### Atom 插件配置

在命令行运行运行如下命令即可安装 [linter-eslint](https://atom.io/packages/linter-eslint) 插件

```bash
apm install linter-eslint
```

## 参考配置文件

初次使用时，请将 [.eslintrc.js](../.eslintrc.js) 拷贝到项目根目录
