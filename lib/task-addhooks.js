"use strict";
const path = require("path");
const fs = require("fs-extra-async");
const getreptype = require("./getreptype");
const addhook = require("./lib-addhook");
const inquirer = require("inquirer");

function choicesDir(dir) {
	return fs.readdirAsync(dir)

	.then(subNames => {
		let dirs = [".."];
		return Promise.all(subNames.map(subName => {
			return fs.statAsync(path.join(dir, subName))

			.then(stat => {
				if (stat.isDirectory()) {
					dirs.push(subName);
				}
			});
		})).then(() => {
			return dirs;
		});
	})

	.then(dirs => {
		return inquirer.prompt({
			type: "list",
			name: "dir",
			message: "当前目录:\t" + dir + "\n\t\t请选择你所要添加hook的项目文件夹",
			paginated: true,
			choices: dirs
		});
	}).then(function(answers) {
		dir = path.join(dir, answers.dir);
		console.log(dir);
		return getreptype(dir);
	}).then(() => {
		return dir;
	}).catch(() => {
		return choicesDir(dir);
	});
}

module.exports = function(gulpfile, dirname) {
	gulpfile = gulpfile || __filename;
	dirname = dirname || __dirname;
	let cmd;

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

	return function() {
		let program = new(require("commander").Command)("gulp hook");

		program
			.option("--src [path]", "项目根目录路径", String, "")

		.parse(process.argv);

		let dir = program.src;
		dir = dir ? Promise.resolve(dir) : choicesDir(path.resolve(".."));

		return dir.then(dirPath => {
			dir = dirPath;

			cmd += " --gulpfile " + path.relative(dir, gulpfile).replace(/\\/g, "/") + " precommit --src " + path.relative(dirname, dir).replace(/\\/g, "/");

			return inquirer.prompt([{
				type: "list",
				name: "html",
				message: "是否弹出HTML格式的代码审查报告？",
				choices: [{
					name: "Yes.",
					value: " --html",
				}, {
					name: "No.",
					value: " --no-html",
				}]
			}, {
				type: "list",
				name: "color",
				message: "是否使用彩色控制台信息？",
				choices: [{
					name: "Yes.",
					value: " --color",
				}, {
					name: "No.",
					value: " --no-color",
				}]
			}]);
		})

		.then((answers) => {
			cmd += answers.html + answers.color;
			return addhook(dir, cmd);
		})

		.then(filePath => {
			console.log(`已创建hook\t${ filePath }\n\t\t${ cmd }`);
		}).catch(ex => {
			console.error(ex);
		});
	};
};