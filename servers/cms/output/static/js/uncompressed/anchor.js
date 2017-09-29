/*!
* AnchorJS - v0.1.0 - 2014-08-17
* https://github.com/bryanbraun/anchorjs
* Copyright (c) 2014 Bryan Braun; Licensed MIT
*/
function addAnchors(selector) {

	var ltIE9 = true;

	if (document.addEventListener){
		ltIE9 = false;
	}
	

	if (!ltIE9) {
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
				var pageUrl = "";
				if (window.location.hash !== "" && window.location.hash.indexOf(".html") > -1) {
					pageUrl = window.location.hash.split(".html");
					pageUrl = pageUrl[0];
					pageUrl += ".html";
					pageUrl = pageUrl.replace("#", "");
				}
				var anchor = '<a class="anchor-link" href="' + pageUrl + '?id=' + elementID + '#' + elementID + '" title="Direktlänk till rubrik"><span class="icon-link"></span></a>';
				element.html(element.html() + anchor);
			}
		});
	}

}
