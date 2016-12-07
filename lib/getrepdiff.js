"use strict";
var path = require("path");
/**
 * 利用代码仓库tag，获取最近修改过的文件列表
 * @param  {String} dir 代码仓库所在文件夹
 * @param  {[String]} tag tag名称，此参数留空则会查询待提交的文件
 * @return {Promise}     Promise对象的返回值为 {String[]} 数组
 */
module.exports = function(dir, tag) {
	dir = path.resolve(dir);

	return require("./getreptype")(dir)

	.then((repType) => {
		// 运行git或者HG命令
		var cmd;
		var regSplit = /\s*\r?\n\s*/g;
		if (repType === "git") {
			// git 命令，获取版本差异
			cmd = `git config core.quotepath false && git diff ${ tag || "--cached" } --name-only && git config --unset core.quotepath`;
			// 用于分隔git命令返回数据为数组的正则
		} else if (repType === "hg") {
			if (tag) {
				// hg 命令，获取版本差异
				cmd = `hg diff -r ${ tag } --stat`;
				// 用于分隔hg命令返回数据为数组的正则
				regSplit = /\s+\|\s+(?:\d+\s[+-]+|\w+\s*)\r?\n\s*/g;
			} else {
				// hg 命令，获取等待提交的文件
				cmd = "hg status --modified --added --no-status";
			}
		} else {
			// 未来可能扩展其他类型代码库
			return repType;
		}

		// 启动进程获取命令行结果。注意hg下不使用execSync而使用exec，结果会直接输出到控制台，拿不到结果
		var files = require("child_process").execSync(cmd, {
			cwd: dir
		});

		if (repType === "hg") {
			// hg输出的信息需要进行中文转码
			files = require("iconv-lite").decode(files, "GBK");
		}

		files = files.toString().trim();

		if (repType === "hg") {
			// hg的输出结果有`2228 files changed, 61157 insertions(+), 1857 deletions(-)`这样一行，删掉
			files = files.replace(/\n*\s+\d+\s+files\s+changed,\s+\d+\s+insertions\(\+\),\s+\d+\s+deletions\(-\)\s*\n*/, "\n");
		}

		files = files.split(regSplit);

		files = files.filter(Boolean);

		return files;
	});
};
