"use strict";
const gulp = require("gulp");
const path = require("path");
const gutil = require("gulp-util");
const readyMsg = "project-ready";
const unifiedpath = require("./unifiedpath");

// 用于gulp 向FELS的GUI，使用网络发送数据
function client(data) {
	const net = require("net");
	const PIPE_PATH = process.platform !== "win32" ? "/tmp/FELS.sock" : 8848;
	return new Promise((resolve, reject) => {
		let client = net.createConnection(PIPE_PATH, function() {
			client.end(JSON.stringify(data));
		});
		client.on("data", (data) => {
			data = data.toString();

			try {
				eval(data);
			} catch (ex) {
				console.log(data);
			}
		});
		client.on("end", resolve);
		client.on("error", reject);
		client.on("timeout", reject);
	}).catch(() => {
		return startgui().then(() => client(data));
	});
}

let guiReadyPromise;
let guiClosePromise;

function startgui() {
	if (!guiReadyPromise) {
		const childProcess = require("child_process");
		guiReadyPromise = new Promise((resolve, reject) => {
			const ls = childProcess.execFile(require("electron-prebuilt"), [path.join(__dirname, "gui.js"), "--wait-ready-signal"], (error, stdout, stderr) => {
				if (stderr) {
					console.error(stderr);
				}
				if (error) {
					reject(error);
				}
			});
			guiClosePromise = new Promise(resolve => ls.on("close", resolve));
			ls.stdout.on("data", data => {
				if (data.toString().trim() === readyMsg) {
					resolve(readyMsg);
				}
			});
			console.log("您未打开FELS，正在为您打开，请在看完报告后关闭");
		});
	}
	return guiReadyPromise;
}


module.exports = function(cb) {
	if (process.env.HG_PARENT1 && process.env.HG_PARENT2) {

		// hg在合并代码时，跳过代码审查，git无相关方法，git请使用`--no-verify`参数提交来跳过代码审查
		gutil.log("检测到正在进行代码合并，跳过语法检查。");
		return cb();
	}

	let worker = [];
	let changed = [];
	let report = {};
	let error = [];

	let program = new(require("commander").Command)("gulp precommit");

	program
		.option("--base [path]", "项目根目录路径", String, ".")
		.option("--no-gui [Boolean]", "是否打开GUI展示审查报告", Boolean)

	.parse(process.argv);

	let dir = path.resolve(program.base);

	return require("./getrepdiff")(dir)

	.then(files => {

		files = files.filter(function(path) {

			// 将压缩文件排除
			return !(/[\.\-]min\.\w+$/.test(path));
		});

		let esFiles = files.filter(function(path) {

			// 将js文件单独列出
			return /\.(?:jsx?|es\d?|babel)$/.test(path);
		});

		let jsonFiles = files.filter(function(path) {

			// 将json文件单独列出
			return /(?:(?:^|\/|\\)\.\w+rc|\.json)$/.test(path);
		});

		let cssFiles = files.filter(function(path) {

			// 将css文件单独列出
			return /\.css$/.test(path);
		});

		let txtFiles = files.filter(function(path) {

			// 将其他的文本文件单独列出
			return /\.(svg|txt|md|markdown|html)$/.test(path);
		});

		// let gulpTxtChenged = require("./gulp-text-chenged");
		// let txtChenged = gulpTxtChenged({
		// 	cache: {},
		// });

		function src(files) {
			var plumber = require("gulp-plumber");

			const chenged = require("./gulp-chenged.js");
			return gulp.src(files, {
				allowEmpty: true,
				base: dir,
				cwd: dir,
			})

			.pipe(plumber({
				errorHandler: err => error.push(err)
			}))

			.pipe(chenged({
				cache: {}
			}));

			// .pipe(require("gulp-stripbom")({
			// 	showLog: false,
			// }))

			//
		}

		if (txtFiles && txtFiles.length) {
			worker.push(
				src(txtFiles)
			);
		}

		if (jsonFiles && jsonFiles.length) {
			const jsBeautify = require("./gulp-jsbeautify");
			worker.push(
				src(jsonFiles)
				.pipe(jsBeautify({
					indent_size: 1,
					indent_char: "\t",
					indent_with_tabs: true,
				}))
			);
		}

		if (esFiles && esFiles.length) {

			// jshint检查js文件
			const eslint = require("gulp-eslint");

			worker.push(
				src(esFiles)

				.pipe(eslint({
					fix: true
				}))
			);
		}

		if (cssFiles.length) {

			let postcss = require("./gulp-postcss");

			let processors = [
				require("stylefmt"),
				require("stylelint")({
					configOverrides: {
						rules: {
							indentation: null
						}
					}
				}),
			];
			worker.push(
				src(cssFiles)

				.pipe(postcss(processors))
			);
		}

		if (!worker.length) {
			return cb();
		}

		// 代码审查异步结果处理
		worker = worker.map(stream => {
			return new Promise((resolve, reject) => {
				const reporter = require("./gulp-reporter");

				const gulpIf = require("gulp-if");
				const editorconfig = require("./gulp-editorconfig");
				stream = stream
					.pipe(reporter(program.gui ? {
						inJSON: function(data, file) {
							let relativePath = unifiedpath(file.relative);
							if (report[relativePath]) {
								report[relativePath] = report[relativePath].concat(data);
							} else {
								report[relativePath] = data;
							}
						},
					} : null))
					.pipe(editorconfig())
					.pipe(gulpIf(file => {
						if (!file.isNull() && file.changed()) {

							// if changed, write the file to dest
							changed.push(file.relative);
							return true;
						}
					}, gulp.dest(dir)));

				// `end-of-stream`和`stream-consume`的用法我是从这里抄的，我也不懂，只是照抄：https://github.com/robrich/orchestrator/blob/master/lib/runTask.js
				const eos = require("end-of-stream");
				const consume = require("stream-consume");
				eos(stream, {
					error: true,
					readable: stream.readable,
					writable: stream.writable && !stream.readable
				}, function(err) {
					if (err) {
						reject(stream);
					} else {
						resolve(stream);
					}
				});
				consume(stream);
			});
		});

		return Promise.all(worker);
	})

	.then(() => {

		// gulp运行报错收集流程
		if (changed.length) {

			// 提示修改了的文件
			error.push(new gutil.PluginError("precommit", "以下文件已被自动修正，请检查代码:\t\n" + changed.join(", ")));
		}


		error.forEach(error => {
			let msg;
			try {
				msg = `${ gutil.colors.red("Error") } in plugin "${ gutil.colors.cyan(error.plugin) }"\n${ error.message }`;
			} catch (ex) {
				msg = String(error);
			}

			gutil.log(msg);

			let relativePath;
			if (error.file && error.file.relative) {
				relativePath = error.file.relative;
			} else if (error.fileName) {
				relativePath = path.relative(dir, error.fileName);
			} else {
				return;
			}

			let data = {

				// 错误等级
				severity: error.severity || "error",

				// 行号
				line: error.line || error.lineNumber,

				// 列号
				column: error.column || error.columnNumber,

				// 错误信息
				message: (error.message || error.toString()).replace(/^.+?\w+:\d+:\d+:\s+/, ""),

				// 错误ID
				rule: error.rule,

				// 源代码上下文
				source: error.source || (error.showSourceCode ? error.showSourceCode() : ""),

				// 报错插件
				plugin: error.plugin,
			};
			relativePath = unifiedpath(relativePath);
			if (report[relativePath]) {
				report[relativePath].unshiht(data);
			} else {
				report[relativePath] = [data];
			}
		});
		report = {
			event: "update",
			data: {
				[unifiedpath(dir)]: {
					report
				}
			}
		};

		return client(report).then(() => error);

	})

	.then(error => {
		function done() {

			if (error.length) {
				cb(new gutil.PluginError("precommit", {
					message: "代码提交失败",
					showStack: false
				}));
				process.nextTick(() => {
					process.exit(-1);
				});
			} else {
				cb();
			}
			guiReadyPromise = null;
			guiClosePromise = null;
		}
		if (guiClosePromise) {
			guiClosePromise.then(done);
		} else {
			done();
		}
	});
};
