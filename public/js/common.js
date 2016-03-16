/**
 * 模拟CommonJS规范
 * 具体参照nodejs的实现来实现
 */

"use strict";
// 判断是浏览器环境
(function(window, undefined) {

	var document = window.document;
	// 路径拼接正则，父目录
	var reParentPath = /[^\/]+\/\.\.\//g;
	var location = window.location;
	var baseURI = (document.baseURI || location.href).replace(/#.*$/, "");
	var reAbsPath = RegExp("^" + baseURI.replace(/^((?:\w+\:)?\/\/+[^\/]+).*$/, "$1"));
	var rootModule = {
		children: [],
		filename: baseURI,
		id: ".",
		loaded: false,
		parent: null
	};
	var resolve = function(path) {
		return path;
	};
	var moduleCache = {
		".": rootModule
	};
	var exports = {
		plugins: [],
		map: {}
	};

	var strFactory = "__factory__";

	function setParent(module, parent) {
		if (!module.parent || module.parent.id === "." || module.parent === rootModule) {
			module.parent = parent;
		}
		if (parent.children.indexOf(module) < 0) {
			parent.children.push(module);
		}
	}

	function getAllScript() {
		return document.scripts || document.querySelectorAll("script");
	}

	// 为js模块提供module对象
	function getModule(path) {
		var script;
		if (!path) {
			script = getAllScript();
			script = script[script.length - 1];
			path = script.src;
			if (!path) {
				return rootModule;
			}
		}

		var id = pathRel(path);
		var module = moduleCache[id];

		if (!module) {
			module = {
				children: [],
				filename: pathAbs(path),
				id: id,
				loaded: false,
				parent: rootModule
			};
			moduleCache[id] = module;
			setParent(module, rootModule);
		}

		return module;
	}

	// 获取require接口
	function getRequire(parent) {
		parent = parent || getModule();

		// 寻找模块路径
		function resolve(filename) {
			if (filename) {

				filename = exports.map[filename] || filename;
				if (filename) {
					// 文件名一般大家会忽略最后的.js，补上
					if (!/\.\w+$/.test(filename)) {
						filename += ".js";
					}
					if (/^\w+/.test(filename)) {
						// "filename.js"或"dirname/filename.js"
						filename = pathJoin(rootModule.filename, filename);
					} else {
						// "../filename.js"或"./filename.js"
						filename = pathJoin(parent.filename, filename);
					}
					return filename;
				}
			}
		}

		// 模块加载
		function require(filename) {

			var path = resolve(filename);
			if (path) {
				var module = moduleCache[pathRel(path)];
				var exports;

				// 如果加载过，则从缓存中获取
				if (module) {
					setParent(module, parent);
					exports = runFactory(module);
					if (exports) {
						return exports;
					}
				}

				module = getModule(path);
				setParent(module, parent);

				var fileText = getFileText(path);

				if (fileText) {
					if (/\.js(\?|#|$)/.test(path)) {
						// 尝试作为js模块解析
						try {
							new Function("require", "exports", "module", fileText).apply(window, [getRequire(module), module.exports, module]);
						} catch (ex) {
							var stack = ex.stack.match(/<anonymous>:(\d+)(?:\:(\d+))/);
							if (stack) {
								console.error(ex.message + "\n\tat (" + pathAbs(path) + ":" + stack[1] + ":" + (stack[2] || 1) + ")");
							} else {
								throw ex;
							}
						}
					} else if (/\.json(\?|#|$)/.test(path)) {
						// 尝试作为json数据解析
						exports = JSON.parse(fileText);
					} else {
						exports = fileText;
					}

					module.loaded = true;

					return module.exports || (module.exports = exports);
				}
			}
		}

		// 模仿nodejs，对外暴漏require.resolve() http://nodejs.cn/api/globals.html#globals_require_resolve
		require.resolve = resolve;

		// 模仿nodejs，对外暴漏require.cache, https://nodejs.org/api/globals.html#globals_require_cache
		defineProperty("cache", {
			set: function(value) {
				moduleCache = value;
			},
			get: function() {
				return moduleCache;
			},
			enumerable: true
		}, require);
		return require;
	}

	// 为直接加载的js提供exports对象
	function getExports(path) {
		var module = getModule(path);
		var exports = module.exports;
		if (!exports) {
			module.exports = exports = {};
		}
		return exports;
	}

	function runFactory(module) {
		var exports = module.exports;
		if ("exports" in module) {
			return module.exports;
		} else if (typeof module[strFactory] === "function") {
			exports = {};
			var require = getRequire(module);
			var factory = module[strFactory];
			var amd = factory.amd;
			//console.log(!/^function(?:\s*\w+)?\s*\(\s*require(?:\s*,\s*exports(?:\s*,\s*module)?)?\s*\)\s*\{/.test(factoryCode));
			delete module.exports;
			var result = factory.apply(window, Array.isArray(amd) ? amd.map(require) : [require, exports, module]);
			exports = module.exports || result || exports;
			delete module[strFactory];
			return (module.exports = exports);
		} else {
			setTimeout(function() {
				runFactory(module);
			}, 800);
		}
	}

	// 获取文件内容
	function getFileText(path) {
		var xhr = new window.XMLHttpRequest();
		var response;
		xhr.open("GET", path, false);
		xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
		xhr.send(null);
		var status = xhr.status;
		if (status >= 200 && status < 300 || status === 304) {
			response = xhr.responseText || xhr.response;
			if (exports.plugins && exports.plugins.length) {
				exports.plugins.forEach(function(plugin) {
					response = plugin(response, path) || response;
				});
			}

			// 去除服务器端自动包裹的define语句
			response = response.replace(/^\s+[^\r\n\;]*?\bdefine\s*\([^\r\n\;]?\bfunction\(\s*require\s*,\s*exports\s*,\s*module\s*\)\s*\{([\s\S]+)\}\)\;\s*$/, "$1");
			return response;
		}
	}

	// 求引用路径
	function pathJoin(path, filename) {
		if (/^\/[^/]+/.test(filename)) {
			// "/foo/bar/filename.js"
			path = path.replace(/^((?:\w+\:)?\/\/+[^\/]+)?.*$/, "$1" + filename);
		} else if (/^\/\/+/.test(filename)) {
			// "//google.com/filename.js"
			path = path.replace(/^(?:(\w+\:)?\/\/+[^\/]+)?.*$/, "$1" + filename);
		} else if (/\w+\:\/\/+/.test(filename)) {
			// "http://google.com/filename.js"
			path = filename;
		} else {
			// "foo/bar/filename.js"
			path = path.replace(/[^\/]*$/, filename);
		}

		path = path.replace(/\/\.\//g, "/");
		while (reParentPath.test(path)) {
			path = path.replace(reParentPath, "");
		}
		return path;
	}

	// 求引用路径
	function pathAbs(path) {
		if (!/^\w+:\/+/.test(path)) {
			path = pathJoin(baseURI, path);
		}
		return path.replace(reAbsPath, "");
	}

	function pathRel(path) {
		return pathAbs(resolve(path)).replace(/^\w+\:\/\/+[^\/]+/, "");
	}

	// 为window对象新增属性
	function defineProperty(propertyName, descriptor, object) {
		if (typeof descriptor === "function") {
			descriptor = {
				enumerable: false,
				get: descriptor
			};
		}
		object = (object || window);
		try {
			Object.defineProperty(object, propertyName, descriptor);
		} catch (ex) {
			object[propertyName] = descriptor.get();
		}
	}

	if (window.navigator.appName !== "node") {
		// 为直接加载的js提供require函数
		defineProperty("require", getRequire);

		// 为直接加载的js提供exports对象
		defineProperty("exports", getExports);

		// 为直接加载的js提供module对象
		defineProperty("module", getModule);
	}

	rootModule = getModule();
	// var require = getRequire(module);
	module.exports = exports;

	resolve = getRequire(rootModule).resolve;

	function define(path, deps, factory) {
		var argsLen = arguments.length;

		// define(factory)
		if (argsLen === 1) {
			factory = path;
			path = undefined;
		} else if (argsLen === 2) {
			factory = deps;

			// define(deps, factory)
			if (Array.isArray(path)) {
				deps = path;
				path = undefined;
			}
			// define(id, factory)
			else {
				deps = undefined;
			}
		}

		var module = getModule(path);
		var require = getRequire(module);

		if (typeof factory === "function") {
			module[strFactory] = factory;
			module.loaded = true;
			if (deps) {
				if (factory.amd) {
					factory.amd = deps;
				}
				deps = deps.filter(function(filename) {
					return filename;
				});
				if (deps.length) {
					Promise.all(deps.map(function(filename) {
						return loadScript(require.resolve(filename), module);
					})).then(run);
					return;
				}
			}
			run();
		} else if (factory) {
			module.exports = factory;
		}

		function run() {
			loadDeps(module).then(function() {
				if (module.parent === rootModule) {
					runFactory(module);
				}
			});
		}
	}
	window.define = define;
	define.cmd = {};

	function loadDeps(module) {
		var promise;
		var path = module.filename;
		if (module.loaded) {
			if (module.children) {
				promise = Promise.all(module.children.map(loadDeps));
			} else {
				promise = loadScript(path);
			}
		} else {
			promise = new Promise(function(resolve, reject) {
				loadScript(path)["catch"](reject).then(function() {
					loadDeps(module)["catch"](reject).then(resolve);
				});
			});
		}
		return promise;
	}

	function isFileReady(readyState) {
		// Check to see if any of the ways a file can be ready are available as properties on the file's element
		return (!readyState || readyState === "loaded" || readyState === "complete" || readyState === "uninitialized");
	}

	var urlCache = {};

	function loadScript(url, parentModule) {
		var promise = urlCache[url];

		if (!promise) {
			promise = new Promise(function(resolve, reject) {
				var childModule = getModule(url);
				setParent(childModule, parentModule);
				if (childModule.loaded) {
					return resolve(childModule);
				}
				var parentNode = (document.body || document.documentElement.lastChild);
				var script = document.createElement("script");
				var done;
				// Bind to load events
				script.onreadystatechange = script.onload = function() {
					if (!done && isFileReady(script.readyState)) {
						// Set done to prevent this function from being called twice.
						done = 1;
						// Handle memory leak in IE
						script.onload = script.onreadystatechange = script.onerror = null;
						// Just run the callback
						setTimeout(function() {
							childModule.loaded = true;
							resolve(childModule);
						}, 0);
					}
				};
				script.onerror = function(e) {
					// Don't call the callback again, so we mark it done
					urlCache[url] = 0;
					done = 1;
					reject(e);
				};
				script.src = url;
				parentNode.appendChild(script);
			});
			urlCache[url] = promise;
		}
		return promise;
	}

	function shim(file, prop, test) {
		prop = prop || file;
		test = test || prop;
		var exports;

		var testFn = new Function(/\breturn\b/.test(test) ? test : ("return " + test));

		function testProp() {
			try {
				return exports = testFn.call(window);
			} catch (ex) {

			}
		}
		if (!testProp()) {
			var rsult = require(file);
			if (/^\w+$/.test(prop) && !testProp()) {
				window[prop] = rsult;
			}
		}
		return exports;
	}

	shim("console");
	shim("es5-shim.min", "JSON");
	shim("json2.min", "JSON");
	shim("es6-promise", "Promise");

})(window);