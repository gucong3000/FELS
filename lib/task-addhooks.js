
const path = require("path");
const fs = require("fs-extra-async");
const getreptype = require("./getreptype");
const unifiedpath = require("./unifiedpath");
const precommitFile = formatPath(require.resolve("./task-precommit"));
const gutil = require("gulp-util");

function formatPath(path) {
	path = unifiedpath(path);
	if (/\s+/.test(path)) {
		path = JSON.stringify(path);
	}
	return path;
}

module.exports = function(program) {
	if (!program) {
		program = new(require("commander").Command)("gulp precommit");

		program
			.option("--no-enable [Boolean]", "开启或关闭hook", Boolean)
			.option("--base [path]", "项目根目录路径", String, ".")
			.option("--no-gui [Boolean]", "是否打开GUI展示审查报告", Boolean)
			.option("--color [Boolean]", "是否打开彩色控制台功能", Boolean)
			.parse(process.argv);
	}

	var baseDir = path.resolve(program.base);

	let cmd;
	if (program.enable) {
		cmd = [
			"node",
			precommitFile,
			formatPath(baseDir),
		];

		if ("gui" in program) {
			cmd.push(program.gui ? "--gui" : "--no-gui");
		}
		if ("color" in program) {
			cmd.push(program.color ? "--color" : "--no-color");
		}

		cmd = cmd.join(" ");
	}else {
		cmd = "";
	}

	let hookPath;

	return getreptype(baseDir)

	.then(type => {
		if (type === "git") {
			hookPath = path.join(baseDir, ".git/hooks/pre-commit");
			return fs.outputFile(hookPath, "#!/bin/sh\n" + cmd);
		}else if (type === "hg") {
			let ini = require("ini");

			// 读取hg配置文件
			hookPath = path.join(baseDir, ".hg/hgrc");
			return fs.readFile(hookPath)

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
				return fs.writeFile(hookPath, config);
			});
		}else {
			throw baseDir;
		}
	}).then(() => {
		try {
			require("electron");
		}catch (ex) {
			gutil.log(`已写入hook文件:\t${ hookPath }\n${ cmd }`);
		}

		return hookPath;
	});
};
