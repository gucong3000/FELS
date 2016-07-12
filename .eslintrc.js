/* eslint-env node */
"use strict";
module.exports = {
	"root": true,
	"parserOptions": {
		"ecmaVersion": 6,
		"ecmaFeatures": {
			"jsx": true
		}
	},
	"env": {
		"node": true,
		"amd": true,
		"es6": true
	},
	"rules": {
		"no-negated-in-lhs": "error",
		"no-cond-assign": [
			"error",
			"except-parens"
		],
		"curly": [
			"error",
			"all"
		],
		"object-curly-spacing": [
			"error",
			"always"
		],
		"computed-property-spacing": [
			"error",
			"always"
		],
		"array-bracket-spacing": [
			"error",
			"never"
		],
		"eqeqeq": [
			"error",
			"smart"
		],

		// Shows errors where jshint wouldn't (see jshint "expr" rule)
		// clarifying this with eslint team
		// "no-unused-expressions": "error",
		"wrap-iife": [
			"error",
			"inside"
		],
		"no-caller": "error",
		"quotes": [
			"error",
			"double"
		],
		"no-undef": "error",
		"no-unused-vars": "error",
		"operator-linebreak": [
			"error",
			"after"
		],
		"comma-style": [
			"error",
			"last"
		],
		"camelcase": [
			"error",
			{
				"properties": "never"
			}
		],
		"dot-notation": [
			"error",
			{
				"allowPattern": "^[a-z]+(_[a-z]+)+$"
			}
		],
		"no-mixed-spaces-and-tabs": "error",
		"no-trailing-spaces": "error",
		"no-multi-str": "error",
		"comma-dangle": [
			"error",
			"never"
		],
		"comma-spacing": [
			"error",
			{
				"before": false,
				"after": true
			}
		],
		"space-before-blocks": [
			"error",
			"always"
		],
		"strict": [
			"error",
			"safe"
		],
		"space-in-parens": [
			"error",
			"never"
		],
		"keyword-spacing": [
			2
		],
		"semi": [
			"error",
			"always"
		],
		"semi-spacing": [
			"error",
			{
				// Because of the `for ( ; ...)` requirement
				// "before": true,
				"after": true
			}
		],
		"space-infix-ops": "error",
		"eol-last": "error",
		"lines-around-comment": [
			"error",
			{
				"beforeLineComment": true
			}
		],
		"linebreak-style": [
			"error",
			"unix"
		],
		"no-with": "error",
		"brace-style": "error",
		"space-before-function-paren": [
			"error",
			"never"
		],
		"no-loop-func": "error",
		"no-spaced-func": "error",
		"key-spacing": [
			"error",
			{
				"beforeColon": false,
				"afterColon": true
			}
		],
		"space-unary-ops": [
			"error",
			{
				"words": false,
				"nonwords": false
			}
		],
		"no-multiple-empty-lines": 2
	}
};
