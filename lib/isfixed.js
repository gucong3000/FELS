"use strict";
module.exports = function(file) {
	if (!file.isNull()) {
		return [
			"jsbeautify",
			"eslint",
			"editorconfig",
		].some(pluginName => {
			if (file[pluginName] && file[pluginName].fixed) {
				console.log(`File is fixed by "${ pluginName }":\t${ file.relative }`);
				return true;
			}
		});
	}
};
