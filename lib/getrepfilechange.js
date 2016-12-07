"use strict";
var path = require("path");
/**
 * 利用代码仓库tag，获取最近修改过的文件列表
 * @param  {String} dir 代码仓库所在文件夹
 * @param  {String} file tag名称，此参数留空则会查询待提交的文件
 * @return {Promise}     Promise对象的返回值为 {String[]} 数组
 */
module.exports = function(dir, file) {
	dir = path.resolve(dir);
	// file = path.resolve(file);

	return require("./getreptype")(dir)

	.then((repType) => {
		// 运行git或者HG命令
		var cmd;
		if (repType === "git") {
			// git 命令，获取文件未提交差异
			cmd = `git diff --color "${ file }"`;
		} else if (repType === "hg") {
			// hg 命令，获取文件未提交差异
			cmd = `hg diff "${ file }"`;
		} else {
			// 未来可能扩展其他类型代码库
			return repType;
		}

		// 启动进程获取命令行结果。注意hg下不使用execSync而使用exec，结果会直接输出到控制台，拿不到结果
		return require("mz/child_process").exec(cmd, {
			cwd: dir
		}).then(result => {
			let currIndex;
			let blockStart;
			let diff = [];
			result[0].toString().split(/\r?\n/).forEach(function(line) {
				// 查找每个差异块
				if (/^(?:\u001b\[\d+m)?@@\s+-\d+,\d+\s+(\+\d+),\d+\s+@@(?:\u001b\[m)?(.*)$/.test(line)) {
					blockStart = +RegExp.$1;
					currIndex = 0;
					line = RegExp.$2;
					if(line) {
						blockStart--;
					} else {
						return;
					}
				}
				// 如果此行不属于任何差异块，或者属于删除了的行，则忽略
				if (typeof blockStart === "undefined" || /^(?:\u001b\[\d+m)?\-/.test(line)) {
					return;
				} else if(/^(?:\u001b\[\d+m)?\+/.test(line)) {
					// 如果是增加了的行则保存其行号
					diff.push(blockStart + currIndex);
				}
				// 遍历下一行
				currIndex++;
			});
			return diff;
		});
	});
};
