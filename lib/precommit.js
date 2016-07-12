"use strict";
var gulp = require("gulp");

module.exports = function(cb) {
	if (process.env.HG_PARENT1 && process.env.HG_PARENT2) {

		// hg在合并代码时，跳过代码审查，git无相关方法，git请使用`--no-verify`参数提交来跳过代码审查
		console.log("检测到正在进行代码合并，跳过语法检查。");
		return cb();
	}

	var program = new(require("commander").Command)("gulp precommit");

	program
		.option("--src [path]", "项目根目录路径", String, ".")

	.parse(process.argv);

	return require("./getrepdiff")(program.src)

	.then(files => {

		files = files.filter(function(path) {

			// 将压缩文件排除
			return !(/[\.\-]min\.\w+$/.test(path));
		});

		var esFiles = files.filter(function(path) {

			// 将js文件单独列出
			return /\.(?:jsx?|es\d?|babel)$/.test(path);
		});

		/*		var cssFiles = files.filter(function(path) {
					// 将css文件单独列出
					return /\.css$/.test(path);
				});
		*/
		var result = [];

		// var gulpTxtChenged = require("./gulp-text-chenged");
		// var txtChenged = gulpTxtChenged({
		// 	cache: {},
		// });

		function src(files) {
			return gulp.src(files, {
				allowEmpty: true,
				base: program.src,
				cwd: program.src
			});

			// .pipe(txtChenged)

			// .pipe(require("gulp-stripbom")({
			// 	showLog: false,
			// }))

			//
		}

		if (esFiles.length) {

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
					var csscomb = require("gulp-csscomb");

					result.push(
						src(cssFiles)

						.pipe(csscomb())

					);
				}*/

		if (result.length) {
			let a;

			// 代码审查异步结果处理
			result = result.map(stream => {
				return new Promise((resolve, reject) => {
					const gulpIf = require("gulp-if");
					const isFixed = require("./isfixed");

					// if fixed, write the file to dest
					stream = stream
						.pipe(gulpIf(isFixed, gulp.dest(program.src)));

					stream.on("end", resolve);
					stream.on("error", reject);
					process.nextTick(resolve);
				});
			});

			return Promise.all(result).then(() => {

				// return gulpTxtChenged.saveGlobalCache();
			});
		}
	});
};
