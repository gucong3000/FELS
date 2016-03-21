(function(root, factory) {
	if (typeof define === "function" && define.amd) {
		// AMD
		define(["jquery"], factory);
	} else if (typeof exports === "object") {
		// Node, CommonJS之类的
		module.exports = factory(require("jquery"));
	} else {
		// 浏览器全局变量(root 即 window)
		root.returnExports = factory(root.jQuery);
	}
}(this, function($) {
	//    方法
	function myFunc() {}

	//    暴露公共方法
	return myFunc;
}));


(function(root, factory) {
	if (typeof define === "function" && define.amd) {
		// AMD
		define(["jquery", "underscore"], factory);
	} else if (typeof exports === "object") {
		// Node, CommonJS之类的
		module.exports = factory(require("jquery"), require("underscore"));
	} else {
		// 浏览器全局变量(root 即 window)
		root.returnExports = factory(root.jQuery, root._);
	}
}(this, function($, _) {
	//    方法
	function a() {} //    私有方法，因为它没被返回 (见下面)
	function b() {} //    公共方法，因为被返回了
	function c() {} //    公共方法，因为被返回了

	//    暴露公共方法
	return {
		b: b,
		c: c
	};
}));

(function(root, factory) {
	if (typeof define === "function" && define.amd) {
		// AMD
		define(["jquery", "underscore"], factory);
	} else if (typeof exports === "object") {
		// Node, CommonJS之类的
		module.exports = factory();
	} else {
		// 浏览器全局变量(root 即 window)
		root.returnExports = factory();
	}
}(this, function($, _) {
	//    方法
	function a() {} //    私有方法，因为它没被返回 (见下面)
	function b() {} //    公共方法，因为被返回了
	function c() {} //    公共方法，因为被返回了

	//    暴露公共方法
	return {
		b: b,
		c: c
	};
}));

(function(factory) {
	if (typeof define === "function" && define.amd) {

		// AMD. Register as an anonymous module.
		define(["jquery"], factory);
	} else {

		// Browser globals
		factory(jQuery);
	}
})();


(function(factory) {
	if (typeof define === "function" && define.amd) {
		// AMD. Register as an anonymous module.
		define(["jquery"], function() {
			return jQuery;
		});
	}
})();