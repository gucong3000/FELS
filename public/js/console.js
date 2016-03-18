/* jshint strict:false */
(function(window) {
	var document = window.document,
		html = document.documentElement,
		console = window.console,
		node = create("console"),
		nodeHTML = "<div style=\"background: #ccc; padding: 0 1em; zoom: 1;\"><div style=\"float: right;\"><a href=\"#clear\">清除<a> <a href=\"#close\">关闭<a></div>调试控制台</div>",
		consoleStyle = "XMLHttpRequest" in window ? "position: fixed; bottom: 0; left: 0; max-height: 300px;" : "position: absolute; top: expression((function(me){try{return me.offsetParent.scrollTop+me.offsetParent.clientHeight-me.offsetHeight}catch(e){}})(this));",
		oldConsole;

	//Firefox\Chrome下不使用自定义控制台，原生的已经很NB了
	if (console && console.dir) {
		//return;
	}

	//创建Element的工厂方法
	function create(className, parent) {
		var node = document.createElement("div");
		if (className) {
			node.className = className;
		}
		if (parent) {
			parent.appendChild(node);
		}
		return node;
	}

	//控制台添加一行
	function addLog(args, color) {
		var line,
			i = 0;
		for (; i < args.length; i++) {
			line = create("line", node);
			line.innerHTML = obj2txt(args[i]) || "&nbsp;";
			line.style.cssText = "border-bottom: 1px solid #ccc; padding: .25em 1em; zoom: 1; color:" + (color || "black");
		}
		resize();
	}

	//计算控制台大小
	function resize() {
		if (!("XMLHttpRequest" in window)) {
			node.style.height = node.scrollHeight >= 300 ? 300 : "auto";
		}
		html.lastChild.appendChild(node);
		node.parentNode.style.paddingBottom = node.offsetHeight;
	}

	//字符串转义以免被解析为HTML
	function txt2html(text) {
		var line = document.createElement("div");
		line.innerText = text.replace(/\s+/g, " ");
		return line.innerHTML;
	}

	//对象转换为字符串
	function obj2txt(obj) {
		var str;
		try {
			//数组
			if (obj instanceof Array) {
				str = "[Array] [ " + obj.join(", ") + "]";
				//element
			} else if (obj.outerHTML) {
				str = "[Element] " + obj.outerHTML;
				//Function
			} else if (obj.call && obj.apply) {
				str = "[Function] " + obj.toString();
				//其他对象
			} else {
				str = obj.toString();
				if (/\bError\]/.test(str)) {
					str += " " + obj.number;
					str += ": " + obj.message || obj.description;
				}
			}
		} catch (ex) {
			str = String(obj);
		}
		return txt2html(str.replace(/^\[object\s+/, "["));
	}

	//console.log
	function log() {
		addLog(arguments);
	}

	function error() {
		addLog(arguments, "red");
	}

	function assert(expression) {
		if (expression) {
			log([].slice.call(arguments, 1));
		}
	}

	var countObj = {};

	function count(label) {
		label = String(label);
		if (!countObj[label]) {
			countObj[label] = 1;
		}
		log(label + ": " + countObj[label]++);
	}

	function clear() {
		node.innerHTML = nodeHTML;
	}

	//设置控制台样式
	node.style.cssText = consoleStyle + "line-height: 1.5; width: 100%; clear: both; color: black; zoom: 1; background: #fff; font-size: 12px; overflow: hidden; overflow-y: auto;";
	node.innerHTML = nodeHTML;

	//清空、关闭控制台
	node.onclick = function() {
		var href = event.srcElement.getAttribute("href");
		if (href) {
			if (/#clear$/.test(href)) {
				//清空
				clear();
			} else if (/#close$/.test(href)) {
				//关闭
				node.style.display = "none";
			}
			resize();
			return false;
		}
	};

	if (console) {
		//保存旧的console.log接口
		oldConsole = console;
	} else {
		//IE6下创建window.console
		window.console = {
			error: error,
			debug: log,
			count: count,
			warn: log,
			info: log,
			assert: assert,
			log: log,
			clear: clear,
		};
	}

	//js报错监控
	window.onerror = function(sMsg, sUrl, sLine) {
		addLog("<div style=\"float: right\">" + sUrl + " 第" + sLine + "行</div>[error] <span style=\"color: red;\">" + sMsg + "</span>");
		return true;
	};

})(window);