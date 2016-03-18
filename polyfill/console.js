(function(udf){
	var win = window,
		doc = document,
		html = doc.documentElement,
		console = win.console,
		logOld,
		node = create("console"),
		nodeHTML = "<div style=\"background: #ccc; padding: 0 1em; zoom: 1;\"><div style=\"float: right;\"><a href=\"#clear\">清除<a> <a href=\"#close\">关闭<a></div>调试控制台</div>",
		consoleStyle = "XMLHttpRequest" in window ? "position: fixed; bottom: 0; left: 0; max-height: 300px;" : "position: absolute; top: expression((function(me){try{return me.offsetParent.scrollTop+me.offsetParent.clientHeight-me.offsetHeight}catch(e){}})(this));";;

	//Firefox\Chrome下不使用自定义控制台，原生的已经很NB了
	if(win.console && console.dir){
		return;
	}

	//创建Element的工厂方法
	function create(className, parent){
		var node = doc.createElement("div");
		if(className) {
			node.className = className;
		}
		if(parent){
			parent.appendChild(node)
		}
		return node;
	}

	//控制台添加一行
	function addLog(cont){
		var line = create("line", node);
		line.innerHTML = cont || "&nbsp;";
		line.style.cssText = "border-bottom: 1px solid #ccc; padding: .25em 1em; zoom: 1;";
		resize();
	}

	//计算控制台大小
	function resize(){
		if(!("XMLHttpRequest" in window)){
			node.style.height = node.scrollHeight >= 300 ? 300 : "auto";
		}
		html.lastChild.appendChild(node);
		node.parentNode.style.paddingBottom = node.offsetHeight;
	}

	//字符串转义以免被解析为HTML
	function txt2html(text){
		var line = doc.createElement("div");
		line.innerText = text.replace(/\s+/g, " ");
		return line.innerHTML;
	}

	//对象转换为字符串
	function obj2txt(obj){
		var str;
		try{
			//数组
			if( obj instanceof Array ){
				str = "[Array] [ " + obj.join(", ") + "]";
			//element
			} else if(obj.outerHTML) {
				str = "[Element] " + obj.outerHTML;
			//Function
			} else if( obj.call && obj.apply ) {
				str = "[Function] " + obj.toString();
			//其他对象
			} else {
				str = obj.toString();
				if(/Error\]/.test(str)){
					str += " " + obj.number;
					str += ": " + obj.message || obj.description;
				}
			}
		} catch(ex) {
			str = String(obj);
		}
		return txt2html(str.replace(/^\[object\s+/, "["));
	}

	//console.log
	function log(){
		var args = Array.prototype.slice.call(arguments, 0),
			evalFn = [],
			i = 0;
		for(;i < args.length; i++){
			addLog(obj2txt(args[i]));
			evalFn.push("arguments[" + i +"]");
		}

		//如果浏览器自身有控制台，则想起输出一份
		if(logOld){
			try{
				//apply和call在IE下都离奇的不能用，被迫使用eval
				eval("logOld(" + evalFn.join(",") + ")");
			}catch(ex){
			}
		}
	}

	//设置控制台样式
	node.style.cssText = consoleStyle + "line-height: 1.5; width: 100%; clear: both; zoom: 1; background: #fff; font-size: 12px; overflow: hidden; overflow-y: auto;"
	node.innerHTML = nodeHTML;

	//清空、关闭控制台
	node.onclick = function(){
		var href = event.srcElement.getAttribute("href");
		if(href){
			if(/#clear$/.test(href)){
				//清空
				node.innerHTML = nodeHTML;
			} else if (/#close$/.test(href)){
				//关闭
				node.style.display = "none";
			}
			resize();
			return false;
		}
	}

	if(console) {
		//保存旧的console.log接口
		logOld = console.log;
	} else {
		//IE6下创建window.console
		win.console = console = {}
	}

	//控制台访问接口
	console.log = log;
	console.error = log;
	console.debug = log;
	console.dir = function(obj){
		var str = "";
		for(var i in obj){
			str += "<div>" + txt2html(i) + " : " + obj2txt(obj[i]) + "</div>";
		}
		addLog(str);
	};

	//js报错监控
	win.onerror = function(sMsg,sUrl,sLine){
		addLog("<div style=\"float: right\">" + sUrl + " 第" + sLine+"行</div>[error] <span style=\"color: red;\">" + sMsg + "</span>");
		return true;
	};

})();
