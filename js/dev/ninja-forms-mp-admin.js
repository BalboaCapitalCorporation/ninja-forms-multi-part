// Setup our page data models to track which pages exist and what fields are on them.
// Model to hold our page settings.
var nfPage = Backbone.Model.extend( {
	duplicate: function() {
		var form_id = ninja_forms_settings.form_id;
		nfFields.updateData();
		var field_data = JSON.stringify( nfFields.toJSON() );

		// Show our MP spinner
		jQuery( '.mp-spinner' ).show();

		jQuery.post( ajaxurl, { form_id: form_id, field_ids: this.get( 'fields' ), field_data: field_data, action: 'nf_mp_copy_page', nf_ajax_nonce:ninja_forms_settings.nf_ajax_nonce }, function(response){
			// Hide our MP spinner
			jQuery( '.mp-spinner' ).hide();
					
			// Update our page and field data models
			// Update our page data model.
			nfPages.add( { num: response.new_part.num, divider_id: response.new_part.id, page_title: response.new_part.page_title, fields: response.new_part.fields } );
			// Increase our page count.
			nfPages.count++;
			// Add our new fields to the fields data model.
			_.each( response.new_part.fields, function( field_id ) {
				// Add our field to our backbone data model.
				nfFields.add( { id: field_id, metabox_state: 0 } );
			} );

			nfPages.updateView( response.new_nav, response.new_slide, nfPages.count );

		} );
	},
	remove: function() {
		var answer = confirm( nf_mp.remove_page_text );

    	if( answer ) {
			var form_id = ninja_forms_settings.form_id;
	    	var current_page = this.get( 'num' );
	    	var page_count = nfPages.count;

	    	if(page_count > 1){
	    		jQuery("#ninja_forms_field_list_" + current_page).find("._page_divider-li").removeClass("not-sortable");
	    	}

	    	var fields = this.get( 'fields' );

	    	if( fields.length > 0 ){
	    		// Show our MP spinner
	    		jQuery( '.mp-spinner' ).show();

				if ( current_page > 1 ) {
		    		move_to_page = current_page - 1;
		    	}else{
		    		move_to_page = 1;
		    	}

		    	var that = this;

				jQuery.post( ajaxurl, { form_id: form_id, fields: fields, move_to_page: move_to_page, action: 'nf_mp_delete_page', nf_ajax_nonce:ninja_forms_settings.nf_ajax_nonce }, function(response){
					// Hide our MP spinner
					jQuery( '.mp-spinner' ).hide();

					if( page_count == 2 ){
						nf_mp_change_page( 1 );
						jQuery( '._page_divider-li' ).remove();
						jQuery( '#ninja_forms_mp_pagination' ).fadeOut();
						jQuery( '#nf_mp_enable' ).fadeIn();
					}else{
						// Remove our current page from the nfPages collection
				    	nfPages.remove( that );

				    	// Recalculate our part numbers
				    	var x = 1;
				    	_.each( nfPages.models, function( part ) {
				    		part.set( 'num', x );
				    		x++;
				    	} );

				    	nfPages.updateView( response.new_nav, response.new_slide, move_to_page );

					}

					nfPages.count--;
			    } );
			}
		}
	}
} );
// Collection to hold our fields.
var nfPages = Backbone.Collection.extend({
	model: nfPage,
	enable: function() {
		// Hide our "enable multi-part" button.
		jQuery( '#nf_mp_enable' ).fadeOut();
		// Get our current form ID.
		var form_id = ninja_forms_settings.form_id;

		// Post to our PHP handler.
		jQuery.post( ajaxurl, { form_id: form_id, action: 'nf_mp_enable', nf_ajax_nonce:ninja_forms_settings.nf_ajax_nonce }, function( response ) {

			// Add our newly created page dividers to the field list.
			_.each( response.new_parts, function( part ) {
				// Add our newly created pages to our part model.
				nfPages.add( { num: part.num, divider_id: part.id, page_title: '', fields: part.fields } );				
				// Add our field to our backbone data model.
				nfFields.add( { id: part.id, metabox_state: 0 } );
			} );

			// Set our page count to 2.
			nfPages.count = 2;

			nfPages.updateView( response.new_nav, response.new_slide, 1 );

		} );
	},
	addNew: function() {
		// Show our spinner
		jQuery( '.mp-spinner' ).show();
		var form_id = ninja_forms_settings.form_id;
		var that = this;
		
		// Send a post request with our form id to create a new part.
		jQuery.post( ajaxurl, { form_id: form_id, action: 'nf_mp_new_page', nf_ajax_nonce: ninja_forms_settings.nf_ajax_nonce }, function( response ) {
			// Increase our part count
			that.count++;

			// Add a new part to our collection.
			that.add( [ { 
				num: that.count,
				fields: response.new_part.fields,
				divider_id: response.new_part.id
			} ] );
			
			// Add our new part to the field model
			nfFields.add( { id: response.new_part.id, metabox_state: 0 } );

			// Update our view
			that.updateView( response.new_nav, response.new_slide, nfPages.count );

			// Fire our added event.
			jQuery( document ).triggerHandler( 'nfMpAddPart', [ response ] );

			// Hide our spinner
			jQuery( '.mp-spinner' ).hide();
		} );

	},
	updateView: function( new_nav, new_slide, move_to_page ) {
		// Update our page navigation.
		jQuery( '#ninja_forms_mp_pagination' ).html( new_nav );
		// Update our field list HTML.
		jQuery( '#ninja_forms_slide' ).html( new_slide );
		// Update our sortables
		this.updateSortables();
		// Show our newly added multi-part pagination.
		jQuery( '#ninja_forms_mp_pagination' ).fadeIn();
		// Move to our previous/next page.
    	nf_mp_change_page( move_to_page );
	},
	updateSortables: function() {
		// Make our newly added field lists sortable.
		jQuery( '.ninja-forms-field-list' ).sortable({
			handle: '.menu-item-handle',
			items: "li:not(.not-sortable)",
			connectWith: '.ninja-forms-field-list',
			//cursorAt: {left: -10, top: -1},
			start: function(e, ui){
				var wp_editor_count = jQuery(ui.item).find('.wp-editor-wrap').length;
				if(wp_editor_count > 0){
					jQuery(ui.item).find('.wp-editor-wrap').each(function(){
						var ed_id = this.id.replace('wp-', '');
						ed_id = ed_id.replace('-wrap', '');
						tinyMCE.execCommand( 'mceRemoveControl', false, ed_id );
					});
				}
			},
			stop: function(e,ui) {
				var wp_editor_count = jQuery(ui.item).find('.wp-editor-wrap').length;
				if( wp_editor_count > 0 ){
					jQuery( ui.item ).find( '.wp-editor-wrap' ).each( function() {
						var ed_id = this.id.replace( 'wp-', '' );
						ed_id = ed_id.replace( '-wrap', '' );
						tinyMCE.execCommand( 'mceAddControl', true, ed_id );
					});
				}
				jQuery( this ).sortable( 'refresh' );
			}
		} );

		jQuery( '.mp-add-page' ).droppable({
	        accept: '.ninja-forms-field-list li',
	        hoverClass: 'drop-hover',
	        tolerance: 'pointer',
			drop: function( event, ui ) {
				var item = ui.draggable;
				jQuery( document ).on( 'nfMpAddPart.drop', function( response ) {
					item.hide( 'slow', function() {
		                jQuery( this ).appendTo( '#ninja_forms_field_list_' + nfPages.count ).show( 'slow' );
		            });
				} );

				nfPages.addNew();			
			}
    	} );

    	jQuery( '#mp-page-list' ).sortable({
			helper: 'clone',
			tolerance: 'pointer',
			update: function( event, ui ) {
				var found = false;
				jQuery( '#mp-page-list li' ).each( function( index ) {
					var new_part = index + 1;
					var current_part = jQuery( this ).data( 'page' );
				// Set our data attribute for this li
				jQuery( this ).data( 'page', new_part );
				// Change our page # html
				jQuery( this ).html( new_part );
				// Change our page id
				jQuery( this ).prop( 'id', 'ninja_forms_mp_page_' + new_part );
				
					// Store the new page temporarily in our data model.
					nfPages.findWhere( { num: current_part } ).set( 'new_num', new_part );
					jQuery( '#ninja_forms_field_list_' + current_part ).data( 'page', new_part );

					if ( nfPages.current_page == current_part && ! found ) {
						nfPages.current_page = new_part;
						found = true;
					}
				} );

				// Update our data model.
				nfPages.each( function ( part ) {
					var num = part.get( 'num' );
					var new_num = part.get( 'new_num' );
					part.set( 'num', new_num );
					part.unset( 'new_num' );
				} );

				var div = jQuery( '#ninja_forms_slide' );
				
				uls = div.children( 'ul' );

				uls.each( function( index ) {
					var page = jQuery( this ).data( 'page' );
					jQuery( this ).prop( 'id', 'ninja_forms_field_list_' + page );
				});

				uls.detach().sort(function(a,b) {
				    return jQuery(a).data( 'page' ) - jQuery(b).data( 'page' );  
				});

				div.append( uls );

				nf_mp_change_page( nfPages.current_page );
			}
		} );

		jQuery( '#mp-page-list' ).disableSelection();

		jQuery( '.mp-page-nav' ).droppable({
	        accept: '.ninja-forms-field-list li',
	        hoverClass: 'drop-hover',
	        tolerance: 'pointer',
			drop: function( event, ui ) {
				jQuery( '.mp-spinner' ).show();
				var page_number = jQuery( this ).data( 'page' );
	       
				ui.draggable.hide( 'slow', function() {
	                jQuery( this ).appendTo( '#ninja_forms_field_list_' + page_number ).show( 'slow' );
	                jQuery('.spinner').hide(); 
	            });
			}
	    });
	}
});

// Instantiate our fields collection.
var nfPages = new nfPages();

jQuery(document).ready(function($) {

	nfPages.current_page = 1;
	nfPages.count = 1;
	// Loop through our MP pages JSON that is already on the page and populate our collection with it.
	if( 'undefined' !== typeof nf_mp.pages ) {
		var x = 1;
		_.each( nf_mp.pages, function( page ) {
			nfPages.add( { num: x, divider_id: page.id, page_title: page.page_title, fields: page.fields } );
			x++;
		} );
		nfPages.count = x - 1;
	}

	$( document ).on( 'click', '.mp-add-page', function( e ) {
		e.preventDefault();
		nfPages.addNew();
	} );

	$( document ).on( 'click', '#nf_mp_enable', function( e ) {
		e.preventDefault();
		nfPages.enable();
	} );

	$(document).on( 'click', '.mp-page-nav', function(e){
		var page_number = $( this ).data( 'page' );
		var current_page = nfPages.current_page;
		if( page_number != current_page ) {
			nf_mp_change_page( page_number );
		}
	});

	$( document ).on( 'click', '.mp-remove-page', function( e ) {
		var current_page = nfPages.current_page;
		console.log( nfPages.findWhere( { num: current_page } ) );
		var part = nfPages.findWhere( { num: current_page } );
		part.remove();
    });


	// Filter our order variable before we save fields.
	$( document ).on( 'nfAdminSaveFields.mpFilter', function( e ) {
		//event.preventDefault();
		$( '._page_divider-li' ).removeClass( 'not-sortable' );
		$( '.ninja-forms-field-list' ).sortable( 'refresh' );
		var current_order = '';
		$( '.ninja-forms-field-list' ).each(function(){
			if(current_order != ''){
				current_order = current_order + ',';
			}
			current_order = current_order + $( this ).sortable( 'toArray' );
		});
		current_order = current_order.split( ',' );
		var order = {};
		for ( var i = 0; i < current_order.length; i++ ) {
			order[i] = current_order[i];
		};
		order = JSON.stringify( order );

		$( document ).data( 'field_order', order );

	} );

	// Remove our default addField behaviour
	$( document ).off( 'addField.default' );

	// Add our custom addField behaviour
	$( document ).on( 'addField.mpAdd', function( e, response ) {
		var current_page = nfPages.current_page;

		jQuery("#ninja_forms_field_list_" + current_page).append(response.new_html);
		if ( response.new_type == 'List' ) {
			//Make List Options sortable
			jQuery(".ninja-forms-field-list-options").sortable({
				helper: 'clone',
				handle: '.ninja-forms-drag',
				items: 'div',
				placeholder: "ui-state-highlight",
			});
		}
		if ( typeof nf_ajax_rte_editors !== 'undefined' ) {
			for (var x = nf_ajax_rte_editors.length - 1; x >= 0; x--) {
				var editor_id = nf_ajax_rte_editors[x];
				tinyMCE.init( tinyMCEPreInit.mceInit[ editor_id ] );
				try { quicktags( tinyMCEPreInit.qtInit[ editor_id ] ); } catch(e){}
			};
		}

		// Add our field to our backbone data model.
		nfFields.add( { id: response.new_id, metabox_state: 1 } );

		// Add our field to this page.
		var page = nfPages.findWhere( { num: current_page } );
		var page_fields = page.get( 'fields' );
		page_fields.push( response.new_id.toString() );
		page.set( 'fields', page_fields );
	} );

	// Add our custom removeField behaviour
	// This function removes the field id from its page model when the field is removed.
	$( document ).on( 'removeField', function( e, field_id ) {
		var page = nfPages.findWhere( { num: nfPages.current_page } );
		var page_fields = page.get( 'fields' );
		page_fields = nf_mp_remove_array_value( page_fields, field_id );
		page.set( 'fields', page_fields );
	} );

	// When a user clicks the "copy mp page" link, copy the page and add it to the editor.
	$( document ).on( 'click', '.mp-copy-page', function( e ) {
		e.preventDefault();
		var current_page = nfPages.current_page;
		var part = nfPages.findWhere( { num: current_page } );
		part.duplicate();
	} );

	$( '#mp-page-list' ).disableSelection();

	nfPages.updateSortables();

} ); // Main document.ready

function nf_mp_change_page( page_number, callback ){
	if ( !callback ) {
		var callback = '';
	}
	nfPages.current_page = page_number;
	jQuery( '.mp-page-nav' ).removeClass( 'active' );
	jQuery( '#ninja_forms_mp_page_' + page_number ).addClass( 'active' );
	var new_page = jQuery( '#ninja_forms_field_list_' + page_number ).position().left;
	jQuery( '#ninja_forms_slide').animate({left: -new_page},'300', callback );
}

function nf_mp_remove_array_value( arr ) {
    var what, a = arguments, L = a.length, ax;
    while (L > 1 && arr.length) {
        what = a[--L];
        while ((ax= arr.indexOf(what)) !== -1) {
            arr.splice(ax, 1);
        }
    }
    return arr;
}