"use strict";

const through = require("through2");
const path = require("path");
const vfs = require("vinyl-fs");
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
			let basePath = pathInfo[1].replace(/\Wmin$/, "");
			return [file].concat(exts.map(ext => basePath + ext));
		}
	}
	return file;
}

let defaultCache = {};

function callgulp(globs, options) {
	if (!Array.isArray(options.processors)) {
		throw new Error("Please provide array of gulp processors!");
	}

	globs = path2globs(globs);


	return new Promise((resolve, reject) => {
		let files = [];

		// 将gulp插件作为数组形式运行
		options.processors.filter(processor => processor).reduce(function(stream, processor) {
			return stream.pipe(processor);
		}, vfs.src(globs, options).pipe(plumber(reject))).pipe(through.obj({
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

async function koa_vinyl(ctx, filePath, options) {

	// 参数如果是个函数，尝试运行此函数，将函数返回值作为参数
	let opts = typeof options === "function" ? options(ctx) : options;

	// 建立文件结果缓存
	let cache = defaultCache;

	// 获取客户端发来的客户端缓存中的文件的最后修改时间
	let since = ctx.request.get("If-Modified-Since");

	if (opts) {
		cache = opts.cache || cache;

		// 调用gulp编译文件
		let files = await callgulp(filePath, Object.assign({
			since: since ? new Date(since) : null,
		}, opts));

		// 将gulp输出的文件放进缓存
		files.forEach(file => {
			cache[file.path] = file;
		});
	}

	// 如果缓存中有文件，输出文件
	let file = cache[path.resolve(opts && opts.cwd ? opts.cwd : process.cwd(), filePath)];
	if (file && !file.isNull()) {

		ctx.type = path.extname(file.relative);
		let mtime = file.stat && file.stat.mtime.toUTCString();

		if (mtime && !ctx.response.get("Last-Modified")) {
			ctx.set("Last-Modified", mtime);
		}

		if (since && mtime && since === mtime) {
			ctx.status = 304;
		} else {
			ctx.body = file.contents;
		}
	}
}

module.exports = koa_vinyl;
