"use strict";
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

let stylelint = {
	get: function(baseDir) {
		return Promise.all([
			fs.readJsonAsync(path.join(baseDir, "package.json")).then(pkg => pkg.stylelint).catch(() => {}),
			fs.readJsonAsync(path.join(baseDir, ".stylelintrc")).catch(() => {}),
			tryRequire(path.join(baseDir, "stylelint.config.js")),
		]).then(cfgs => Object.assign.apply(Object, cfgs.map(cfg => cfg || {})));
	},
	set: function(baseDir, cfg) {
		let pkgPath = path.join(baseDir, "package.json");
		let rcPath = path.join(baseDir, ".stylelintrc");

		cfg.defaultSeverity = cfg.defaultSeverity || "warning";
		if (!cfg.extends) {
			cfg.extends = ["stylelint-config-standard"];
		} else if (Array.isArray(cfg.extends)) {
			if (cfg.extends.indexOf("stylelint-config-standard") < 0) {
				cfg.extends.unshift("stylelint-config-standard");
			}
		} else if (cfg.extends !== "stylelint-config-standard") {
			cfg.extends = ["stylelint-config-standard", cfg.extends];
		}

		if (!cfg.defaultSeverity) {
			cfg.defaultSeverity = "warning";
		}

		return fs.readJsonAsync(pkgPath)

		.then(pkg => {
			if (!pkg.stylelint) {
				throw pkg;
			}
			pkg.stylelint = cfg;
			return outputjson(pkgPath, pkg)

			.then(() => fs.unlinkAsync(rcPath));
		})

		.catch(() => outputjson(rcPath, cfg))

		.then(() => fs.unlinkAsync(path.join(baseDir, "stylelint.config.js")))

		.catch(ex => {
			if (ex.code !== "ENOENT") {
				console.error(ex);
			}
		})

		.then(() => cfg);
	},
	update: function(key, value) {
		let curr = stylelint.curr;
		return (curr.stylelint ? Promise.resolve(curr.stylelint) : stylelint.get(curr.path))

		.then(cfg => {
			new Function(`this.obj.${ key } = this.value`).call({
				obj: proxy(cfg),
				value: value,
			});
			return stylelint.set(curr.path, cfg)
		});
	},
	init: function(data) {
		stylelint.curr = data;
		return stylelint.get(data.path)

		.then(cfg => {
			data.stylelint = cfg;
			return stylelint.set(data.path, cfg);
		});
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

module.exports = stylelint;
