"use strict";
/**
 * combo/concat
 * see: http://tengine.taobao.org/document_cn/http_concat_cn.html
 * see: https://github.com/seajs/seajs-combo/issues/3
 */

module.exports = combo;

const path = require("path").posix;
const co = require("co");
const compose = require("koa-compose");
const BufferStreams = require("bufferstreams");

// 解析ctx.body内容，统一读取出Buffer对象
function getContents(val) {
	if ("string" == typeof val) {
		// string
		return Buffer.from(val);
	} else if (Buffer.isBuffer(val)) {
		// Buffer
		return val;
	} else if ("function" == typeof val.pipe) {
		// Stream
		return new Promise(resolve => {
			val.pipe(new BufferStreams((err, buf, done) => {
				done();
				resolve(buf);
			}));
		});
	} else if (val !== null) {
		return Buffer.from(JSON.stringify(val));
	}
}

function combo(option) {
	// 默认配置
	option = Object.assign({
		syntax: "??",
		sep: ",",
	}, option);

	// 查找url中的combo信息
	function match(url) {
		let pos = url.indexOf(option.syntax);
		if (pos >= 0) {
			let dir = url.slice(0, pos);
			return url.slice(pos + option.syntax.length).split(option.sep).map(file => path.join(dir, file));
		}
	}

	function middleware(ctx, next) {
		let combo = match(ctx.url);
		if (combo && combo.length) {
			let pos;

			// 查找后续中间件
			let stream = ctx.app.middleware.filter((fn, i) => {
				if (fn === middleware) {
					pos = i;
				} else if (i > pos) {
					return true;
				}
				return false;
			});
			let originalUrl = ctx.url;

			// 按combo信息，重新执行后续中间件
			return loopAsync(combo, (url) => {
				// 生成新的ctx对象
				ctx.url = url;
				ctx.body = null;

				// 执行后续中间件
				return compose(stream)(ctx).then(() => getContents(ctx.body));
			}).then(body => {
				// 收集其他中间件对ctx.body写入的数据
				ctx.body = Buffer.concat(body);
				ctx.url = originalUrl;
			});
		} else {
			// url中没有请求合并信息，继续执行后续中间件
			return next();
		}
	}
	return middleware;
}


let loopAsync = co.wrap(function* loopAsync(arr, callback) {
	for (let i = 0; i < arr.length; i++) {
		yield arr[i] = callback(arr[i]);
	}
	return Promise.all(arr);
})
