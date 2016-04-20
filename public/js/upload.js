"use strict";
/* global alert */

(function(factory) {
	// 判断是否有SB用IE访问
	if (document.documentMode || !document.querySelector) {
		alert("不要用IE！不要用IE！不要用IE！");
		/* jshint ignore:start */
		// 尝试干掉IE6进程并跳转到 Google Chrome Frame 下载页面
		location.href = "javascript:for (var i in open);location.href ='http://rj.baidu.com/soft/detail/17803.html?ald'";
		/* jshint ignore:end */
	} else if (window.URL) {
		factory();
	} else {
		// 加载browser.js，主要是为了统一各浏览器API的名称差异，如webkitURL、mozURL、URL
		var script = document.createElement("script");
		script.type = "text/javascript";
		script.src = "http://gucong3000.github.io/browser.js/browser.min.js";
		document.documentElement.children[0].appendChild(script);
		script.onload = script.onerror = function() {
			script.onload = script.onerror = null;
			factory();
		};
	}
})(function() {
	if (!window.FileReader && !window.URL) {
		alert("您的浏览器不支持此工具，建议您将浏览器升级到最新版本。");
	}

	// selectedFiles数组用来保存用户所选择了的文件
	var selectedFiles = [];

	var warp = document.querySelector("form .input span");

	// 将selectedFiles中的数据，展现在页面上
	function showFile() {
		var hasFile = selectedFiles.length > 0;
		warp.innerHTML = hasFile ? "" : "未选择文件";

		// 遍历本地保存了的文件
		selectedFiles.forEach(function(file, i) {

			// 构建如下这样的DOM元素插入页面
			// <span><a href="blob:http%3A//172.20.4.65/b614aa1c-8d7f-4cb6-95a1-8d4aa00363e4" title="点击预览" target="_blank">Chrysanthemum.jpg</a><sup>X</sup><iframe id="tmp_downloadhelper_iframe" style="display: none;"></iframe></span>
			var span = document.createElement("span");
			var link = document.createElement("a");
			var remove = document.createElement("sup");
			remove.innerHTML = "X";

			// 点击X时，在selectedFiles中删除这个文件，并重新调用showFile渲染界面
			remove.addEventListener("click", function() {
				selectedFiles = selectedFiles.filter(function(otherFile) {
					return otherFile !== file;
				});
				showFile();
			});
			link.innerHTML = file.name;
			link.title = "点击预览";
			link.target = "_blank";

			// 文件预览功能
			if (window.URL) {
				// 优先尝试ObjectURL方式预览文件
				link.href = URL.createObjectURL(file);
			} else {
				// 旧浏览器下，使用DataURI方式预览文件
				// 由于担心base64运算卡死浏览器，所以将运算工作分散到了setTimeout和focus、mouseenter中
				setTimeout(function() {
					giveDataUri(link, file);
				}, i * 200);
				link.onfocus = link.onmouseenter = function() {
					giveDataUri(link, file);
				};
			}
			// 在浏览器dom中插入元素
			span.appendChild(link);
			span.appendChild(remove);
			warp.appendChild(span);
		});
		// 使用自定义错误方式设置表单验逻辑
		inputFile.setCustomValidity(hasFile ? "" : "至少需要选择一个文件");
	}

	function giveDataUri(link, file) {
		if (link.href) {
			return;
		}
		// 同时生成多个文件的DataURI
		var oFReader = new FileReader();
		oFReader.onload = function(oFREvent) {
			link.href = oFREvent.target.result;
		};
		oFReader.readAsDataURL(file);
	}

	// 用户选择了文件
	function fileSelect(e) {
		var target = e ? (e.dataTransfer || e.target) : inputFile;
		var sameNames = [];
		var emptys = [];
		var message = [];
		selectedFiles = selectedFiles.concat(Array.from(target.files).filter(function(newFile) {
			// 排除空文件
			var notEmpty = newFile.size > 0;
			if (!notEmpty) {
				emptys.push(newFile.name);
			}
			return notEmpty;
		}).filter(function(newFile) {
			// 检查重名的文件
			return !selectedFiles.some(function(oldfile) {
				var same = oldfile.name === newFile.name;
				if (same) {
					sameNames.push(newFile.name);
				}
				return same;
			});
		}));

		if (target.type === "file") {
			// 清空input[type='file']的值，是为了保证每次用户选择文件时，都能触发“change”事件
			target.value = "";
		}

		// 重新渲染UI
		showFile();

		// 向用户alert，哪些他所选择了的文件被过滤掉了
		if (sameNames.length) {
			message.push("您选择的文件中，有文件名相同的文件，已为您排除：\n" + sameNames.join("\n"));
		}
		if (emptys.length) {
			message.push("您选择的文件中，有文件大小为0，已为您排除：\n" + emptys.join("\n"));
		}
		if (message.length) {
			console.log(message);
			alert(message.join("\n"));
		}
	}

	// 文件选择框
	var inputFile = document.querySelector("[type='file']");
	inputFile.addEventListener("change", fileSelect);

	// 如果不每次清空input[type='file']，这一行可以保证用户刷新页面后不丢数据
	fileSelect();

	// 表单对象
	var form = document.querySelector("form");
	var onupload;

	// 用户点击“提交”
	form.addEventListener("submit", function(e) {
		e.preventDefault();
		if (onupload) {
			return;
		}

		// 构建FormData对象
		var formData = new FormData();
		var configfile = {
			"path": form.path.value,
			"user": form.user.value,
			"password": form.password.value
		};

		// 向FormData对象中添加文件
		if (selectedFiles.length > 1) {
			selectedFiles.forEach(function(file) {
				formData.append("imagefile[]", file);
			});
		} else {
			configfile.fileName = selectedFiles[0].name;
			formData.append("imagefile", selectedFiles[0]);
		}

		// 向FormData对象中添与后端协商好的配置信息
		formData.append("configfile", JSON.stringify(configfile));

		// 声明ajax对象
		new Promise(function(resolve, reject) {
			var xhr = new XMLHttpRequest();
			xhr.onreadystatechange = function() {
				if (xhr.readyState === 4) {
					var status = xhr.status;
					if (status >= 200 && status < 300 || status === 304) {
						resolve(xhr.responseText || xhr.response);
					} else {
						reject(xhr);
					}
				}
			};
			// ajax上传进度查询
			xhr.upload.onprogress = function(event) {
				if (event.lengthComputable) {
					divLoading.innerHTML = "上传中。已完成：" + event.loaded + "/" + event.total + "字节";
				}　　
			};

			// 正式开始发送ajax
			xhr.open("POST", form.url.value || form.action);　　
			xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
			xhr.send(formData);
		})

		.then(function(response) {
			// 将服务前端传回的数据转为json
			if (response.json) {
				return response.json();
			} else {
				return JSON.parse(response);
			}
		})

		.then(function(json) {
			console.log(json);
			// 处理服务器端返回结果
			if (json.code === 1000) {
				alert("上传成功:" + JSON.stringify(json.paths));
			} else if (json.code === 1001) {
				alert("用户名或密码错误");
			} else {
				alert(json.info);
			}
		})

		["catch"](function(err) {
			console.error(err);
			alert("网络错误");
		}).then(function() {
			// ajax完成后，擦屁股
			root.classList.remove("onupload");
			onupload = false;
		});

		// ajax开始之前，处理网页界面
		var divLoading = document.querySelector(".loading");　　
		divLoading.innerHTML = "正在上传";
		root.classList.add("onupload");
		onupload = true;
	});

	// 用户点击“清空”
	form.addEventListener("reset", function(e) {
		e.preventDefault();
		selectedFiles = [];
		showFile();
	});

	// 用户点击“请选择文件”按钮
	var button = document.querySelector(".input button");
	button.addEventListener("click", function(e) {
		e.preventDefault();
		inputFile.click();
	});

	// 将文件上传控件的宽度调整为与“请选择文件”按钮的宽度一致
	inputFile.style.width = getComputedStyle(button, null).width;


	// 拖动上传
	var rootClassTimer;

	var root = document.documentElement;

	// 在html元素上动态添加dragover这个class，供UI层css使用
	function switchClass(on) {
		clearTimeout(rootClassTimer);
		rootClassTimer = setTimeout(function() {
			root.classList[on ? "add" : "remove"]("dragover");
		}, on ? 0 : 60);
	}

	document.addEventListener("dragleave", function(e) {
		switchClass(false);
		e.preventDefault(); 
	});
	document.addEventListener("dragover", function(e) {
		switchClass(true);
		e.preventDefault(); 
	});
	document.addEventListener("dragover", function(e) {
		switchClass(true);
		e.preventDefault(); 
	});

	// 文件拖动方式选择文件
	document.addEventListener("drop", function(e) {
		e.stopPropagation();
		e.preventDefault(); 
		fileSelect(e);
		switchClass(false);
	});
});
