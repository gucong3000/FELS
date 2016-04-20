"use strict";
/* global alert */

(function(factory) {
	if (window.url) {
		factory();
	} else {
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
	var selectedFiles = [];

	var warp = document.querySelector("form .input span");

	// 将selectedFiles中的数据，展现在页面上
	function showFile() {
		var hasFile = selectedFiles.length > 0;
		warp.innerHTML = hasFile ? "" : "未选择文件";
		selectedFiles.forEach(function(file) {
			var span = document.createElement("span");
			var link = document.createElement("a");
			var remove = document.createElement("sup");
			remove.innerHTML = "X";
			remove.addEventListener("click", function() {
				selectedFiles = selectedFiles.filter(function(otherFile) {
					return otherFile !== file;
				});
				showFile();
			});
			link.innerHTML = file.name;
			if (window.URL) {
				link.href = URL.createObjectURL(file);
			} else {
				// 旧浏览器下，使用DataURI方式显示文件
				var oFReader = new FileReader();
				oFReader.onload = function(oFREvent) {
					link.href = oFREvent.target.result;
				};
				oFReader.readAsDataURL(file);
			}
			link.title = "点击预览";
			link.target = "_blank";
			span.appendChild(link);
			span.appendChild(remove);
			warp.appendChild(span);
		});
		inputFile.setCustomValidity(hasFile ? "" : "至少需要选择一个文件");
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
			target.value = "";
		}
		showFile();

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
		var formData = new FormData();
		var configfile = {
			"path": form.path.value,
			"user": form.user.value,
			"password": form.password.value,
		};
		if (selectedFiles.length > 1) {
			selectedFiles.forEach(function(file) {
				formData.append("imagefile[]", file);
			});
		} else {
			configfile.fileName = selectedFiles[0].name;
			formData.append("imagefile", selectedFiles[0]);
		}
		formData.append("configfile", JSON.stringify(configfile));

		var divLoading = document.querySelector(".loading");　　
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
			xhr.upload.onprogress = function(event) {
				if (event.lengthComputable) {
					divLoading.innerHTML = "上传中。已完成：" + event.loaded + "/" + event.total + "字节";
				}　　
			};
			xhr.open("POST", form.url.value || form.action);　　
			xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
			xhr.send(formData);
		})

		.then(function(response) {
			if (response.json) {
				return response.json();
			} else {
				return JSON.parse(response);
			}
		})

		.then(function(json) {
			console.log(json);
			if (json.code === 1000) {
				alert("上传成功:" + JSON.stringify(json.paths));
			} else if (json.code === 1001) {
				alert("用户名或密码错误");
			} else {
				alert(json.info);
			}
		})

		.catch(function(err) {
			console.error(err);
			alert("网络错误");
		}).then(function() {
			root.classList.remove("onupload");
			onupload = false;
		});

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

	document.addEventListener("drop", function(e) {
		e.stopPropagation();
		e.preventDefault(); 
		fileSelect(e);
		switchClass(false);
	});
});
