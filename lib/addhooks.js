"use strict";
var path = require("path");
var fs = require("fs-extra-async");
module.exports = function(gulpfile, dirname) {
	gulpfile = gulpfile || __filename;
	dirname = dirname || __dirname;
	return function() {
		var program = new(require("commander").Command)("gulp precommit");

		program
			.option("--src [path]", "项目根目录路径", String, ".")

		.parse(process.argv);

		var cmd;
		var filePath;

		if (process.env.APPDATA) {
			cmd = path.join(process.env.APPDATA, "npm/gulp.cmd");
			try {
				fs.accessSync(cmd);
				cmd = cmd.replace(/\\/g, "/");
			} catch (ex) {
				cmd = "gulp";
			}
		} else {
			cmd = "gulp";
		}

		cmd += " --gulpfile " + path.relative(program.src, gulpfile).replace(/\\/g, "/") + " precommit --src " + path.relative(dirname, program.src).replace(/\\/g, "/");

		return require("./getreptype")(program.src)

		.then(type => {
			if (type === "git") {
				filePath = path.join(program.src, ".git/hooks/pre-commit");
				return fs.outputFileAsync(filePath, "#!/bin/sh\n" + cmd);
			} else if (type === "hg") {
				var ini = require("ini");

				// 读取hg配置文件
				filePath = path.join(program.src, ".hg/hgrc");
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
				throw program.src;
			}
		}).then(() => {
			console.log(`已创建hook\t${ filePath }\n ${ cmd }`);
		}).catch(ex => {
			if (filePath) {
				console.error("无法修改文件:\t" + filePath);
				console.error(ex);
			} else {
				console.error("项目路径错误:\t" + program.src);
				program.help();
			}
		});
	};
};
