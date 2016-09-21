"use strict";

const through = require("through2");
const eos = require("end-of-stream");
const consume = require("stream-consume");

function koa_gulp(callback) {
	return async(ctx, next) => {
		let stream = await callback(ctx);
		if (stream) {
			await new Promise((resolve, reject) => {
				stream = stream.pipe(through.obj(function(file, encoding, cb) {
					if (file.isNull()) {
						resolve();
					} else {
						resolve(file.contents);
					}
					cb(null, file);
				}));
				stream.on("error", reject);
				eos(stream, {
					error: true,
					readable: stream.readable,
					writable: stream.writable && !stream.readable
				}, function(err) {
					process.nextTick(() => {
						if (err) {
							reject(err);
						} else {
							resolve();
						}
					});
				});
				consume(stream);
			})

			.catch(ex => console.error(ex))

			.then(contents => {
				if (contents) {
					ctx.body = contents;
				}
			});
			return stream;
		}
		await next();
	};
}
module.exports = koa_gulp;
