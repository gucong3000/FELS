"use strict";
var path = require("path");
/**
 * 获取代码库中当前分支最后一次提交的作者
 * @param  {String}		dir 版本库所在的文件夹
 * @return {Promise}	Promise内的值为数组，0为作者名字，1为作者邮箱
 */
module.exports = function getAuthor(dir) {
	dir = path.resolve(dir);
	return require("./getreptype")(dir)

	.then(repType => {
		var cmd;
		if (repType === "git") {
			// git环境下要运行的命令
			// 获取当前分支最后一次的提交用户信息放回数组的json字符串，0是用户名，1是email
			cmd = `git log --pretty=format:"[\\"%aN\\",\\"%aE\\"]" -n 1`;
		} else if (repType === "hg") {
			// hg环境下要运行的命令
			// 获取当前分支最后一次的提交用户信息放回数组的json字符串，0是用户名，1是email，2是原始的作者信息
			cmd = `hg log --rev . --template "[\\"{user(author)}\\",\\"{email(author)}\\", \\"{author}\\"]"`;
		}
		// 将提交信息
		cmd = JSON.parse(require("child_process").execSync(cmd, {
			cwd: dir
		}).toString().trim());

		// hg下特殊处理，因为hg的作者信息只有一个字段，并非分为用户名和邮箱两个字段。检查原始的作者信息格式是否为精确的`name <emai@server.com>`格式
		if (cmd && cmd[2] && !/^.+\s+<\w+([-+.]\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*>$/.test(cmd[2])) {
			// 原始的作者信息不规范时，认为他没有email，删掉
			cmd.length = 1;
		}

		return cmd;
	});
};
