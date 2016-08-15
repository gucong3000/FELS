"use strict";
let path = require("path");
let fs = require("fs-extra-async");

let newPath = ["bin", "node_modules/.bin"].map(subDir => path.join(__dirname, "..", subDir));

// windows用户，尝试把git目录下的bin目录写入环境变量的path中
if (process.platform === "win32") {
	["%ProgramFiles%/Git", "%ProgramFiles(x86)%/Git", "%USERPROFILE%/AppData/Local/Programs/Git", "%CMDER_ROOT%/vendor/git-for-windows"].some(dir => {
		dir = dir.replace(/%(.+?)%/g, (s, env) => {
			return process.env[env] || s;
		});
		try {
			fs.statSync(dir);
		} catch (ex) {
			return false;
		}
		newPath.push.apply(newPath, ["bin", "usr/bin", "usr/share/vim/vim74"].map(subDir => path.join(dir, subDir)));
		return true;
	});
}

let paths = process.env.Path.split(/\s*;\s*/);
newPath = newPath.filter(dir => paths.indexOf(dir) < 0);
process.env.Path = newPath.concat(paths).join(";");
