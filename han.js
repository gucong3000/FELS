var han = require("./messages - zh.js");

var msg = require("jshint/src/messages.js");

var out = {};
for (var type in msg) {
	for (var code in msg[type]) {
		out[msg[type][code].desc] = han[type][code].desc;
	}
}
console.log(JSON.stringify(out, 0, 4));