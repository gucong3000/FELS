"use strict";
var path = require("path");
var fs = require("fs-extra-async");
var repTypeCache = {};

/**
 * 获取本地文件夹个代码仓库类型
 * @param  {String} dir 文件夹路径
 * @return Promise     Promise对象的返回值为的"git"或"hg"
 */
module.exports = function(dir) {
	var repType = repTypeCache[dir];

	if (!repType) {
		repType = fs.statAsync(path.join(dir, ".git"))

		.then(stat => {
			if (stat.isDirectory()) {
				return "git";
			} else {
				throw new Error("不是git项目");
			}
		})

		.catch(() => {
			return fs.statAsync(path.join(dir, ".hg"))

			.then(stat => {
				if (stat.isDirectory()) {
					return "hg";
				} else {
					throw new Error("不是hg项目");
				}
			});

		});
		repTypeCache[dir] = repType;
	}
	return repType;
};
