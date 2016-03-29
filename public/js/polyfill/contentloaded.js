/*!
 * contentloaded.js
 *
 * Author: Diego Perini (diego.perini at gmail.com)
 * Summary: cross-browser wrapper for DOMContentLoaded
 * Updated: 20101020
 * License: MIT
 * Version: 1.2
 *
 * URL:
 * http://javascript.nwbox.com/ContentLoaded/
 * http://javascript.nwbox.com/ContentLoaded/MIT-LICENSE
 *
 */

// @win window reference
// @fn function reference
'use strict';

function contentLoaded(fn) {

	var done = false,
		top = true,

		root = doc.documentElement,
		modern = doc.addEventListener,

		add = modern ? 'addEventListener' : 'attachEvent',
		rem = modern ? 'removeEventListener' : 'detachEvent',
		pre = modern ? '' : 'on',

		init = function(e) {
			if (e.type === 'readystatechange' && doc.readyState !== 'complete') {
				return;
			}
			(e.type === 'load' ? win : doc)[rem](pre + e.type, init, false);
			if (!done && (done = true)) {
				fn.call(win, e.type || e);
			}
		},

		poll = function() {
			try {
				root.doScroll('left');
			} catch (e) {
				setTimeout(poll, 50);
				return;
			}
			init('poll');
		};

	if (!modern && root.doScroll) {
		try {
			top = !win.frameElement;
		} catch (e) {

		}
		if (top) {
			poll();
		}
	}
	doc[add](pre + 'DOMContentLoaded', init, false);
	doc[add](pre + 'readystatechange', init, false);
	win[add](pre + 'load', init, false);
}

var fns,
	win = window,
	doc = win.document;

module.exports = function(fn) {
	if (doc.readyState === 'complete') {
		fn.call(win, 'lazy');
	} else if (fns) {
		fns.push(fn);
	} else {
		fns = [fn];
		contentLoaded(window, function(e) {
			for (var i = 0; i < fns.length; i++) {
				fns[i].call(this, e);
			}
		});
	}
};