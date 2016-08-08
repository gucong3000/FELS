"use strict";
const eslintConfig = require("eslint/lib/config/config-file.js");
const fs = require("fs-extra-async");
const path = require("path");
const stringify = require("./json-stringify");

/**
 * 尝试使用require函数加载模块，然后清空缓存
 * @param  {String} path 模块路径
 * @return {Object}      require函数返回的数据
 */
function tryRequire(path) {
	try {
		let exports = require(path);
		try {
			delete require.cache[require.resolve(path)];
		} catch (ex) {
			//
		}
		return exports;
	} catch (ex) {
		return {};
	}
}

/**
 * 将json数据写入文件
 * @param  {String} file 文件路径
 * @param  {Object} data json数据
 * @return {Promise}     异步文件写入Promise对象
 */
function outputjson(file, data) {
	return stringify(file, data)

	.then(data => {
		if (/.js$/.test(file)) {
			data = `module.exports = ${ data };`;
		}
		return fs.writeFileAsync(file, data);
	});
}

let eslint = {
	get: function(baseDir) {
		let cfg;
		let rcPath = eslintConfig.getFilenameForDirectory(baseDir);
		if (rcPath) {
			try {
				if (/\.js(?:on)?$/i.test(rcPath)) {
					cfg = tryRequire(rcPath);
				} else {
					cfg = fs.readJsonSync(rcPath);
				}
				if (/[\\\/]package.json$/.test(rcPath)) {
					cfg = cfg.eslintConfig;
				}
			} catch (ex) {
				//
			}
		}
		return cfg || {};
	},
	set: function(baseDir, cfg) {

		if (!cfg.extends) {
			cfg.extends = ["eslint:recommended"];

		} else if (Array.isArray(cfg.extends)) {
			if (cfg.extends.indexOf("eslint:recommended") < 0) {
				cfg.extends.unshift("eslint:recommended");
			}
		} else if (cfg.extends === "eslint:recommended") {
			cfg.extends = [cfg.extends];
		} else {
			cfg.extends = ["eslint:recommended", cfg.extends];
		}

		cfg.ecmaVersion = 7;
		cfg.sourceType = "module";
		cfg.ecmaFeatures = {
			globalReturn: false,
			impliedStrict: true,
			jsx: true,
		}

		if (!cfg.env) {
			cfg.env = {
				browser: true,
			}
		}

		cfg.env.amd = cfg.env.browser || undefined;
		cfg.env.commonjs = cfg.env.browser || undefined;
		cfg.env.worker = cfg.env.browser || undefined;
		cfg.env.es6 = cfg.env.node || cfg.env.es6 || undefined;
		cfg.env["shared-node-browser"] = cfg.env.node && cfg.env.browser || undefined;
		cfg.rules = cfg.rules || {};

		let rcPath = eslintConfig.getFilenameForDirectory(baseDir);
		if (/[\\\/]package.json$/.test(rcPath)) {

			let pkg = tryRequire(rcPath);
			if (!pkg.eslintConfig) {
				rcPath = path.join(baseDir, ".eslintrc.json");
			}
		}

		let currcfg;
		try {
			currcfg = eslintConfig.load(rcPath);
		} catch (ex) {
			//
		}

		if (!currcfg) {
			cfg.rules["no-console"] = "warn";
		}

		if (JSON.stringify(eslint.get(rcPath)) !== JSON.stringify(cfg)) {
			outputjson(rcPath, cfg);
		}
		return cfg;

	},
	update: function(key, value) {
		let curr = eslint.curr;
		let eslintRc = curr.eslint || eslint.get(curr.path);
		new Function(`this.obj.${ key } = this.value`).call({
			obj: proxy(eslintRc),
			value: value,
		});

		return eslint.set(curr.path, eslintRc);
	},
	init: function(data) {
		eslint.curr = data;
		data.eslint = eslint.get(data.path) || {};
		return eslint.set(data.path, data.eslint);
	},
};

/**
 * 创建对象代理，以便解决为定义的属性访问时报错的问题
 * @param  {Object} obj 要创建代理的对象
 * @return {Proxy}      原对象的代理对象
 */
function proxy(obj) {
	return new Proxy(obj, {
		get: function(target, property) {
			if (!target[property]) {
				target[property] = {}
			}
			return proxy(target[property]);
		}
	});
}

module.exports = eslint;
