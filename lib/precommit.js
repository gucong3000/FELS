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

			// 将js文件单独列出
			return /(?:(?:^|\/|\\).\w+rc|\.json)$/.test(path);
		});

		let svgFiles = files.filter(function(path) {

			// 将css文件单独列出
			return /\.svg$/.test(path);
		});

		let cssFiles = files.filter(function(path) {

			// 将css文件单独列出
			return /\.css$/.test(path);
		});

		let result = [];

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

		if (svgFiles && svgFiles.length) {
			result.push(
				src(svgFiles)
			);
		}

		if (cssFiles && cssFiles.length) {
			result.push(
				src(cssFiles)
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
			const reporter = require("./gulp-reporter");

			result.push(
				src(esFiles)

				.pipe(eslint({
					fix: true
				}))
				.pipe(reporter())
			);
		}

		/*		if (cssFiles.length) {
					// css 代码审查
					let csscomb = require("gulp-csscomb");

					result.push(
						src(cssFiles)

						.pipe(csscomb())

					);
				}*/

		if (result.length) {

			// 代码审查异步结果处理
			result = result.map(stream => {
				return new Promise((resolve, reject) => {
					const gulpIf = require("gulp-if");
					const editorconfig = require("./gulp-editorconfig");

					stream = stream
						.pipe(editorconfig())
						.pipe(gulpIf(file => {
							if (file.changed()) {

								// if changed, write the file to dest
								console.log("File changed:\t", file.relative);
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
						}
						resolve(stream);
					});
					consume(stream);
				});
			});

			return Promise.all(result).then(() => {

				// return gulpTxtChenged.saveGlobalCache();
			});
		}
	});
};
