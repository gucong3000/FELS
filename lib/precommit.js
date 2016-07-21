"use strict";
const gulp = require("gulp");
const gutil = require("gulp-util");

module.exports = function(cb) {
	if (process.env.HG_PARENT1 && process.env.HG_PARENT2) {

		// hg在合并代码时，跳过代码审查，git无相关方法，git请使用`--no-verify`参数提交来跳过代码审查
		gutil.log("检测到正在进行代码合并，跳过语法检查。");
		return cb();
	}

	let worker = [];
	let changed = [];
	let report = [];
	let error = [];

	let program = new(require("commander").Command)("gulp precommit");

	program
		.option("--src [path]", "项目根目录路径", String, ".")
		.option("--no-html [Boolean]", "是否展示HTML格式的审查报告", Boolean)

	.parse(process.argv);

	return require("./getrepdiff")(program.src)

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
			return /(?:(?:^|\/|\\).\w+rc|\.json)$/.test(path);
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
				base: program.src,
				cwd: program.src,
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
				require("stylelint"),
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
					.pipe(reporter({
						inHTML: program.html ? function(HTML) {
							report.push(HTML);
						} : null,
					}))
					.pipe(editorconfig())
					.pipe(gulpIf(file => {
						if (!file.isNull() && file.changed()) {

							// if changed, write the file to dest
							changed.push(file.relative);
							return true;
						}
					}, gulp.dest(program.src)));

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

		// gulp运行结果手机流程

		worker = [];

		if (report.length) {

			// html格式错误报告生成
			const fs = require("fs-extra-async");
			worker.push(

				// 读取html模板
				fs.readFileAsync("./markdown.html")

				.then(html => {

					// 模板内容替换
					html = html.toString();
					html = html.replace(/(<title>)\s*(<\/title>)/i, "$1错误审查报告$2");
					html = html.replace(/(<div class="row">\n*)\s*(\n*<\/div>)/i, (s, begin, end) => {
						return begin + report.join("") + end;
					});

					// HTML保存为文件
					return fs.outputFileAsync("./report.html", html);
				})

				.then(() => {

					// 运行HTML
					const path = require("path");
					let fileUrl = path.resolve("./report.html").replace(/\\/g, "/").replace(/^\/?/, "file:///");

					return new Promise((resolve, reject) => {
						let open = require("open");
						open(fileUrl, (err, stdout, stderr) => {
							if (err) {
								reject(stderr || stdout);
							} else {
								resolve(stdout || stderr);
							}
						});
					});
				})
			);
		}
		if (changed.length) {

			// 提示修改了的文件
			worker.push(
				gutil.log("File changed:\t" + changed.join(", "))
			);
		}
		if (error.length) {

			// plumber收集的错误，集中显示
			worker.push(
				error.forEach(err => {
					if (!err) {
						return;
					}
					let msg;
					try {
						msg = `${ gutil.colors.red("Error") } in plugin "${ gutil.colors.cyan(err.plugin) }"\n${ err.message }`;
					} catch (ex) {

						msg = String(err);
					}

					gutil.log(msg);
				})
			);
		}
		if (!worker.length) {
			return;
		}
		return Promise.all(worker);
	})

	.then(worker => {

		if (worker) {
			process.nextTick(() => {
				process.exit(1);
			});
			cb(new gutil.PluginError("precommit", {
				message: "代码提交失败",
				showStack: false
			}));
		} else {
			cb();
		}
	});
};
