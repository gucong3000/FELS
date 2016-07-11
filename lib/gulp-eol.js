"use strict";
var through = require( "through2" );

/**
 * gulp 插件，用于换行符统一
 * @param  {String}  options.eol 行结尾，默认"\n"
 * @return {Boolean} options.eof 文件结尾是否添加换行符
 */
module.exports = function( options ) {
	options = options || {};

	var eol = options.eol || "\n";
	var eof = options.eof;

	if ( eof == null ) {
		eof = true;
	}

	function fixBuffer( buf, file ) {

		// buffer转字符串
		var contents = buf.toString();

		// 换行符统一
		var newContents = contents.replace( /[\t ]+\r?\n/g, eol );

		// 文件末尾添加换行符
		if ( eof && newContents[ newContents.length - 1 ] !== eol ) {
			newContents += eol;
		}

		if ( contents === newContents ) {
			return buf;
		} else {

			// 做个标记，供isfixed.js调用
			file.eol = true;

			// 字符串转Buffer
			return new Buffer( newContents );
		}
	}

	return through.obj( function( file, encoding, cb ) {
		if ( !file.isNull() ) {

			if ( file.isStream() ) {
				const BufferStreams = require( "bufferstreams" );
				file.contents = file.contents.pipe( new BufferStreams( ( err, buf, done ) => {
					buf = fixBuffer( buf, file );
					done( null, buf );
					cb( null, file );
				} ) );
				return;
			} else if ( file.isBuffer() ) {
				file.contents = fixBuffer( file.contents, file );
			}
		}
		cb( null, file );
	} );
};
