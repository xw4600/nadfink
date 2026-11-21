/**
 * Admin behaviour.
 *
 * Confirmation prompts for destructive actions. The prompt text travels in a
 * data attribute rather than an inline onclick, so a feed title containing
 * quotes or angle brackets cannot escape into a script context.
 */
( function () {
	'use strict';

	document.addEventListener( 'click', function ( event ) {
		var button = event.target.closest( '[data-ndf-confirm]' );

		if ( ! button ) {
			return;
		}

		if ( ! window.confirm( button.getAttribute( 'data-ndf-confirm' ) ) ) {
			event.preventDefault();
		}
	} );
}() );