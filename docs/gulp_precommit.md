[提交前代码审查](./gulp_precommit.md)
====

本功能一般不直接在命令行下使用，应借助 [gulp hook](./gulp_hook.md) 命令安装为项目钩子使用

本功能的调用命令

```bash
gulp precommit --src ../path/to/your/project
```

业务逻辑介绍

1.  获取将要提交至代码库的文件
1.  按文件类型，分别进行代码审查
	* .js .es6 .jsx .babel，将执行 [eslint](http://cn.eslint.org/) 并尝试自动修正代码
1.  显示审查报告
	* Windows版本 TortoiseHg 中将同时弹出存放报告的文本文件，以便解决乱码问题。
1.  如果有文件审查不过，则中断提交行为