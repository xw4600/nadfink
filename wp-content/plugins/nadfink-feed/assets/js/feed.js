/**
 * NadFink Feed frontend behaviour.
 *
 * Everything here is an enhancement over markup that already works: search is
 * a real form and categories are real links, so with scripting disabled the
 * feed still filters and paginates. JavaScript adds instant filtering, the
 * theme toggle, per-visitor dismissal and relative timestamps.
 *
 * Dismissed article ids are kept in localStorage. They are never transmitted
 * to the server, so nothing about what a visitor reads reaches WordPress and
 * no cookie notice is required.
 */
( function () {
	'use strict';

	var STORAGE_KEYS = {
		theme: 'ndf:theme',
		dismissed: 'ndf:dismissed'
	};

	/**
	 * Read a JSON array from localStorage, tolerating unavailable storage.
	 *
	 * Safari in private mode and some corporate browsers throw on access, and
	 * a feed reader must not break because of it.
	 *
	 * @param {string} key Storage key.
	 * @return {Array} Stored array, or an empty one.
	 */
	function readList( key ) {
		try {
			var raw = window.localStorage.getItem( key );
			if ( ! raw ) {
				return [];
			}
			var parsed = JSON.parse( raw );
			return Array.isArray( parsed ) ? parsed : [];
		} catch ( e ) {
			return [];
		}
	}

	/**
	 * Persist a JSON array, ignoring quota or privacy errors.
	 *
	 * @param {string} key Storage key.
	 * @param {Array}  value Value to store.
	 */
	function writeList( key, value ) {
		try {
			window.localStorage.setItem( key, JSON.stringify( value ) );
		} catch ( e ) {
			// Storage full or blocked; the feature degrades, nothing breaks.
		}
	}

	/**
	 * The visitor's stored theme choice, if any.
	 *
	 * @return {string|null} 'light', 'dark', or null.
	 */
	function storedTheme() {
		try {
			var value = window.localStorage.getItem( STORAGE_KEYS.theme );
			return value === 'light' || value === 'dark' ? value : null;
		} catch ( e ) {
			return null;
		}
	}

	/**
	 * Remember the visitor's theme choice.
	 *
	 * @param {string} theme 'light' or 'dark'.
	 */
	function storeTheme( theme ) {
		try {
			window.localStorage.setItem( STORAGE_KEYS.theme, theme );
		} catch ( e ) {
			// Ignore.
		}
	}

	/**
	 * Resolve the theme the operating system is currently asking for.
	 *
	 * @return {string} 'light' or 'dark'.
	 */
	function systemTheme() {
		return window.matchMedia && window.matchMedia( '(prefers-color-scheme: dark)' ).matches
			? 'dark'
			: 'light';
	}

	/**
	 * Human readable age of a timestamp, matching the server's phrasing.
	 *
	 * @param {Date} date Parsed date.
	 * @return {string} Relative label.
	 */
	function relativeTime( date ) {
		var seconds = Math.floor( ( Date.now() - date.getTime() ) / 1000 );

		if ( seconds < 60 ) {
			return 'just now';
		}

		var minutes = Math.floor( seconds / 60 );
		var hours = Math.floor( seconds / 3600 );
		var days = Math.floor( seconds / 86400 );

		if ( minutes < 60 ) {
			return minutes + ( minutes === 1 ? ' min ago' : ' min ago' );
		}
		if ( hours < 24 ) {
			return hours + ( hours === 1 ? ' hour ago' : ' hours ago' );
		}
		if ( days < 7 ) {
			return days + ( days === 1 ? ' day ago' : ' days ago' );
		}
		if ( days < 365 ) {
			var weeks = Math.floor( days / 7 );
			return weeks + ( weeks === 1 ? ' week ago' : ' weeks ago' );
		}

		return date.toLocaleDateString( undefined, { month: 'short', day: 'numeric' } );
	}

	/**
	 * One feed instance on the page.
	 *
	 * @param {HTMLElement} root The .ndf container.
	 */
	function Feed( root ) {
		this.root = root;
		this.cards = Array.prototype.slice.call( root.querySelectorAll( '.ndf-card' ) );
		this.searchInput = root.querySelector( '[data-ndf-search-input]' );
		this.searchForm = root.querySelector( '[data-ndf-search-form]' );
		this.statusText = root.querySelector( '.ndf-status-text' );
		this.restoreButton = root.querySelector( '[data-ndf-restore]' );
		this.restoreCount = root.querySelector( '.ndf-restore-count' );
		this.collapseThreshold = parseInt( root.getAttribute( 'data-ndf-collapse' ), 10 ) || 0;

		this.dismissed = readList( STORAGE_KEYS.dismissed );
		this.query = '';

		this.initTheme();
		this.initFilterToggle();
		this.initSearch();
		this.initDismiss();
		this.initCollapse();
		this.refreshTimestamps();
	}

	/**
	 * Apply the stored or system theme and wire up the toggle.
	 */
	Feed.prototype.initTheme = function () {
		var self = this;
		var fallback = this.root.getAttribute( 'data-ndf-default-theme' ) || 'system';

		var apply = function ( theme ) {
			self.root.setAttribute( 'data-ndf-theme', theme );

			var toggle = self.root.querySelector( '[data-ndf-theme-toggle]' );
			if ( toggle ) {
				toggle.setAttribute(
					'aria-label',
					theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
				);
			}
		};

		apply( storedTheme() || ( fallback === 'system' ? systemTheme() : fallback ) );

		var toggle = this.root.querySelector( '[data-ndf-theme-toggle]' );
		if ( ! toggle ) {
			return;
		}

		toggle.addEventListener( 'click', function () {
			var current = self.root.getAttribute( 'data-ndf-theme' );
			var next = current === 'dark' ? 'light' : 'dark';
			apply( next );
			storeTheme( next );
		} );

		// Follow the system while the visitor has expressed no preference.
		if ( ! storedTheme() && window.matchMedia ) {
			var query = window.matchMedia( '(prefers-color-scheme: dark)' );
			var onChange = function ( event ) {
				var mode = self.root.getAttribute( 'data-ndf-default-theme' ) || 'system';
				if ( mode === 'system' && ! storedTheme() ) {
					apply( event.matches ? 'dark' : 'light' );
				}
			};
			if ( query.addEventListener ) {
				query.addEventListener( 'change', onChange );
			} else if ( query.addListener ) {
				query.addListener( onChange );
			}
		}
	};

	/**
	 * Show or hide the category link panel.
	 */
	Feed.prototype.initFilterToggle = function () {
		var toggle = this.root.querySelector( '.ndf-filter-toggle' );
		if ( ! toggle ) {
			return;
		}

		// The panel id is a uuid, so resolve it by id rather than as a selector.
		var panel = document.getElementById( toggle.getAttribute( 'aria-controls' ) );

		if ( ! panel ) {
			return;
		}

		var current = this.root.getAttribute( 'data-ndf-category' );
		if ( current ) {
			panel.hidden = false;
			toggle.setAttribute( 'aria-expanded', 'true' );
		}

		toggle.addEventListener( 'click', function () {
			var open = panel.hidden;
			panel.hidden = ! open;
			toggle.setAttribute( 'aria-expanded', open ? 'true' : 'false' );
		} );
	};

	/**
	 * Instant client side search layered over the server side form.
	 */
	Feed.prototype.initSearch = function () {
		var self = this;
		var input = this.searchInput;

		if ( input ) {
			this.query = ( input.value || '' ).trim().toLowerCase();

			var run = function () {
				self.query = ( input.value || '' ).trim().toLowerCase();
				self.filter();
			};

			input.addEventListener( 'input', debounce( run, 120 ) );
			input.addEventListener( 'search', run );
		}

		// Keep the address bar shareable after a scripted search.
		if ( this.searchForm && input ) {
			this.searchForm.addEventListener( 'submit', function ( event ) {
				if ( ! self.query ) {
					return;
				}
				event.preventDefault();
				self.filter();

				var url = new URL( window.location.href );
				url.searchParams.set( 'ndf_search', self.query );
				window.history.replaceState( {}, '', url );
			} );
		}
	};

	/**
	 * Hide a card for this visitor and remember the choice.
	 */
	Feed.prototype.initDismiss = function () {
		var self = this;

		this.root.addEventListener( 'click', function ( event ) {
			var button = event.target.closest( '[data-ndf-dismiss]' );
			if ( button ) {
				event.preventDefault();
				self.dismiss( button.closest( '.ndf-card' ) );
				return;
			}

			if ( event.target.closest( '[data-ndf-restore]' ) ) {
				event.preventDefault();
				self.restoreAll();
			}
		} );

		// Re-apply previously dismissed articles.
		if ( this.dismissed.length ) {
			var hidden = new Set( this.dismissed.map( String ) );
			this.cards.forEach( function ( card ) {
				if ( hidden.has( card.getAttribute( 'data-ndf-id' ) ) ) {
					card.classList.add( 'is-dismissed' );
				}
			} );
		}

		this.updateRestoreButton();
	};

	/**
	 * Hide one card.
	 *
	 * @param {HTMLElement} card Card element.
	 */
	Feed.prototype.dismiss = function ( card ) {
		if ( ! card ) {
			return;
		}

		var id = card.getAttribute( 'data-ndf-id' );
		card.classList.add( 'is-dismissed' );

		if ( id && this.dismissed.indexOf( id ) === -1 ) {
			this.dismissed.push( id );
			writeList( STORAGE_KEYS.dismissed, this.dismissed );
		}

		this.updateRestoreButton();
		this.applyVisibility();
	};

	/**
	 * Bring every hidden article back.
	 */
	Feed.prototype.restoreAll = function () {
		this.cards.forEach( function ( card ) {
			card.classList.remove( 'is-dismissed' );
		} );

		this.dismissed = [];
		writeList( STORAGE_KEYS.dismissed, [] );

		this.updateRestoreButton();
		this.applyVisibility();
	};

	/**
	 * Show or hide the "show hidden" control based on how many are hidden.
	 */
	Feed.prototype.updateRestoreButton = function () {
		if ( ! this.restoreButton ) {
			return;
		}

		var hidden = this.cards.filter( function ( card ) {
			return card.classList.contains( 'is-dismissed' );
		} ).length;

		if ( this.restoreCount ) {
			this.restoreCount.textContent = String( hidden );
		}

		this.restoreButton.hidden = hidden === 0;
	};

	/**
	 * Wire up opt-in collapsing for very long descriptions.
	 *
	 * Only runs when the operator has set a threshold; the default is zero,
	 * which leaves every description fully expanded.
	 */
	Feed.prototype.initCollapse = function () {
		var self = this;

		// No early exit on a zero threshold: the uniform card height clips
		// without one, so a card can need collapsing purely because it
		// overflows. The per-card test below decides, and with nothing
		// clipped and no threshold set it simply finds no work.
		this.cards.forEach( function ( card ) {
			var content = card.querySelector( '.ndf-content' );
			var button = card.querySelector( '.ndf-expand' );

			if ( ! content || ! button ) {
				return;
			}

			var text = ( content.textContent || '' ).trim();

			// Measured overflow is the reliable signal: whether text fits
			// depends on the viewport, font size and zoom, so a character
			// count is only a guess. An explicit threshold still applies when
			// the operator has set one.
			var clipped = content.scrollHeight > content.clientHeight + 2;
			var overThreshold = self.collapseThreshold > 0 && text.length > self.collapseThreshold;

			if ( ! clipped && ! overThreshold ) {
				return;
			}

			var label = button.querySelector( '.ndf-expand-label' );

			content.classList.add( 'is-collapsed' );
			button.hidden = false;

			var setLabel = function () {
				var expanded = ! content.classList.contains( 'is-collapsed' );
				if ( label ) {
					label.textContent = expanded ? 'Show less' : 'Show more';
				}
				button.setAttribute( 'aria-expanded', expanded ? 'true' : 'false' );
			};

			setLabel();

			button.addEventListener( 'click', function () {
				content.classList.toggle( 'is-collapsed' );

				// The card is a fixed height, so releasing the clip on the
				// description is not enough on its own: without letting the
				// card grow, the expanded text would spill over its edges.
				card.classList.toggle( 'is-expanded', ! content.classList.contains( 'is-collapsed' ) );

				setLabel();
			} );
		} );
	};

	/**
	 * Apply the active search term to the visible cards.
	 */
	Feed.prototype.filter = function () {
		this.applyVisibility();
	};

	/**
	 * Recompute which cards are shown from the search term and dismissal state.
	 */
	Feed.prototype.applyVisibility = function () {
		var query = this.query;
		var matches = 0;

		this.cards.forEach( function ( card ) {
			if ( card.classList.contains( 'is-dismissed' ) ) {
				return;
			}

			var haystack = ( card.getAttribute( 'data-ndf-title' ) || '' ) + ' ' +
				( card.getAttribute( 'data-ndf-source' ) || '' ) + ' ' +
				( card.getAttribute( 'data-ndf-text' ) || '' );

			var visible = ! query || haystack.toLowerCase().indexOf( query ) !== -1;

			card.classList.toggle( 'is-hidden-by-search', ! visible );

			if ( visible ) {
				matches++;
			}
		} );

		this.announce( matches, this.cards.length );
	};

	/**
	 * Update the live region so screen readers hear the result count.
	 *
	 * @param {number} matches Articles currently shown.
	 * @param {number} total   Articles on this page.
	 */
	Feed.prototype.announce = function ( matches, total ) {
		if ( ! this.statusText ) {
			return;
		}

		if ( ! this.query ) {
			this.statusText.textContent = '';
			return;
		}

		this.statusText.textContent = matches === 1
			? '1 article matches'
			: matches + ' of ' + total + ' articles match';
	};

	/**
	 * Rewrite server rendered timestamps relative to now.
	 */
	Feed.prototype.refreshTimestamps = function () {
		var stamps = this.root.querySelectorAll( 'time.ndf-time[datetime]' );

		Array.prototype.forEach.call( stamps, function ( node ) {
			var when = new Date( node.getAttribute( 'datetime' ) );

			if ( ! isNaN( when.getTime() ) ) {
				node.textContent = relativeTime( when );
			}
		} );
	};

	/**
	 * Delay repeated calls.
	 *
	 * @param {Function} fn Function to call.
	 * @param {number}   ms Delay in milliseconds.
	 * @return {Function} Debounced wrapper.
	 */
	function debounce( fn, ms ) {
		var timer = null;

		return function () {
			var args = arguments;
			var self = this;

			window.clearTimeout( timer );
			timer = window.setTimeout( function () {
				fn.apply( self, args );
			}, ms );
		};
	}

	/**
	 * Hide cards that the active search filtered out.
	 */
	document.addEventListener( 'DOMContentLoaded', function () {
		var roots = document.querySelectorAll( '.ndf' );

		Array.prototype.forEach.call( roots, function ( root ) {
			if ( ! root.getAttribute( 'data-ndf-instance' ) ) {
				return;
			}
			new Feed( root );
		} );
	} );
}() );
