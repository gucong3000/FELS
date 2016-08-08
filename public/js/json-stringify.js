"use strict";
const editorconfig = require("editorconfig");
const stringify = require("json-stable-stringify");

/**
 * 使用editorconfig中的配置，写入JSON文件
 * @param  {String}   file    文件路径
 * @param  {[Object]} data    要写入文件的数据
 * @param  {[Object]} options 传递给`editorconfig`和`json-stable-stringify`插件的参数。默认undefined
 * @return {Promise}          promise对象
 * @returns {Promise.String}          序列化后的data
 */
module.exports = function(file, data, options) {
	return editorconfig.parse(file, options)

	.then(config => {
		return stringify(data, Object.assign(options || {}, {
			space: /^space$/i.test(config.indent_style) ? " ".repeat(+config.indent_size || 4) : "\t"
		}));
	});
};
