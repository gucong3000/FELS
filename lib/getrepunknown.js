"use strict";
var path = require("path");

/**
 * 查找不在代码库控制下控制的文件
 * @param  {String} dir     代码库所在文件夹
 * @param  {String} repType 代码库类型'hg'或'git'
 * @return {Array}   [String]    文件列表数组
 */
module.exports = function(dir) {
	dir = path.resolve(dir);

	return require("./getreptype")(dir)

	.then((repType) => {
		// 运行git或者HG命令
		var cmd;
		if (repType === "git") {
			cmd = "git status --short";
		} else if (repType === "hg") {
			cmd = "hg status --unknown";
		} else {
			// 未来可能扩展其他类型代码库
			return repType;
		}

		// 启动进程获取命令行结果。注意hg下不使用execSync而使用exec，结果会直接输出到控制台，拿不到结果
		var paths = require("child_process").execSync(cmd, {
			cwd: dir
		}).toString().trim().split(/\s*\r?\n\s*/g);

		if (repType === "git") {
			// “git status --short”命令输出的内容有未修改等状态的文件，删除掉，只保留"Untracked files"
			paths = paths.filter(subPath => /^\?+/.test(subPath));
		}

		paths = paths.map(subPath => subPath.replace(/^\?+\s+/, ""));

		return paths;
	});
};
