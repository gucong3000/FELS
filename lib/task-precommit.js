"use strict";
// Make sure to read the caveat below.
require("./lib-envpath");
require("graceful-fs").gracefulify(require("fs"));

const gulp = require("gulp");
const path = require("path");
const gutil = require("gulp-util");
const child_process = require("child_process");

/**
 * 用于gulp 向FELS的GUI，使用网络发送数据
 * @param  {Object} data 可以序列化为JSON的数据
 * @return {Promise}     网络请求的Promise对象
 */
function client(data) {
	const net = require("net");
	const PIPE_PATH = process.platform !== "win32" ? "/tmp/FELS.sock" : 8848;
	return new Promise((resolve, reject) => {
		const client = net.createConnection(PIPE_PATH, function() {
			client.end(JSON.stringify(data));
		});
		client.on("data", (data) => {
			data = data.toString();

			try {
				eval(data);
			} catch (ex) {
				gutil.log(data);
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

/**
 * @return {Promise} 进程启动是否成功的Promise对象
 */
function startgui() {
	if (!guiReadyPromise) {
		gutil.log("您未打开FELS，正在为您打开。");
		guiReadyPromise = new Promise((resolve, reject) => {
			child_process.fork(require.resolve("../bin/fels")).on("exit", code => (code ? reject : resolve)(code));
		}).then(() => {
			gutil.log("已成功打开FELS");
		});
	}
	return guiReadyPromise;
}

function task(cb) {
	if (process.env.HG_PARENT1 && process.env.HG_PARENT2) {
		// hg在合并代码时，跳过代码审查，git无相关方法，git请使用`--no-verify`参数提交来跳过代码审查
		gutil.log("检测到正在进行代码合并，跳过语法检查。");
		return cb();
	}

	let changed = [];
	let report = {};
	let error = [];

	const argBasePos = process.argv.indexOf("--base");
	const program = {
		gui: process.argv.indexOf("--no-gui") < 0,
		base: (argBasePos < 0 ? process.argv[2] : process.argv[argBasePos + 1]) || ".",
	};

	try {
		process.chdir(program.base);
	} catch (ex) {
		program.base = ".";
	}

	const dir = path.resolve(program.base);

	/**
	 * 将错误添加到代码审查报告中去
	 * @param {Errpr} error        各种类型的Error对象
	 * @return {undefined}
	 */
	function addReport(error) {
		let relativePath;
		if (error.file && error.file.relative) {
			relativePath = error.file.relative;
		} else if (error.fileName || error.file) {
			relativePath = path.relative(dir, error.fileName || error.file);
		} else {
			return;
		}

		const data = Object.assign({

			// 错误等级
			severity: "error",


		}, error);

		if (report[relativePath]) {
			report[relativePath].unshift(data);
		} else {
			report[relativePath] = [data];
		}
	}

	return require("./getrepdiff")(dir)

	.then(files => {
		changed = [];
		report = {};
		error = [];

		let worker = [];
		files = files.filter(function(path) {
			// 将压缩文件排除, 隐藏文件排除（proj/.vscode/launch.json）
			report[path] = null;
			return !(/[\.\-]min\.\w+$/.test(path)) && !/(?:^|\/)\./.test(path);
		});

		const esFiles = files.filter(function(path) {
			// 将js文件单独列出
			return /\.(?:jsx?|es\d*|babel)$/.test(path);
		});

		const jsonFiles = files.filter(function(path) {
			// 将json文件单独列出
			return /(?:(?:^|\/|\\)\.\w+rc|\.json)$/.test(path);
		});

		const cssFiles = files.filter(function(path) {
			// 将css文件单独列出
			return /\.css$/.test(path);
		});

		const txtFiles = files.filter(function(path) {
			// 将其他的文本文件单独列出
			return /\.(svg|txt|md|markdown|html)$/.test(path);
		});

		// let gulpTxtChenged = require("./gulp-text-chenged");
		// let txtChenged = gulpTxtChenged({
		// 	cache: {},
		// });

		/**
		 * gulp Vinyl 工厂
		 * @param  {globs} files 用于文件选择的globs对象
		 * @return {Stream}      gulp风格的stream
		 */
		function src(files) {
			const plumber = require("gulp-plumber");

			const chenged = require("./gulp-chenged.js");
			return gulp.src(files, {
				allowEmpty: true,
				base: dir,
				cwd: dir,
			})

			.pipe(plumber({
				errorHandler: err => error.push(err),
			}))

			.pipe(chenged({
				cache: {},
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

		if (esFiles && esFiles.length) {
			// jshint检查js文件
			const eslint = require("gulp-eslint");

			worker.push(
				src(esFiles)

				.pipe(eslint({
					fix: true,
				}))
			);
		}

		if (cssFiles.length) {
			const postcss = require("gulp-postcss");

			worker.push(
				src(cssFiles)

				.pipe(postcss([
					require("stylefmt"),
					require("stylelint"),
				]))
			);
		}

		if (jsonFiles && jsonFiles.length) {
			const stable = require("./gulp-json-stable");
			worker.push(
				src(jsonFiles)
				.pipe(stable({
					space: "\t",
				}))
			);
		}

		if (!worker.length) {
			return;
		}

		// 代码审查异步结果处理
		worker = worker.map(stream => {
			return new Promise((resolve, reject) => {
				const reporter = require("./gulp-reporter");

				const gulpIf = require("gulp-if");
				const editorconfig = require("./gulp-editorconfig");
				stream = stream
					.pipe(reporter(program.gui ? {
						inJSON(file, errors) {
							const relativePath = file.relative;
							if (report[relativePath]) {
								report[relativePath].push.apply(report[relativePath], errors);
							} else {
								report[relativePath] = errors;
							}
						},
					} : null))
					.pipe(editorconfig())
					.pipe(gulpIf(file => {
						if (!file.isNull() && !file.report.ignore && file.changed()) {
							// HG 的提交，不涉及“暂存”的概念，所以不需要特别处理修改过的文件
							if (!process.env.HG_PARENT1) {
								changed.push(file);
							}
							return true;
						}
					}, gulp.dest(dir)));

				// `end-of-stream`和`stream-consume`的用法我是从这里抄的，我也不懂，只是照抄：https://github.com/robrich/orchestrator/blob/master/lib/runTask.js
				const eos = require("end-of-stream");
				const consume = require("stream-consume");
				eos(stream, {
					error: true,
					readable: stream.readable,
					writable: stream.writable && !stream.readable,
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
			// GIT下需要提示修改了的文件，以便用户将修改加入GIT提交
			error.push(new gutil.PluginError("precommit", "以下文件已被自动修正，请检查代码:\t\n" + changed.map(file => file.relative).join(", ")));
			changed.forEach(file => addReport({
				message: "文件已经被自动修复，请审查代码，并将修改后的文件添加入暂存。",
				plugin: "gulp-changed",
				file,
			}));
			changed = [];
		}


		error.forEach(error => {
			let msg;
			try {
				msg = [`${gutil.colors.red("Error")} in plugin "${gutil.colors.cyan(error.plugin)}"\n${error.message}`];
				if (error.showSourceCode) {
					msg.push(error.showSourceCode());
				} else if (error.source) {
					msg.push(error.source);
				}

				if (error.stack) {
					msg.push(error.stack);
				} else if (error.fileName || (error.fileName = error.file)) {
					let pos = "\tat " + error.fileName;
					if (error.lineNumber || (error.lineNumber = error.line)) {
						pos += ":" + error.lineNumber;
						if (error.columnNumber || (error.columnNumber = error.column)) {
							pos += ":" + error.columnNumber;
						}
					}
					msg.push(pos);
				}
				msg = msg.join("\n");
			} catch (ex) {
				msg = String(error);
			}

			gutil.log(msg);
			addReport(error);
		});

		if (program.gui) {
			return client({
				event: "update",
				data: {
					[dir]: {
						report,
					},
				},
			}).then(() => error);
		} else {
			return error;
		}
	})

	.then(error => {
		if (error.length) {
			process.exitCode = process.exitCode || error.length;
			cb(new gutil.PluginError("precommit", {
				message: "代码提交失败",
				showStack: false,
			}));
		} else {
			cb();
		}
	});
}

module.exports = task;

if (process.mainModule.filename === __filename) {
	gutil.log(`Starting ${ gutil.colors.cyan("precommit") }`);
	task(() => gutil.log(`Finished ${ gutil.colors.cyan("precommit") }`));
}
