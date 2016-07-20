"use strict";
const gulp = require("gulp");

module.exports = function(cb) {
	if (process.env.HG_PARENT1 && process.env.HG_PARENT2) {

		// hg在合并代码时，跳过代码审查，git无相关方法，git请使用`--no-verify`参数提交来跳过代码审查
		console.log("检测到正在进行代码合并，跳过语法检查。");
		return cb();
	}

	let program = new(require("commander").Command)("gulp precommit");

	program
		.option("--src [path]", "项目根目录路径", String, ".")

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

		let result = [];
		let changed = [];

		// let gulpTxtChenged = require("./gulp-text-chenged");
		// let txtChenged = gulpTxtChenged({
		// 	cache: {},
		// });

		function src(files) {
			const chenged = require("./gulp-chenged.js");
			return gulp.src(files, {
				allowEmpty: true,
				base: program.src,
				cwd: program.src,
			})

			.pipe(chenged({
				cache: {}
			}));

			// .pipe(require("gulp-stripbom")({
			// 	showLog: false,
			// }))

			//
		}

		if (txtFiles && txtFiles.length) {
			result.push(
				src(txtFiles)
			);
		}

		if (jsonFiles && jsonFiles.length) {
			const jsBeautify = require("./gulp-jsbeautify");
			result.push(
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

			result.push(
				src(esFiles)

				.pipe(eslint({
					fix: true
				}))
			);
		}

		if (cssFiles.length) {

			let postcss = require("./gulp-postcss");

			let processors = [
				require("stylelint"),
			];
			result.push(
				src(cssFiles)

				.pipe(postcss(processors))
			);

			/*			// css 代码审查
						let stylelint = require("gulp-stylelint");

						result.push(
							src(cssFiles)

							.pipe(stylelint({
								failAfterError: false
							}))
						);*/
		}

		if (result.length) {

			// 代码审查异步结果处理
			result = result.map(stream => {
				return new Promise((resolve, reject) => {
					const reporter = require("./gulp-reporter");

					const gulpIf = require("gulp-if");
					const editorconfig = require("./gulp-editorconfig");

					stream = stream
						.pipe(reporter({
							inHTML: process.env.THG_GUI_SPAWN,
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

			return Promise.all(result)

			.then(() => {
				if (changed.length) {
					console.error("File changed:\t" + changed.join(", "));
					process.nextTick(() => {
						process.exit(1);
					});
				}
			});
		}
	});
};
