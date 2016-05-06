"use strict";

/**
 * 将线上文件的请求的url中的pathname转换为本地文件路径
 * @param  {String} pathname 所请求的原始文件路径
 * @return {String|Promise}  转换后的本地文件路径，如果需要异步返回结果，使用Promise类型的返回值即可
 */
module.export = function(pathname) {
	// 线上服务器路径映射为本地路径

	// `/d28bab9bd69f3090/app.css` 转换为 `/app.css`
	pathname = pathname.replace(/\/[\da-f]{16,}\//, "\/");

	// `/static_passport/dist/20160126_2/js/library/es5-shim.js` 转换为 `/static_passport/src/js/library/es5-shim.js`
	pathname = pathname.replace(/\/dist\/201\d(?:0?[1-9]|11|12)[\d\_]+\//, "/src\/");

	return pathname;
};
