"use strict";
module.exports = function( file ) {

	// Has ESLint fixed the file contents?
	return  file.eol || ( file.eslint && file.eslint.fixed );
};
