"use strict";
const fs = require("fs-extra-async");
const path = require("path");
const {

	remote,

} = require("electron");
const json = remote.require("./lib-json");
const stylelintCfgs = json.sort(require("./eslint.json"), true);
const planStylelint = document.querySelector("#stylelint");


// fs.writeFileAsync(require.resolve("./eslint.json"), json.stringify(stylelintCfgs));
function tryRequire(path) {
	try {
		return require(path);
	} catch (ex) {
		return {};
	}
}

function creatSelect(options, name) {
	let opts = [];
	for (let key in options) {
		opts.push(`<option value="${ key }">${ options[key] }</option>`);
	}
	return `<select name="${ name || "severity" }" required>\n\t\t${ opts.join("\n\t\t") }\n\t</select>`;
}

let htmlSeverity = creatSelect({
	error: "错误",
	warning: "警告",
	null: "关闭",
});
let htmlDefaultSeverity = creatSelect({
	error: "错误",
	warning: "警告",
});

let stylelint = {
	get: function(baseDir) {
		return Promise.all([
			fs.readJsonAsync(path.join(baseDir, "package.json")).then(pkg => pkg.stylelint).catch(() => {}),
			fs.readJsonAsync(path.join(baseDir, ".stylelintrc")).catch(() => {}),
			tryRequire(path.join(baseDir, "stylelint.config.js")),
		]).then(cfg => Object.assign.apply(Object, cfg.map(cfg => cfg || {})));
	},
	set: function(baseDir, cfg) {
		let pkgPath = path.join(baseDir, "package.json");
		let rcPath = path.join(baseDir, ".stylelintrc");

		cfg = json.sort(cfg, true);

		return fs.readJsonAsync(pkgPath)

		.then(pkg => {
			if (!pkg.stylelint) {
				throw pkg;
			}
			pkg.stylelint = cfg;
			return fs.writeFileAsync(pkgPath, json.stringify(pkg))

			.then(result => {
				return fs.unlinkAsync(rcPath).then(() => result).catch(() => result);
			});
		})

		.catch(() => {
			return fs.writeFileAsync(rcPath, json.stringify(cfg));
		})

		.then(result => {
			return fs.unlinkAsync(path.join(baseDir, "stylelint.config.js")).then(() => result).catch(() => result);
		});
	},
	html: function() {
		let stylelintHTML = [];
		for (let ruleName in stylelintCfgs) {
			let rule = stylelintCfgs[ruleName];
			let value = rule.value;
			let options = rule.options;
			let message = rule.message;
			let help = `<a href="http://stylelint.io/user-guide/rules/${ ruleName }/" target="_blank">?</a>`;

			if (options) {
				if (!value || !(value in options)) {
					console.error("StyleLint的规则" + ruleName + "未指定正确的默认值");
				}
				value = creatSelect(options, "value");
			} else if (message) {
				message = message.replace(/\$\{\s*(\w+)\s*\}/g, `<input name="value" type="$1" min="0" max="9" value="${ value }" required>`);
				value = `<span>${ message }</span>`;
			} else {
				console.error("StyleLint的规则" + ruleName + "未指定正确的消息");
			}

			if (!rule.severity) {
				console.error("StyleLint的规则" + ruleName + "未指定正确的错误等级");
			}

			stylelintHTML.push(`<fieldset>\n\t<legend>${ ruleName }</legend>\n\t${ htmlSeverity }\n\t${ value }\n\t${ help }\n</fieldset>`);
		}

		stylelintHTML.unshift(`<p><label>默认错误级别：${ htmlDefaultSeverity }</label></p>`);
		return stylelintHTML.join("\n");
	},
	getStylelint: function() {
		let curr = stylelint.curr;
		return stylelint.get(curr.path).then(stylelintRc => {
			curr.stylelint = stylelintRc;

			let rules = stylelintRc.rules || {};

			planStylelint.querySelector("[name=severity]").value = stylelintRc.defaultSeverity || "warning";

			Array.from(planStylelint.querySelectorAll("fieldset")).forEach(fieldset => {
				let ruleName = fieldset.querySelector("legend").textContent.trim();
				let rule = rules[ruleName];
				let severity;
				if (Array.isArray(rule)) {
					if (rule[1]) {
						severity = rule[1].severity;
					}
					rule = rule[0];
				}
				let fieldSeverity = fieldset.querySelector("[name=\"severity\"]");
				let fieldValue = fieldset.querySelector("[name=\"value\"]");
				let defaultOpt = stylelintCfgs[ruleName];

				if (rule === null) {
					fieldSeverity.value = "null";
				} else {
					fieldSeverity.value = severity || stylelintRc.defaultSeverity || defaultOpt.severity || "warning";
				}
				if (fieldValue) {
					if (!(ruleName in rules)) {
						rule = "value" in defaultOpt ? defaultOpt.value : true;
					}
					fieldValue.value = String(rule);
				}
			});
			if (!stylelintRc.rules || !stylelintRc.defaultSeverity) {
				stylelint.setStylelint();
			}
			return stylelintRc;
		});
	},
	setStylelint: function() {
		if (!planStylelint.checkValidity()) {
			planStylelint.querySelector("input:invalid, select:invalid").focus();
			return;
		}
		let curr = stylelint.curr;

		let stylelintRc = curr.stylelint || {};
		stylelintRc.defaultSeverity = planStylelint.querySelector("[name=severity]").value;
		if (!stylelintRc.rules) {
			stylelintRc.rules = {};
		}

		Array.from(planStylelint.querySelectorAll("fieldset")).forEach(fieldset => {
			let ruleName = fieldset.querySelector("legend").textContent.trim();
			let fieldSeverity = fieldset.querySelector("[name=\"severity\"]");
			let fieldValue = fieldset.querySelector("[name=\"value\"]");
			let defaultOpt = stylelintCfgs[ruleName];
			let message;
			let severity;
			let value;

			if (fieldSeverity.value === "null") {
				stylelintRc.rules[ruleName] = null;
			} else {
				if (stylelintRc.defaultSeverity !== fieldSeverity.value) {
					severity = fieldSeverity.value;
				}
				if (fieldValue) {
					value = fieldValue.value;
					if (defaultOpt.options) {
						message = defaultOpt.options[String(value)];
					} else {
						message = defaultOpt.message.replace(/\$\{\s*\w+\s*\}/g, value);
					}
					try {
						value = eval(value);
					} catch (ex) {

					}
				} else {
					value = true;
					message = defaultOpt.message;
				}
				stylelintRc.rules[ruleName] = [value, {
					severity,
					message
				}];
			}
		});
		return stylelint.set(curr.path, curr.stylelint);
	},
};

planStylelint.innerHTML = stylelint.html();

planStylelint.onchange = stylelint.setStylelint;

module.exports = stylelint;
