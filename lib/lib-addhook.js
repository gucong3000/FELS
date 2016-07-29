"use strict";
const path = require("path");
const fs = require("fs-extra-async");
const getreptype = require("./getreptype");

module.exports = function(dir, cmd) {
	let filePath;
	return getreptype(dir)

	.then(type => {
		if (type === "git") {
			filePath = path.join(dir, ".git/hooks/pre-commit");
			return fs.outputFileAsync(filePath, "#!/bin/sh\n" + cmd);
		} else if (type === "hg") {
			let ini = require("ini");

			// 读取hg配置文件
			filePath = path.join(dir, ".hg/hgrc");
			return fs.readFileAsync(filePath)

			.then(contents => ini.parse(contents.toString()))

			.then(config => {

				// 配置文件中已有Jenkins触发命令
				if (config.hooks && config.hooks["precommit.fels"] === cmd) {
					return cmd;
				}

				config.hooks = Object.assign(config.hooks || {}, {
					"precommit.fels": cmd,
				});

				// 将对象转换为ini文件格式的字符串
				config = ini.stringify(config, {
					whitespace: true
				});

				// 写入hg配置文件
				return fs.writeFileAsync(filePath, config);
			});
		} else {
			throw dir;
		}
	}).then(() => {
		return filePath;
	});
};
