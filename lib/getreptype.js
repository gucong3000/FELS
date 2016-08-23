"use strict";
let path = require("path");
let fs = require("fs-extra-async");
let repTypeCache = {};

function isDir(dir) {
	return fs.statAsync(dir)

	.then(stat => {
		return stat.isDirectory();
	})

	.catch(() => false);
}

/**
 * 获取本地文件夹个代码仓库类型
 * @param  {String} dir 文件夹路径
 * @return {Promise}     Promise对象的返回值为的"git"或"hg"
 */
module.exports = function(dir) {
	let repType = repTypeCache[dir];

	if (!repType) {

		repType = isDir(path.join(dir, ".git"))

		.then(isGit => {
			if (isGit) {
				return "git";
			} else {
				return isDir(path.join(dir, ".hg"))

				.then(isHg => {
					if (isHg) {
						return "hg";
					} else {
						return "unknow";
					}
				});
			}
		});
		repTypeCache[dir] = repType;
	}
	return repType;
};
