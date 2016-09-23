"use strict";
/**
 * combo/concat
 * see: http://tengine.taobao.org/document_cn/http_concat_cn.html
 * see: https://github.com/seajs/seajs-combo/issues/3
 */

module.exports = combo;

const path = require("path").posix;
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
	return val;
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
		let originalUrl = ctx.url;
		let combo = match(originalUrl);
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

			let originalResponse = ctx.response;
			let header = Object.assign({}, originalResponse.header);
			let lastModified;
			let type;

			// 按combo信息，重新执行后续中间件
			return loopAsync(combo, (url) => {
				ctx.url = url;

				// 建立新的response对象
				const response = Object.create(ctx.app.response);
				response.res = new originalResponse.res.constructor(ctx.req);
				ctx.response = response;

				// 使用新response执行后续中间件
				return compose(stream)(ctx)

				.then(() => getContents(response.body))

				.then(contents => {
					// 保存body数据
					response._body = contents || `\n/* ${ url }\t${ response.message || response.status } */\n`;
					// 保存响应头
					Object.assign(header, response.header);
					// 保存最后修改时间
					if (response.lastModified > lastModified) {
						lastModified = response.lastModified;
					}
					// Content-Type
					if (!type && response.type) {
						type = response.type;
					}
					return response;
				});

			}).then(response => {

				// 删除不需要的header头
				[
					"Content-Length",
					"Content-Type",
					"ETag",
					"Last-Modified",
				].forEach(type => {
					delete header[type];
					delete header[type.toLowerCase()];
				});

				// 恢复原始的url与response对象
				ctx.url = originalUrl;
				ctx.response = originalResponse;
				originalResponse.set(header);

				// 如果有至少一个response含有etag，则生成etag
				if (response.some(response => response.etag)) {
					originalResponse.etag = response.map(response => response.etag || crypto.createHash("md5").update(response._body).digest("hex")).join(option.sep);
				}

				// 最后修改时间
				if (lastModified) {
					originalResponse.lastModified = lastModified;
				}

				// Content-Type
				if (type) {
					response.type = type;
				}

				// 收集其他中间件对ctx.body写入的数据
				originalResponse.body = Buffer.concat(response.map(response => response._body));

			});
		} else {
			// url中没有请求合并信息，继续执行后续中间件
			return next();
		}
	}
	return middleware;
}

async function loopAsync(arr, callback){
	for (let i = 0; i < arr.length; i++) {
		arr[i] = await callback(arr[i]);
	}
	return await Promise.all(arr);

}
