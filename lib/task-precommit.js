"use strict";
// Make sure to read the caveat below.
require("graceful-fs").gracefulify(require("fs"));

const gulp = require("gulp");
const path = require("path");
const gutil = require("gulp-util");
const readyMsg = "project-ready";
const unifiedpath = require("./unifiedpath");

/**
 * 用于gulp 向FELS的GUI，使用网络发送数据
 * @param  {Object} data 可以序列化为JSON的数据
 * @return {Promise}     网络请求的Promise对象
 */
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
let guiClosePromise;

/**
 * 启动gui进程
 * @return {Promise} 进程启动是否成功的Promise对象
 */
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
			gutil.log("您未打开FELS，正在为您打开，请在看完报告后关闭");
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

	let changed = [];
	let report = {};
	let error = [];

	let program = new(require("commander").Command)("gulp precommit");

	program
		.option("--base [path]", "项目根目录路径", String, ".")
		.option("--no-gui [Boolean]", "是否打开GUI展示审查报告", Boolean)

	.parse(process.argv);

	let dir = path.resolve(program.base);

	/**
	 * 将错误添加到代码审查报告中去
	 * @param {Errpr} error        各种类型的Error对象
	 * @return {undefined}
	 */
	function addReport(error) {
		let relativePath
		if (error.relative) {
			relativePath = error.relative;
		} else if (error.report && error.file.relative) {
			relativePath = error.file.relative;
		} else if (error.fileName) {
			relativePath = path.relative(dir, error.fileName);
		} else {
			return;
		}

		relativePath = unifiedpath(relativePath);

		let data = Object.assign({

			// 错误等级
			severity: "error",


		}, error);

		if (report[relativePath]) {
			report[relativePath].unshiht(data);
		} else {
			report[relativePath] = [data];
		}
	}


	return require("./getrepdiff")(dir)

	.then(files => {

		let worker = [];
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

		/**
		 * gulp Vinyl 工厂
		 * @param  {globs} files 用于文件选择的globs对象
		 * @return {Stream}      gulp风格的stream
		 */
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
						inJSON: function(file, errors) {
							let relativePath = unifiedpath(file.relative);
							if (report[relativePath]) {
								report[relativePath].push.apply(report[relativePath], errors);
							} else {
								report[relativePath] = errors;
							}
						},
					} : null))
					.pipe(editorconfig())
					.pipe(gulpIf(file => {
						if (!file.isNull() && String(file.contents).length > 20 && file.changed()) {

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
			changed.forEach(relative => addReport({
				message: "文件已经被自动修复，请审查代码。",
				plugin: "gulp-changed",
				relative,
			}));
			changed = [];
		}


		error.forEach(error => {
			let msg;
			try {
				msg = [`${ gutil.colors.red("Error") } in plugin "${ gutil.colors.cyan(error.plugin) }"\n${ error.message }`];
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

		error = [];

		return client({
			event: "update",
			data: {
				[unifiedpath(dir)]: {
					report
				}
			}
		}).then(() => error);

	})

	.then(error => {
		report = {};

		/**
		 * 完成全部提交后调用
		 * @return {undefined}
		 */
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
