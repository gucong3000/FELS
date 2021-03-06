
const stringify = require("json-stable-stringify");
const editorconfig = require("editorconfig");
const cosmiconfig = require("cosmiconfig");
const fs = require("fs-extra-async");
const path = require("path");
const eolMap = {
	cr: "\r",
	crlf: "\r\n",
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
function rcProxy(cfg) {
	function creatPropProxy(obj) {
		return new Proxy(obj, {
			get(obj, prop) {
				if (prop in obj) {
					if (typeof obj[prop] !== "object") {
						return obj[prop];
					}
				}else {
					obj[prop] = {};
				}
				return creatPropProxy(obj[prop]);
			},
		});
	}

	function fixRule(rule) {
		if (rule == null) {
			rule = [];
		}else if (!Array.isArray(rule)) {
			rule = [rule];
		}
		return rule;
	}

	function getProxy(obj) {
		return new Proxy(obj, {
			get(obj, prop) {
				if (prop === "rules") {
					return new Proxy(obj.rules || {}, {
						get(rules, ruleName) {
							if (obj.rules) {
								return fixRule(rules[ruleName]);
							}else {
								return fixRule(null);
							}
						},
					});
				}else {
					return obj[prop];
				}
			},
		});
	}

	function setProxy(obj) {
		return new Proxy(obj, {
			get(obj, prop) {
				if (prop === "rules") {
					if (!obj.rules) {
						obj.rules = {};
					}
					return new Proxy(obj.rules, {
						get(rules, ruleName) {
							rules[ruleName] = fixRule(rules[ruleName]);
							return creatPropProxy(rules[ruleName]);
						},
					});
				}else if (prop in obj) {
					if (typeof obj[prop] !== "object") {
						return obj[prop];
					}
				}else {
					obj[prop] = {};
				}
				return creatPropProxy(obj[prop]);
			},
		});
	}

	function formatKey(key) {
		return key.replace(/(?:^|\.)([\w\-]+)/g, "[\"$1\"]");
	}

	return {
		get(prop) {
			if (prop in cfg) {
				return cfg[prop];
			}
			prop = new Function(`return this${formatKey(prop)}`);
			try {
				return prop.call(getProxy(cfg));
			}catch (ex) {
				//
			}
		},
		set(prop, value) {
			if (/^\w+$/.test(prop)) {
				cfg[prop] = value;
			}else {
				new Function(`return this.proxy${formatKey(prop)} = this.value`).call({
					proxy: setProxy(cfg),
					value,
				});
			}
		},
	};
}

const fileCache = {};

const util = {
	cosmiconfig(baseDir, option) {
		baseDir = path.normalize(baseDir);
		option = Object.assign({
			stopDir: baseDir,
			rcExtensions: true,
			argv: false,
		}, option);

		return cosmiconfig(option.moduleName, option).load(baseDir)

		.catch(() => undefined)

		.then(result => {
			if (!result || !result.filepath || !result.config) {
				result = {
					config: {},
					filepath: path.join(baseDir, "." + option.moduleName + "rc.json"),
				};

				process.nextTick(() => result.write(result.config));
			}

			if (/[\\\/]package\.json$/.test(result.filepath)) {
				result.write = data => {
					return util.readJSONAsync(result.filepath)

					.then(pkg => {
						pkg[option.packageProp || option.moduleName] = data;
						return util.writeRcAsync(result.filepath, pkg);
					});
				};
			}else {
				result.write = data => {
					return util.writeRcAsync(result.filepath, data);
				};
			}

			return result;
		});
	},
	readFileAsync(file) {
		if (!fileCache[file]) {
			fileCache[file] = fs.readFile(file)

			.then(contents => contents.toString())

			.catch(() => undefined);
		}
		return fileCache[file];
	},
	writeFileAsync(file, data, config) {
		if (!config) {
			config = editorconfig.parse(file);
		}

		return Promise.all([util.readFileAsync(file), config])

		.then(([contents, config]) => {
			if (config) {
				if (config.insert_final_newline && !/\s+$/.test(data)) {
					data += "\n";
				}
				if (config.end_of_line && config.end_of_line !== "lf") {
					data = data.replace(/\n/g, eolMap[config.end_of_line]);
				}
			}
			if (data !== contents) {
				return fileCache[file] = fs.writeFile(file, data)

				.then(() => data);
			}
		});
	},
	readJSONAsync(file) {
		return util.readFileAsync(file)

		.then(contents => {
			return JSON.parse(contents);
		})

		.then(cfg => cfg || {})

		.catch(() => {});
	},
	writeRcAsync(file, data) {
		return editorconfig.parse(file)

		.then(config => {
			data = stringify(data, {
				space: /^space$/i.test(config.indent_style) ? (+config.indent_size || 4) : "\t",
			});
			if (/\.js$/.test(file)) {
				data = `"use strict";\nmodule.exports = ${data};`;
			}
			return util.writeFileAsync(file, data, config);
		});
	},

	proxy(moduleName, path) {
		const module = require("./config-" + moduleName);
		return module.get(path)

		.then(config => {
			const proxy = rcProxy(config, moduleName === "eslint" ? "off" : null);
			proxy.save = function () {
				return module.set(path, config);
			};
			if (module.getPath) {
				proxy.getPath = module.getPath;
			}
			return proxy;
		});
	},

	create(cosmiconfigOpt, fixCfg) {
		return {
			get(baseDir) {
				return util.cosmiconfig(baseDir, cosmiconfigOpt)

				.then(rc => fixCfg(rc.config));
			},
			set(baseDir, cfg) {
				return util.cosmiconfig(baseDir, cosmiconfigOpt)

				.then(rc => rc.write(fixCfg(cfg)));
			},
			getPath(baseDir) {
				return util.cosmiconfig(baseDir, cosmiconfigOpt)

				.then(rc => rc.filepath);
			},
		};
	},
};
module.exports = util;
