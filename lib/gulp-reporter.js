"use strict";
var through = require("through2");
var PluginError = require("gulp-util").PluginError;

// require("./jshint-msg");

/**
 * 代码错误汇报函数，在浏览器中运行，用于将jshinit收集到的报出的错误信息在浏览器控制台中弹出
 * 注意！！此函数将被toString()后发送到浏览器，并非在node下运行！！
 * @param  {Array}		errors			错误信息
 * @param  {Boolean}	errors[0][0]	是否警告，true为警告，false为错误
 * @param  {Int}		errors[0][1]	错误所在行号
 * @param  {Int}		errors[0][2]	错误所在列号
 * @param  {Int}		errors[0][3]	错误消息
 * @param  {Int}		errors[0][4]	错误的ID，eslint下为规则名，jshint下为规则ID
 * @param  {String}		path			js文件相对路径
 */
var jsBrowserReporter = (function(errors, path) {

	/* eslint-env browser */
	var uri;

	// 利用e.stack来分析出js文件所在路径，IE不支持
	try {
		throw new Error("_");
	} catch (e) {
		try {
			e.stack.replace(/(?:\bat\b|@).*?(\b\w+\:\/{2,}.*?)(?:\:\d+){2,}/, function(m, url) {
				uri = url;
			});
		} catch (ex) {

		}
	}

	// 利用<script>的readyState，查找js文件所在路径
	uri = uri || (function() {

		// 页面上所有的<script>标签
		var scripts = document.scripts || document.getElementsByTagName("script");
		var lastSrc;

		// 倒序遍历所有<script>
		for (var i = scripts.length - 1; i >= 0; i--) {
			var script = scripts[i];

			// <script>含有src属性
			if (script.src) {

				// script.readyState应该是只支持IE的，interactive意为js还未执行完毕.
				if (script.readyState === "interactive") {

					// 找到当前js文件路径了
					return script.src;
				}
				lastSrc = lastSrc || script.src;
			}
		}

		// 找不到当前js文件路径了，用最后一个拥有src属性的<script>标签的src属性值充数
		return lastSrc;
	})();

	// 获取js文件当前路径
	if (!uri) {
		return;
	}

	// 延迟运行，以免干扰js正常运行流程
	setTimeout(function() {

		// 将文件路径与模块路径拼接为完整的url
		uri = uri.replace(/^((?:\w+\:)?\/{2,}[^\/]+\/)?.*$/, "$1" + path);
		var unshowMsg = "";
		errors.forEach(window.Error && "fileName" in Error.prototype ? function(err) {
			var message = err[3] + "\t(" + err[4] + ")";

			// 方式一：new Error，对error的属性赋值，然后throw
			var errorObj;
			try {
				errorObj = new SyntaxError(message);
			} catch (ex) {
				errorObj = new Error(message);
			}

			// 设置文件路径
			errorObj.fileName = uri;

			// 设置行号
			errorObj.lineNumber = err[1];

			// 设置列号
			errorObj.columnNumber = err[2];

			// 设置消息
			errorObj.message = message;

			// 抛出错误
			if (err[0]) {
				console.warn(errorObj);
			} else {
				setTimeout(function() {
					throw errorObj;
				}, 0);
			}
		} : function(err) {

			// 方式二：console方式汇报错误
			err = ("SyntaxError: [ 3 ]\t([ 4 ])\n\tat (" + uri + ":[ 1 ]:[ 2 ])").replace(/\[\s*(\d+)\s*\]/g, function(s, key) {
				return err[+key] || s;
			});

			try {

				// 如果你追踪错误提示来找到这一行，说明你来错误了地方，请按控制台中提示的位置去寻找代码。
				console[err[0] ? "warn" : "error"](err);
			} catch (ex) {
				try {

					// 如果你追踪错误提示来找到这一行，说明你来错误了地方，请按控制台中提示的位置去寻找代码。
					console.log(err);
				} catch (ex) {

					// 不支持console的浏览器中，记录下消息，稍后alert
					unshowMsg += err + "\n";
				}
			}
		});

		// 不支持console.error的浏览器，用alert弹出错误
		if (unshowMsg) {
			alert(unshowMsg);
		}
	}, 200);
}).toString().replace(/^(function)\s*\w+/, "$1");


/**
 * 检查代码去除块注释后、合并连续换行符之后，还有有几行
 * @param  {String} code 要检查的代码
 * @return {Number}      代码行数
 */
function lineCount(code) {
	var lineCount = code.replace(/\/\*(?:.|\r?\n)+?\*\//g, "").replace(/(?:\r?\n)+/g, "\n").trim().match(/\n/g);
	return lineCount ? lineCount.length : 0;
}

/**
 * 检查代码是否压缩版本
 * @param  {Buffer|String} contents 要检查的代码
 * @return {Boolean}       代码是否压缩版
 */
function isMinFile(contents) {
	contents = contents.toString();
	return !contents || /\bsourceMappingURL=[^\n]+\.map\b/.test(contents) || lineCount(contents) < 3;
}

function isIgnore(file) {
	return /[\.\-]min\.\w+$/.test(file.relative) || isMinFile(file.contents);
}

module.exports = function(options) {
	options = options || {};

	let fails = [];
	let browser = options.browser;
	let fail = typeof options.fail == null ? !browser : options.fail;

	/**
	 * 错误信息收集
	 * @param  {Vinyl}		file			https://github.com/gulpjs/vinyl
	 * @param  {Array}		errors			错误信息
	 * @param  {Boolean}	errors[0][0]	是否警告，true为警告，false为错误
	 * @param  {Int}		errors[0][1]	错误所在行号
	 * @param  {Int}		errors[0][2]	错误所在列号
	 * @param  {Int}		errors[0][3]	错误消息
	 * @param  {Int}		errors[0][4]	错误的ID，eslint下为规则名，jshint下为规则ID
	 * @param  {Int}		errors[0][5]	源代码上下文
	 * @param  {String}		type			Linter的名字
	 */
	function collectError(file, errors, type) {
		let uri = file.relative.replace(/\\/g, "/");
		let fail;
		console.log(`==============================  ${ type }  ==============================`);
		console.log(`* ${ uri } `);
		console.log("----------------------------------------------------------------------");

		errors.forEach(error => {
			console[error[0] ? "warn" : "error"](`[${ error[1] }:${ error[2] }]\t${ error[3] } (${ error[4] })\n\t${ error[5].trim() }`);
			if (!error[0]) {
				fail = true;
			}
		});

		console.log("----------------------------------------------------------------------\n");

		if (fail) {
			fails.push(uri);
		}

		function appendReporter(buf) {

			// 在buffer中的代码中注入报错语句
			var contentReporter;

			if (file.jshint || file.eslint) {
				contentReporter = `\n;\n(${ jsBrowserReporter })(${ JSON.stringify(errors) }, ${ JSON.stringify(uri) });`;
			}

			// 未来要写else语句，兼容css报错

			return Buffer.concat([buf, new Buffer(contentReporter)]);
		}

		if (browser) {
			if (file.isStream()) {
				const BufferStreams = require("bufferstreams");
				file.contents = file.contents.pipe(new BufferStreams((err, buf, done) => {
					done(null, appendReporter(buf));
				}));
				return;
			} else if (file.isBuffer()) {
				file.contents = appendReporter(file.contents);
			}
		}
	}

	return through.obj({
		objectMode: true
	}, function(file, encoding, done) {

		// 查找eslint错误信息
		if (file.eslint && file.eslint.messages.length && !isIgnore(file)) {
			let errors = file.eslint.messages.map(msg => [

				// 是否警告
				msg.severity === 1,

				// 行号
				msg.line,

				// 列号
				msg.column,

				// 错误信息
				msg.message,

				// 错误ID
				msg.ruleId,

				// 源代码上下文
				msg.source
			]);
			collectError(file, errors, "ESLint");
		}

		// 查找jshint错误信息
		if (file.jshint && !file.jshint.success && !file.jshint.ignored && !isIgnore(file)) {
			let errors = file.jshint.results.map(result => [

				// jshint无警告，全部算错误
				false,

				// 行号
				result.error.line,

				// 列号
				result.error.character,

				// 错误信息
				result.error.reason,

				// 错误ID
				result.error.code,

				// 源代码上下文
				result.error.evidence
			]);
			collectError(file, errors, "JSHint");
		}
		this.push(file);
		done();
	}, function(done) {

		// 流程结束后信息汇总
		if (fails.length) {
			let message = "JS Lint failed for: " + fails.join(", ");
			fails = [];
			if (fail) {
				console.error(message);
			} else {
				this.emit("error", new PluginError("gulp-jshint", {
					message: message,
					showStack: false
				}));
			}
		}
		done();
	});
};
