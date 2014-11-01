/*!
* AnchorJS - v0.1.0 - 2014-08-17
* https://github.com/bryanbraun/anchorjs
* Copyright (c) 2014 Bryan Braun; Licensed MIT
*/
function addAnchors(selector) {
	// Sensible default selector, if none is provided.
	selector = selector || '.chapterContent h1, .chapterContent h2, .chapterContent h3, .chapterContent h4, .chapterContent h5, .chapterContent h6';
  
	// Select any elements that match the provided selector.
	var elements = $(selector);

	// Loop through the selected elements.
  	elements.each(function() {
		
		var element = $(this);
		var elementID = undefined;

		if (!!element.attr('id') && element.attr('id') !== "") {
			elementID = element.attr('id');
		}
		
		if (elementID !== undefined) {
			var anchor = '<a class="anchor-link" href="?id=' + elementID + '#' + elementID + '" title="Direktlänk till rubrik"><span class="icon-link"></span></a>';
			element.html(element.html() + anchor);
		}
	});
}