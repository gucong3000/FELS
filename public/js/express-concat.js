"use strict";
/**
 * combo/concat
 * see: http://tengine.taobao.org/document_cn/http_concat_cn.html
 * see: https://github.com/seajs/seajs-combo/issues/3
 */

module.exports = function(option) {
	option = Object.assign({
		syntax: "??",
		sep: ",",
		eq: "=",
	}, option);

	return function(req, res, next) {
		let pos = req.url.indexOf(option.syntax);
		if (pos >= 0) {
			let concat = req.url.slice(pos + option.syntax.length);

			if (concat) {
				req.concat = {};
				concat.split(option.sep).forEach(file => {
					file = file.split(option.eq);
					req.concat[file[0]] = file[1] || true;
				});
			}
		}
		next();
	}
}
