/**
 * 模拟CommonJS规范
 * 具体参照nodejs的实现来实现
 */

"use strict";
// 判断是浏览器环境
(function(window, undefined) {
	var XMLHttpRequest = window.XMLHttpRequest || window.ActiveXObject("Microsoft.XMLHTTP");
	var console = window.console;
	var Promise = window.Promise;
	var JSON = window.JSON;
	var document = window.document;
	var Object = window.Object;
	var Array = window.Array;
	var Function = window.Function;

	// 兼容IE8，待稍后es5-shim.js加载之后，这段就不起作用了
	if (!Array.isArray) {
		Array.isArray = function(arg) {
			return Object.prototype.toString.call(arg) === "[object Array]";
		};
	}

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
		var path;
		if (currentlyAddingScript) {
			path = currentlyAddingScript.src;
		}

		if (!path) {
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
							path = script.src;
							break;
						}
						if (mustGet && !lastScript) {
							lastScript = script;
						}
					}
				}
				if (i < 0 && lastScript) {
					path = lastScript.src;
				}
			}

		}
		if (path) {
			return pathAbs(path);
		}
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
						return runModule(module);
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


	function runModule(module) {
		if (typeof module[strFactory] === "function") {
			return runFactory(module);
		} else {
			return module.exports;
		}
	}

	function runFactory(module) {
		var exports, rawExports, definedExpressMagic, hasChange;
		/**
		 * 判断exports相比最初的原始值(rawExports)，有无变化。
		 * @param  newExports 要与之比较的变量，类型不限，默认与exports变量比较
		 * @return {Boolean} exports是否发生了变化
		 */
		function exportsChanged(newExports) {
			// 第二次调用exportsChanged函数时，会返回上次的值，不再重新计算
			if (hasChange === undefined) {
				newExports = arguments.length ? newExports : getExports();
				// 如果变量已经不全等，说明一定在工厂函数运行期间被重新赋值了
				if (newExports !== rawExports) {
					hasChange = true;
				} else {
					// 原始exports对象为空对象，for语句一旦运行，说明其新增了属性
					for (newExports in newExports) {
						hasChange = true;
						break;
					}
				}
			}
			return (hasChange = hasChange || false);
		}

		function setExports(value) {
			exports = value;

			// IE8及以下，不支持定义魔术方法，在这里检查一下module.exports和exports之间的差异，有差异则赋值一下
			if (!definedExpressMagic && module.exports !== exports) {
				module.exports = exports;
			}
		}

		function getExports() {
			return exports;
		}

		// 注意这里的var语句会被js引擎
		exports = {};
		// rawExports用来记录最初的exports对象的原始赋值，以便过一会用来测试模块是否对其赋了新的值
		rawExports = exports;

		var require = getRequire(module);
		var factory = module[strFactory];
		var amd = factory.amd;
		amd = amd && amd.length ? amd : 0;

		// 尝试使用defineProperty方式为module对象提供对exports的访问
		definedExpressMagic = defineProperty("exports", {
			set: setExports,
			get: getExports,
			enumerable: true
		}, module);

		var returnVal = factory.apply(window, (amd && amd.length ? amd.map(require) : [require, exports, module]));
		delete module[strFactory];
		// AMD模块不适用exports和exports对象，所以获取其工厂函数返回值作为模块返回值
		if (amd) {
			setExports(returnVal);
		} else {
			// IE8及以下，不能成功为module对象提供对exports的魔术方法，这里检查一下，如果module.exports有个新的值，则手动调用set函数
			if (!definedExpressMagic && exportsChanged(module.exports)) {
				setExports(module.exports);
			}

			// 对于未严格遵守CommanJS规范，使用了return语句作为模块返回值的cmd模块，在这里将就他们，取工厂函数返回值作为模块返回值
			if (!exportsChanged() && returnVal !== undefined) {
				setExports(returnVal);
			}

			// 模块编译工具可能会将ES6的export和export default语句分别编译为exports=xxxx和module.exports=xxxx,下面要兼容这两种同时存在时的情况
			// 这样做会牺牲es6的动态模块返回值特性，如果不希望这个结果，可以传递对象。或者换用system.js作为模块加载引擎
			if (exports instanceof Object) {
				for (var key in rawExports) {
					if (!(key in exports)) {
						exports[key] = rawExports[key];
					}
				}
			}
		}
		return getExports();
	}

	// 获取文件内容
	function getFileText(path, resolve, reject) {
		var xhr = new XMLHttpRequest();
		var response;
		if (resolve) {
			xhr.onreadystatechange = function() {
				if (xhr.readyState === 4) {
					if (statusOk()) {
						resolve(getRes());
					} else if (reject) {
						reject(xhr);
					}
				}
			};
		}
		xhr.open("GET", path, !!resolve);
		xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
		xhr.send(null);

		function statusOk() {
			var status = xhr.status;
			return status >= 200 && status < 300 || status === 304;
		}

		function getRes() {
			response = xhr.responseText || xhr.response;
			if (exports.plugins && exports.plugins.length) {
				exports.plugins.forEach(function(plugin) {
					response = plugin(response, path) || response;
				});
			}

			// 去除服务器端自动包裹的define语句
			response = response.replace(/^[\s\n]*\(function\((\w+)\)\{typeof\s+define===?"function"\?define\([^\(\)]+?\b\1\):\1\(\)\}\)\(function\(require,exports,module\)\{\n((?:\n|.)+)\n\}\);[\s\n]*$/, "$2");
			return response || "";
		}
		if (!resolve && statusOk()) {
			return getRes();
		}
	}

	function promiseFileText(path) {
		return new Promise(function(resolve, reject) {
			getFileText(path, resolve, reject);
		});
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

		// 处理"xxx/./xxx"
		path = path.replace(/\/\.\//g, "/");
		// 处理"xxx/../xxx"
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
		return path.replace(/\?.*$/, "");
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
			return Object.defineProperty(object, propertyName, descriptor);
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
	rootModule.loaded = true;
	rootModule = getModule(__filename);
	// var require = getRequire(module);
	rootModule.exports = exports;
	rootModule.loaded = true;

	resolve = getRequire(rootModule).resolve;

	// 标记下一个马上要传入define方法的模块共产函数是否是amd规范的模块
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
		var path = id ? resolve(id) : getCurrPath();
		if (!path) {
			path = resolve("@anonymous" + anonymousCount++);
		}

		var module = getModule(path);
		if (id) {
			module.id = id;
		}
		var require = getRequire(module);

		if (typeof factory === "function") {
			// 如果外部的js模块曾尝试调用define.amd或define.useamd
			if (isAmd) {
				// amd 模块的依赖声明与factory函数的参数一致，所以不要动它的依赖声明，直接记录下来
				factory.amd = deps;
			}
			// 依赖声明数组进行去重和去空
			deps = arrayUnique(deps);

			module[strFactory] = factory;
			module.loaded = true;
			if (deps) {
				// 根据依赖声明创建其子模块的module对象
				deps.forEach(function(filename) {
					var childModule = getModule(require.resolve(filename));
					setParent(childModule, module);
				});
				// 立即加载这个模块
				loadDeps(module).then(run);
			} else {
				run();
			}
		} else if (factory) {
			module.exports = factory;
		}

		// 此js模块所有的依赖关系加载完毕后的回调
		function run() {
			var parent = module.parent;
			if (parent === rootModule || parent.id === ".") {
				runFactory(module);
			}
		}

		// 工厂函数已保存，将isAmd返回默认状态
		isAmd = false;
	}
	window.define = define;
	define.cmd = {};

	/**
	 * 对外界js的接口，让其对define函数说明，接下来传进来的工厂函数是amd规范的。
	 * @return {Objet} 模拟define.amd返回空对象
	 */
	function useamd() {
		return (isAmd = {});
	}
	define.useamd = useamd;

	// 由于外界的js并不遵守我们的define.useamd()，所以将其用魔术方法绑定在define.amd
	if (!defineProperty("amd", useamd, define)) {
		// 低版本浏览器下定义define.amd失败，恢复原状；
		delete define.amd;
		isAmd = false;
	}

	// 加载模块与其所依赖模块
	function loadDeps(module, workers) {
		var promise;

		// 建立所有模块的加载工作队列
		workers = workers || {};
		if (module.loaded) {
			// 如果模块已经加载，则加载其所有子模块
			promise = Promise.all(module.children.map(function(childModule) {
				// 如果workers中已有，则不再重复建立工作进程
				if (childModule !== rootModule && !workers[childModule.filename]) {
					// 加载子模块的子模块，并将工作进程信息传递给递归工作队列
					return loadDeps(childModule, workers);
				}
			}));
		} else {
			// 如果当前要加载的模块，已在工作队列，则将工作进程返回
			promise = workers[module.filename];
			if (!promise) {
				// 先加载父模块，再加载其依赖
				promise = new Promise(function(resolve, reject) {
					// loadModule函数才是加载js模块的函数
					loadModule(module).then(function() {
						// 加载父模块后加载他的依赖关系
						loadDeps(module, workers).then(resolve, reject);
					}, reject);
				})["catch"](function(e) {
					console.error(e.target.src);
				});
				// 将加载父模块这个工作加入工作队列
				workers[module.filename] = promise;
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
		url = exports.map[url] || url;

		var promise = urlCache[url];

		if (!promise) {
			if (/\.js(\?|#|$)/.test(childModule.filename)) {
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
								resolve(childModule);
							}, 0);
						}
					};
					script.onerror = function(e) {
						// Don't call the callback again, so we mark it done
						done = 1;
						reject(e);
					};
					script.async = true;
					script.src = url;
					currentlyAddingScript = script;
					parentNode.appendChild(script);
					currentlyAddingScript = 0;
				});
			} else {
				promise = promiseFileText(url).then(function(fileText) {
					try {
						// 尝试作为json数据解析
						fileText = JSON.parse(fileText);
					} catch (ex) {

					}
					childModule.exports = fileText;
					return childModule;
				});
			}

			urlCache[url] = promise;
			promise.then(function(childModule) {
				childModule.loaded = true;
				delete urlCache[url];
				return childModule;
			})["catch"](function(ex) {
				delete urlCache[url];
				throw (ex);
			});
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
			getRequire(rootModule)("polyfill/" + (polyfillModules.length > 1 ? "??" : "") + polyfillModules.join(".js,").toLowerCase() + ".js");
			console = console || window.console;
			Promise = Promise || window.Promise;
			JSON = JSON || window.JSON;
		}
	})();

	(function() {
		// 出现在本文件的任何require语句都应该由node动态输出内容
		var fileVer = require("filever.json");
		for (var file in fileVer) {
			var hash = fileVer[file];
			file = resolve(file);
			exports.map[file] = file + "?" + hash;
		}
	})();

})(window);