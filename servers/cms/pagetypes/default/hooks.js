var cheerio = require("cheerio");

var Hooks = {
	
	preRender: function(html, data) {
		return html;
	},
	postRender: function(html, data) {

		var $ = cheerio.load(html);
		var firstRow = $(".row").first();
		
		var firstChild = firstRow.children().first();
		
		//See if first child of the first row is #mainContainer
		if ($(firstChild).attr("id") !== "mainContainer") {
			var mainContainer = $("#mainContainer");

			//Make room for a side container on the left side
			mainContainer.attr("class", "span8 offset4");
		}
		

		return $.html();
	}
};

module.exports = Hooks;