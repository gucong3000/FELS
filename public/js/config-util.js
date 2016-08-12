"use strict";
const editorconfig = require("editorconfig");
const stringify = require("json-stable-stringify");
const fs = require("fs-extra-async");
const path = require("path");
const eolMap = {
	cr: "\r",
	crlf: "\r\n"
};

/**
 * 创建配置对象的访问代理对象
 * 键名中可以有操作符
 * 键不存在不会报错
 * `rules`这个键永远返回数组
 * @param  {Object}  cfg 原始的配置对象
 * @param  {any}     nullRuleValue 当访问`proxy.rules`下某个不存在或者为null的规则是，返回的数组的第一项的值
 * @return {Proxy}   obj对象的代理
 */
function rcProxy(cfg, nullRuleValue) {

	function creatPropProxy(obj) {
		return new Proxy(obj, {
			get: function(obj, prop) {
				if (prop in obj) {
					if (typeof obj[prop] !== "object") {
						return obj[prop];
					}
				} else {
					obj[prop] = {};
				}
				return creatPropProxy(obj[prop]);
			}
		});
	}

	function fixRule(rule) {
		if (rule == null) {
			rule = [nullRuleValue || null];
		} else if (!Array.isArray(rule)) {
			rule = [rule];
		}
		return rule;
	}

	function getProxy(obj) {
		return new Proxy(obj, {
			get: function(obj, prop) {
				if (prop === "rules") {
					return new Proxy(obj.rules || {}, {
						get: function(rules, ruleName) {
							if (obj.rules) {
								return fixRule(rules[ruleName]);
							} else {
								return fixRule(null);
							}
						}
					});
				} else {
					return obj[prop];
				}
			}
		});
	}

	function setProxy(obj) {
		return new Proxy(obj, {
			get: function(obj, prop) {
				if (prop === "rules") {
					if (!obj.rules) {
						obj.rules = {};
					}
					return new Proxy(obj.rules, {
						get: function(rules, ruleName) {
							rules[ruleName] = fixRule(rules[ruleName]);
							return creatPropProxy(rules[ruleName]);
						}
					});
				} else if (prop in obj) {
					if (typeof obj[prop] !== "object") {
						return obj[prop];
					}
				} else {
					obj[prop] = {};
				}
				return creatPropProxy(obj[prop]);
			}
		});
	}

	function formatKey(key) {
		return key.replace(/(?:^|\.)([\w\-]+)/g, "[\"$1\"]");
	}

	return {
		get: function(prop) {
			if (prop in cfg) {
				return cfg[prop];
			}
			prop = new Function(`return this${ formatKey(prop) }`);
			try {
				return prop.call(getProxy(cfg));
			} catch (ex) {
				//
			}
		},
		set: function(prop, value) {
			if (/^\w+$/.test(prop)) {
				cfg[prop] = value;
			} else {
				new Function(`return this.proxy${ formatKey(prop) } = this.value`).call({
					proxy: setProxy(cfg),
					value,
				});
			}
		},
	};
}

const fileCache = {};

let util = {
	readFileAsync: function(file) {
		if (!fileCache[file]) {
			fileCache[file] = fs.readFileAsync(file)

			.then(contents => contents.toString());
		}
		return fileCache[file]
	},
	writeFileAsync: function(file, data, config) {

		if (!config) {
			config = editorconfig.parse(file);
		}

		return Promise.all([util.readFileAsync(file), config])

		.then(result => {
			if (result[1]) {
				let config = result[1];
				if (config.insert_final_newline) {
					data += "\n";
				}
				if (config.end_of_line && config.end_of_line !== "lf") {
					data = data.replace(/\n/g, eolMap[config.end_of_line]);
				}
			}
			if (data !== result[0]) {
				return fileCache[file] = fs.writeFileAsync(file, data)

				.then(() => data);
			}
		})

	},
	readRcAsync: function(file) {
		return util.readFileAsync(file)

		.then(contents => {
			if (/\.js$/.test(file)) {
				let exports = {};
				let module = {};
				new Function("module", "exports", "__filename", "__dirname", contents.toString()).call(null, module, exports, file, path.dirname(file))
				return module.exports || exports;
			} else {
				return JSON.parse(contents)
			}
		})

		.then(cfg => cfg || cfg)

		.catch(() => {});
	},
	writeRcAsync: function(file, data) {
		return editorconfig.parse(file)

		.then(config => {
			data = stringify(data, {
				space: /^space$/i.test(config.indent_style) ? (+config.indent_size || 4) : "\t"
			});
			if (/\.js$/.test(file)) {
				data = `module.exports = ${ data };`;
			}
			return util.writeFileAsync(file, data, config)
		});
	},

	proxy(moduleName, path) {

		let module = require("./config-" + moduleName);
		return module.get(path)

		.then(config => {
			let proxy = rcProxy(config, moduleName === "eslint" ? "off" : null)
			proxy.save = function() {
				return module.set(path, config);
			}
			return proxy;
		});
	}
};
module.exports = util;
