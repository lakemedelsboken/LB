var cheerio = require("cheerio");
var url = require("url");

module.exports = injector = {
	process: function(html, id) {

		var $ = cheerio.load(html);
		id = id.replace(".json", ".html");
		
		//Find links that point to the current page
		$("a[href]").each(function() {

			var currentHref = $(this).attr("href");
			
			if (currentHref.indexOf("{pre}") === 0) {

				currentHref = currentHref.replace("{pre}", "");

				var actualLinkedHref = url.resolve(id, currentHref);

				var parsedUrl = url.parse(actualLinkedHref);

				console.log("Comparing: " + id + " to " + parsedUrl.pathname);

				//Points to this page
				if (parsedUrl.pathname === id) {
					//Only keep the hash
					
					var hash = "#";
					
					if (actualLinkedHref.indexOf("#") > -1) {
						hash = parsedUrl.hash;
					}
					
					$(this).attr("href", hash);
					
				}

			}
			
		});
		

		return $.html();
	}
};
