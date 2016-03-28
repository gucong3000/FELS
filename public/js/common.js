/**
 * 模拟CommonJS规范
 * 具体参照nodejs的实现来实现
 */

"use strict";
// 判断是浏览器环境
(function(window, undefined) {

	// 兼容IE8，待稍后es5-shim.js加载之后，这段就不起作用了
	if (!Array.isArray) {
		Array.isArray = function(arg) {
			return Object.prototype.toString.call(arg) === "[object Array]";
		};
	}

	var document = window.document;
	// 路径拼接正则，父目录
	var reParentPath = /[^\/]+\/\.\.\//g;
	var location = window.location;
	var baseURI = (document.baseURI || location.href).replace(/#.*$/, "");
	var __filename = getCurrPath(1);
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
	var anonymousCount = 0;
	var moduleCache = {
		".": rootModule
	};
	var exports = {
		plugins: [],
		map: {}
	};

	var strFactory = "__factory__";

	function setParent(module, parent) {
		if (module, parent) {
			var propParent = module.parent;
			var propChildren = parent.children;
			if (!propParent || propParent.id === "." || propParent === rootModule) {
				module.parent = parent;
			}

			// && propChildren.indexOf && 是在兼容IE8，待稍后es5-shim.js加载之后，这句就不起作用了
			if (Array.isArray(propChildren) && propChildren.indexOf && propChildren.indexOf(module) < 0) {
				propChildren.push(module);
			}
		}
	}

	var currentlyAddingScript;

	/**
	 * 获取当前正在运行的js的路径
	 * @param  {Boolean} mustGet 获取不到当前js路径时，是否用文档中最后一个js的路径代替
	 * @return {String} 绝对路径
	 */
	function getCurrPath(mustGet) {
		if (currentlyAddingScript) {
			return currentlyAddingScript.src;
		}

		var path;
		try {
			throw new Error("_");
		} catch (e) {
			try {
				e.stack.replace(/(?:\bat\b|@).*?(\w+\:\/\/+.*?)(?:\:\d+){2,}/g, function(m, url) {
					if (!path && url !== __filename) {
						path = url;
					}
				});
			} catch (ex) {

			}
		}
		if (!path) {
			var scripts = document.scripts || document.getElementsByTagName("script");
			var lastScript;
			for (var i = scripts.length - 1; i >= 0; i--) {
				var script = scripts[i];
				if (script.src) {
					if (script.readyState === "interactive") {
						return script.src;
					}
					if (mustGet && !lastScript) {
						lastScript = script;
					}
				}
			}
			if (lastScript) {
				path = lastScript.src;
			}
		}
		return path;
	}

	// 为js模块提供module对象
	function getModule(path) {
		if (path) {
			path = pathAbs(path);
		} else {
			path = getCurrPath() || ".";
		}

		var module = moduleCache[path];

		if (!module) {
			module = {
				children: [],
				filename: path,
				id: path,
				loaded: false,
				parent: rootModule
			};
			moduleCache[path] = module;
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
			var path = pathAbs(resolve(filename));
			if (path) {
				var module = moduleCache[path];
				var exports;

				// 如果加载过，则从缓存中获取
				if (module) {
					if (module.loaded) {
						setParent(module, parent);
						return runFactory(module);
					}
				} else {
					module = getModule(path);
				}

				setParent(module, parent);

				var fileText = getFileText(path);

				if (fileText) {
					if (/\.js(\?|#|$)/.test(path)) {
						// 尝试作为js模块解析
						try {
							/* jshint evil: true */
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

	function changed(obj) {
		if (typeof obj === "object") {
			for (var i in obj) {
				return i || true;
			}
			return false;
		}
		return true;
	}

	function runFactory(module) {
		if (typeof module[strFactory] === "function") {
			var exports = {};
			var require = getRequire(module);
			var factory = module[strFactory];
			var amd = factory.amd;
			module.exports = exports;
			var returnVal = factory.apply(window, (amd && amd.length ? amd.map(require) : [require, exports, module]));
			delete module[strFactory];
			if (!changed(module.exports)) {
				if (changed(exports)) {
					module.exports = exports;
				} else if (returnVal !== undefined) {
					module.exports = returnVal;
				}
			}
		}
		return module.exports;
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
			response = response.replace(/^[\s\n]*\(function\((\w+)\)\{typeof\s+define===?"function"\?define\([^\(\)]+?\b\1\):\1\(\)\}\)\(function\(require,exports,module\)\{\n((?:\n|.)+)\n\}\);[\s\n]*$/, "$2");
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
			path = resolve(pathJoin(baseURI, path));
		}
		return path;
	}

	// 去除数组中的空数据并去重
	function arrayUnique(arr) {
		if (Array.isArray(arr)) {
			//n为hash表，r为临时数组
			var n = {},
				r = [];
			//遍历当前数组
			for (var i = 0; i < arr.length; i++) {
				//如果hash表中没有当前项
				if (arr[i] && !n[arr[i]]) {
					//存入hash表
					n[arr[i]] = true;
					//把当前数组的当前项push到临时数组里面
					r.push(arr[i]);
				}
			}
			if (r.length) {
				return r;
			}
		}
	}


	/**
	 * 直接在一个对象上定义一个新属性，或者修改一个已经存在的属性
	 * @param  {String} propertyName 需被定义或修改的属性名。
	 * @param  {Object|Function} descriptor   传函数，则将其作为get函数，传对象，则参见 https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty
	 * @param  {[Object]} object       需要定义属性的对象，默认值为window。
	 */
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
	rootModule = getModule(__filename);
	// var require = getRequire(module);
	rootModule.exports = exports;

	resolve = getRequire(rootModule).resolve;

	var isAmd;

	function define(id, deps, factory) {
		var argsLen = arguments.length;

		// define(factory)
		if (argsLen === 1) {
			factory = id;
			id = undefined;
		} else if (argsLen === 2) {
			factory = deps;

			// define(deps, factory)
			if (Array.isArray(id)) {
				deps = id;
				id = undefined;
			}
			// define(id, factory)
			else {
				deps = undefined;
			}
		}

		var module = getModule(resolve(id || getCurrPath() || ("@anonymous" + anonymousCount++)));
		if (id) {
			module.id = id;
		}
		var require = getRequire(module);

		if (typeof factory === "function") {
			if (isAmd) {
				// amd 模块的依赖声明与factory函数的参数一致，所以不要动它的依赖声明，直接记录下来
				factory.amd = deps;
			}
			// 依赖声明数组进行去重和去空
			deps = arrayUnique(deps);

			module[strFactory] = factory;
			module.loaded = true;
			if (deps) {
				// 根据依赖声明创建其子模块
				deps.forEach(function(filename) {
					var childModule = getModule(require.resolve(filename));
					setParent(childModule, module);
				});
				loadDeps(module).then(run);
			} else {
				run();
			}
		} else if (factory) {
			module.exports = factory;
		}

		function run() {
			var parent = module.parent;
			if (parent === rootModule || parent.id === ".") {
				runFactory(module);
			}
		}
		isAmd = false;
	}
	window.define = define;
	define.cmd = {};
	define.useamd = function() {
		return (isAmd = true);
	};

	// 加载模块与其所依赖模块
	function loadDeps(module, workers) {
		var promise;
		workers = workers || {};
		if (module.loaded) {
			promise = Promise.all(module.children.map(function(childModule) {
				if (!workers[childModule.id]) {
					return loadDeps(childModule, workers);
				}
			}));
		} else {
			promise = workers[module.id];
			if (!promise) {
				// 先加载父模块，再加载其依赖
				promise = new Promise(function(resolve, reject) {
					loadModule(module).then(function() {
						loadDeps(module, workers).then(resolve, reject);
					}, reject);
				})["catch"](function(e) {
					console.error(e.target);
				});
				workers[module.id] = promise;
			}
		}
		return promise;
	}

	function isFileReady(readyState) {
		// Check to see if any of the ways a file can be ready are available as properties on the file's element
		return (!readyState || readyState === "loaded" || readyState === "complete" || readyState === "uninitialized");
	}

	var urlCache = {};

	function loadModule(childModule) {
		var url = childModule.filename;
		var promise = urlCache[url];

		if (!promise) {
			promise = new Promise(function(resolve, reject) {
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
							delete urlCache[url];
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
				script.async = true;
				script.src = url;
				currentlyAddingScript = script;
				parentNode.appendChild(script);
				currentlyAddingScript = 0;
			});
			urlCache[url] = promise;
		}
		return promise;
	}
	(function() {
		var polyfillModules = [];

		function def(name) {
			define(name, function(require, exports, module) {
				module.exports = window[name] || name;
			});
		}

		function polyfill(name, fileName) {
			if (!window[name]) {
				polyfillModules.push(fileName || name);
			}
			def(name);
		}

		polyfill("console");
		polyfill("Promise", "es6-promise");
		polyfill("JSON", "json2");
		var array = [];
		if (!(array.every && array.filter && array.forEach && array.map && array.some && array.sort && array.reduce && array.reduceRight && "".trim && open.bind)) {
			polyfillModules.push("es5-shim");
		}
		getModule().loaded = true;
		def("es5-shim");
		if (polyfillModules.length) {
			getRequire()("polyfill/" + (polyfillModules.length > 1 ? "??" : "") + polyfillModules.join(".js,").toLowerCase() + ".js");
		}
	})();

})(window);