"use strict";
const styleconfig = require("./styleconfig");
const postcss = require("./gulp-postcss");
// const stylelintconfig = require('stylelint/dist/buildConfig').default(options);

module.exports = () => {
	return [
		postcss(file => {
			return styleconfig(file.path, file.cwd).then(stylelintrc => {
				return {
					processors: [
						require("stylefmt")(stylelintrc),
						require("stylelint")(Object.assign({
							configOverrides: {
								rules: {
									indentation: null,
								}
							}
						}, stylelintrc)),
						// css未来标准提前使用
						require("postcss-cssnext")({
							features: {
								"autoprefixer": {
									browsers: ["last 3 version", "ie > 8", "Android >= 3", "Safari >= 5.1", "iOS >= 5"],

									// should Autoprefixer use Visual Cascade, if CSS is uncompressed.
									cascade: false,

									// If you have no legacy code, this option will make Autoprefixer about 10% faster.
									remove: false
								}
							}
						}),

						// require("precss")(),
						// IE8期以下兼容rem
						require("pixrem"),

						// IE9兼容vmin
						require("postcss-vmin"),

						// IE8以下兼容合集
						// require("cssgrace"),
						// background: linear-gradient(to bottom, #1e5799, #7db9e8);输出为IE滤镜
						require("postcss-filter-gradient"),
						// css压缩
						require("cssnano"),
					],
				};
			});
		})
	];
};
