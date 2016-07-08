"use strict";
var path = require("path");
/**
 * 对代码库打tag
 * @param  {String}		dir 版本库所在的文件夹
 * @param  {String}		tag tag名字
 * @return {Promise}	Promise内的值为数组，0为打tag命令的返回信息，1为推送tag的命令的返回信息
 */
module.exports = function(dir, tag) {
	dir = path.resolve(dir);

	return require("./getreptype")(dir)

	.then(repType => {
		var cmds;
		if (repType === "git") {
			// git环境下要运行的命令
			cmds = [
				// 添加tag
				`git tag --force --annotate ${ tag } --message "by FELS"`,
				// 推送tag到服务器端
				"git push --tags --force"
			];
		} else if (repType === "hg") {
			// hg环境下要运行的命令
			cmds = [
				// 添加tag
				`hg tag --force --message "by FELS" ${ tag }`,
				// 推送tag到服务器端
				"hg push --force"
			];
		}

		return cmds.map(cmd => {
			// 运行所有的命令
			return require("child_process").execSync(cmd, {
				cwd: dir
			}).toString();
		});

	});
};
