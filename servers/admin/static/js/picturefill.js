/*! Picturefill - Responsive Images that work today. (and mimic the proposed Picture element with divs). Author: Scott Jehl, Filament Group, 2012 | License: MIT/GPLv2 */

(function( w ){
	
	// Enable strict mode
	"use strict";

	w.picturefill = function(event, callback) {

		//console.log("running");
		var zoom = 1;
		if (event && event.zoom) {
			zoom = event.zoom;
		}

		//TODO: set a base class
		var ps = $("div.figureImage, div.fassImage, div.narcImage, div.staticImage");
		
		// Loop the pictures
		var loadCounter = 0;
		var invokedCallback = false;
		
		ps.each(function(index, element) {
			
				var $element = $(element);
				var sources = $element.find("div"),
					matches = [];
			
				// See if which sources match
				sources.each(function(i, e) {
					var $e = $(e);
					var media = $e.attr("data-media");

					if (zoom !== 1 && media && media.indexOf("min-width:") > -1 ) {
						var minWidth = media.substr(media.indexOf("min-width:"));
						minWidth = minWidth.substr(0, minWidth.indexOf(")"));
						var width = parseInt(minWidth.replace("min-width: ", ""));
						width = parseInt(width / zoom);
						media = media.replace(minWidth, "min-width: " + width + "px");
					}

					if( media && media.indexOf("min-device-pixel-ratio") > -1 ) {
						var webkitmedia = media.replace("min-device-pixel-ratio", "-webkit-min-device-pixel-ratio");
						media = media +","+webkitmedia;
						var mozmedia = media.replace("min-device-pixel-ratio", "min--moz-device-pixel-ratio");
						var omedia = media.replace("min-device-pixel-ratio", "-o-min-device-pixel-ratio");
						media = webkitmedia +","+ mozmedia +","+ omedia +","+ media;
					}

					// if there's no media specified, OR w.matchMedia is supported 
					if( !media || ( w.matchMedia && w.matchMedia(media).matches ) ){
						matches.push($e);
					}
				//}
				});

				// Find any existing img element in the picture element
				var picImg = $element.find("img").first();

				if( matches.length ){
					if(picImg.length === 0){
						picImg = $("<img src=\"\" />");
						picImg.attr("alt", $element.attr("data-alt"));
						$element.append(picImg);
					}
				
					//var source = matches.pop().getAttribute( "data-src" );
					var source = matches.pop().attr("data-src");
					if (picImg.attr("src").indexOf(source) === -1) {
						++loadCounter;
						picImg.attr("src", source);
						//console.log("setting src to " + source);
						
						picImg.on("load", function() {
							--loadCounter;
							//console.log("finished loading " + $(this).attr("src"));
							if (loadCounter === 0 && callback !== undefined) {
								invokedCallback = true;
								//console.log("sending callback 1");
								callback();
							}
						});
					}
				}
				else if(picImg ){
					picImg.remove();
				}

			//}
		//}
		});
		
		if (loadCounter === 0 && !invokedCallback && callback !== undefined) {
			//console.log("sending callback 2");
			callback();
		}
		
	};
	
	// Run on resize and domready (w.load as a fallback)
//	if( w.addEventListener ){
//		if (lb && !lb.isMobile.any()) {
//			w.addEventListener( "resize", w.picturefill, false );
//		}
		/*
		w.addEventListener( "DOMContentLoaded", function(){
			w.picturefill();
			// Run once only
			w.removeEventListener( "load", w.picturefill, false );
		}, false );
		w.addEventListener( "load", w.picturefill, false );
		*/
//	}
//	else if( w.attachEvent ){
		//w.attachEvent( "onload", w.picturefill );
//	}
	
}( this ));