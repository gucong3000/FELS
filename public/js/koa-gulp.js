"use strict";

const through = require("through2");
const path = require("path");
const gulp = require("gulp");
// const gutil = require("gulp-util");
const plumber = require("gulp-plumber");

const extFallBack = {
	js: ["jsx", "vue", "es6", "es7", "babel"],
	css: ["less", "scss", "sss"],
}

function path2globs(file) {
	let pathInfo = file.match(/^(.+\.)(\w+)$/);
	if (pathInfo) {
		let exts = extFallBack[pathInfo[2]];
		if (exts) {
			return [file].concat(exts.map(ext => pathInfo[1] + ext));
		}
	}
	return file;
}

function koa_gulp(src, options) {

	function callgulp(globs, options) {
		globs = path2globs(globs);
		if (!Array.isArray(options.processors)) {
			throw new Error("Please provide array of gulp processors!");
		}

		return new Promise((resolve, reject) => {
			let files = [];

			// 将gulp插件作为数组形式运行
			options.processors.filter(processor => processor).reduce(function(stream, processor) {
				return stream.pipe(processor);
			}, gulp.src(globs, options).pipe(plumber(reject))).pipe(through.obj({
				objectMode: true
			}, function(file, encoding, done) {
				files.push(file);
				done(null, file);
			}, function(done) {
				// 流程结束后信息汇总
				process.nextTick(() => {
					done();
					resolve(files);
				});
			}));
		});
	}

	let defaultCache = {};

	return async(ctx, next) => {
		// 参数如果是个函数，尝试运行此函数，将函数返回值作为参数
		if (typeof options === "function") {
			options = options(ctx);
		}

		// 获取globs路径
		let globs = path.join(src, ctx.path);

		// 建立文件结果缓存
		let cache = defaultCache;

		if (options) {
			cache = options.cache || cache;

			// 调用gulp编译文件
			let files = await callgulp(globs, options);

			// 将gulp输出的文件放进缓存
			files.forEach(file => {
				let relative = path.join(src, file.relative);
				cache[relative] = file;
			});
		}

		// 如果缓存中有文件，输出文件
		let file = cache[globs];
		if (file && !file.isNull()) {
			ctx.body = file.contents;
			ctx.type = path.extname(file.relative);
		}
		if (next) {
			await next();
		}
	};
}
module.exports = koa_gulp;
