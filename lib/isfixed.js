"use strict";
module.exports = function( file ) {

	// Has ESLint fixed the file contents?
	return file.eslint != null && file.eslint.fixed;
};
