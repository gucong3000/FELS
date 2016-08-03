"use strict";

function sortObj(obj, fn, deep) {
	if (Array.isArray(obj)) {
		if (deep) {
			obj = obj.map(obj => sortObj(obj, fn, deep));
		}
	} else if (typeof obj === "object") {
		let newObj = {};
		Object.keys(obj).sort(fn).forEach(key => {
			newObj[key] = deep ? sortObj(obj[key], fn, deep) : obj[key];
		});
		obj = newObj;
	}
	return obj;
}

module.exports = Object.assign({}, JSON, {
	sort: function(obj, fn, deep) {
		if (typeof fn !== "function") {
			let tmp = fn;
			fn = deep;
			deep = tmp;
		}
		return sortObj(obj, fn, !!deep);
	},
	stringify: function(value, replacer, space) {
		let tab = space === "\t" || typeof space === "undefined";
		return require("js-beautify").js_beautify(JSON.stringify(value, replacer, "\t"), {
			indent_size: tab ? 1 : +space,
			indent_char: tab ? "\t" : " ",
			indent_with_tabs: tab,
		});
	}
});
