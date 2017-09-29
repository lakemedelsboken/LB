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
		
		//Remove summary from output
		$(".summary").remove();

		//Inject date
		var createdDate = data.created;
		var firstH1 = $("h1").first();
		
		if (firstH1.length === 1) {
			firstH1.after($('<span class="date">' + createdDate + '</span>'))
		}

		return $.html();

	}
};

module.exports = Hooks;