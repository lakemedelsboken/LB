var contentController = require("../../controllers/contentcontroller");
var cheerio = require("cheerio");
var fs = require("fs");
var path = require("path");

var Component = {

	getScripts: function() {
		return "";
	},
	getStyles: function() {
		return "";
	},
	getOutput: function(data, draftOrPublished) {

		if (draftOrPublished !== "published") {
			draftOrPublished = "draft";
		}

		var outContent = [];
		
		//Build content from each content type in the component
		for (var i = 0; i < data.content.length; i++) {
			var item = data.content[i];

			var contentViews = contentController.getContentTypes()[item.type];
			if (contentViews !== undefined) {
				outContent.push(contentViews.getOutput(item, draftOrPublished));
			} else {
				console.log("No views exist for content type: " + item.type);
			}
		}
		
		outContent = outContent.join("\n");
		
		var $ = cheerio.load(outContent);
		
		//Find first ul
		var firstUl = $("ul").first();
		
		firstUl.attr("id", "sideBar");
		firstUl.attr("role", "navigation");
		
		//Load outline
		var outline = fs.readFileSync(path.join(__dirname, "outline.html"), "utf8");
		
		//Inject content
		outline = outline.replace("{content}", $.html());
		
		return outline;
		
	}
};

module.exports = Component;