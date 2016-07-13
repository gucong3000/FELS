"use strict";
module.exports = function(file) {
	if (!file.isNull()) {

		// Has ESLint fixed the file contents?
		return (file.editorconfig && file.editorconfig.fixed) || (file.eslint && file.eslint.fixed);
	}
};
