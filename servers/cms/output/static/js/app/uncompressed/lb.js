var lb = {
	init: function() {

		var self = this;

		$("body").on("click", "a.inlineGenerica", self.handleGenericas);
		$("body").on("click", "img.figureImage", self.handleFigures);

		$("body").on("click", "a.inlineReference", self.handleReferences);
		$("body").on("click", ".factsLink", self.handleBoxLinks);
		$("body").on("click", ".figureLink", self.handleBoxLinks);
		$("body").on("click", ".tableLink", self.handleBoxLinks);
		$("body").on("click", ".therapyLink", self.handleBoxLinks);
		$("body").on("click", "a.pageLink", self.handlePageLinks);
		$("body").on("click", "a.linkOut", self.handleLinkOut);
		$("body").on("click", "a.pageFootnoteItem", self.handlePageFootnoteItems);
		$("body").on("click", "div.wide", self.handleBigTables);
		$("body").on("click", "div.narrow", self.handleBigTables);
		$("body").on("click", "div.facts", self.handleBigTables);
		$("body").on("click", "div.therapy-recommendations", self.handleBigTables);

	},
	handleLinkOut: function(event) {

		event.preventDefault();
		event.stopPropagation();

		var href = $(this).attr("href");
		
		Ti.App.fireEvent("openLink", {href: href});

	},
	handlePageFootnoteItems: function(event) {

		event.preventDefault();
		//event.stopPropagation();

		var pageFootnoteList = $($(this).attr("href"));
		var title = $.trim(pageFootnoteList.find("legend").first().text());
		pageFootnoteList.find("legend").remove();
		
		var content = "";

		if (pageFootnoteList.length > 0) {
			content = "<div class=\"pageFootnoteDisplay\">" +  pageFootnoteList.html() + "</div>";
		}

		Ti.App.fireEvent("referenceSelected", {html: content, title: title});

	},
	handlePageLinks: function(event) {


		var href = $(this).attr("href");
		if (href.length > 0 && href.substr(0, 1) === "#") {
			//Same chapter
			
		} else if (href.indexOf("#") > 1) {
			//Other chapter
			event.preventDefault();
			event.stopPropagation();
			
			var chapterId = href.split("_")[0];
			var id = href.split("#");
			id = id[id.length - 1];

			var url = href.split("#")[0];
			url = url.split("?")[0];
						
			Ti.App.fireEvent("pageLinkSelected", {chapterId: chapterId, id: id, url: url});

		} else {

			event.preventDefault();
			event.stopPropagation();

			var url = href;
			url = url.split("?")[0];

			Ti.App.fireEvent("pageLinkSelected", {chapterId: null, id: null, url: url});
			
		}

	},
	handleBoxLinks: function(event) {

		event.stopPropagation();
		event.preventDefault();

		var title = "Länkar";
		var type = "";
		var typeName = "";
	
		if ($(this).hasClass("factsLink")) {
			title = "Faktaruta";
			type = "facts";
			typeName = "Faktaruta";
		} else if ($(this).hasClass("figureLink")) {
			title = "Figur";
			type = "figure";
			typeName = "Figur";
		} else if ($(this).hasClass("tableLink")) {
			title = "Tabell";
			type = "table";
			typeName = "Tabell";
		} else if ($(this).hasClass("therapyLink")) {
			title = "Terapirekommendation";
			type = "therapy";
			typeName = "Terapirekommendation";
		}

		var references = [];

		if ($(this).attr("data-numbers").indexOf(",") > -1) {
			references = $(this).attr("data-numbers").split(",");
		} else {
			references.push($(this).attr("data-numbers"));
		}

		var content = "";

		if (type === "figure") {
			//Find image and fire event
			var reference = $("#" + type + "_" + references[0]);
			var image = reference.find("img.figureImage").first();
			
			if (image.length === 1) {
				$(image).trigger("click");
			}
		} else {
			for (var i=0; i < references.length; i++) {
				var referenceNumber = references[i];
				var reference = $("#" + type + "_" + referenceNumber);
		
				if (reference.length === 1) {
					var referenceContent = reference.html();
					//content += "<h6><a class=\"btn btn-small btn-primary gotoBoxLink\" href=\"#" + type + "_" + referenceNumber + "\"> Gå till " + typeName + " " + referenceNumber + " <i class=\"icon icon-white icon-arrow-right\"></i></a></h6>" + ((type === "facts" || type === "table" || type === "therapy") ? "<table class=\"table table-bordered" + (type === "facts" ? " facts" : "") + "\">" : "<div class=\"well figure\">") + referenceContent + ((type === "facts" || type === "table" || type === "therapy") ? "</table>" : "</div>");
					content += ((type === "facts" || type === "table" || type === "therapy") ? "<div style='border-top: solid 1px #ddd; border-right: solid 1px #ddd; border-bottom: solid 1px #ddd; display: inline-block; padding: 0; border: 0;'><table class=\"table table-bordered" + (type === "facts" ? " facts" : "") + "\" style=\"max-width: none;\">" : "<div class=\"well figure\">") + referenceContent + ((type === "facts" || type === "table" || type === "therapy") ? "</table></div>" : "</div>");
				}
			}
	
			Ti.App.fireEvent("referenceSelected", {html: content, title: typeName + " " + referenceNumber});
		}

	},
	handleReferences: function(event) {

		var title = ($(this).attr("data-referencenumber").indexOf(",") > -1) ? "Referenser" : "Referens";

		var references = [];

		if ($(this).attr("data-referencenumber").indexOf(",") > -1) {
			references = $(this).attr("data-referencenumber").split(",");
		} else {
			references.push($(this).attr("data-referencenumber"));
		}

		var content = "";
	
		for (var i=0; i < references.length; i++) {
			var referenceNumber = references[i];
			var reference = $("#reference_" + referenceNumber);
		
			if (reference.length === 1) {
				content += "<p class=\"popoverReference\"><strong>" + referenceNumber + ".</strong> " + reference.html() + "</p>";
			}
		}

		Ti.App.fireEvent("referenceSelected", {html: content, title: title});

		event.preventDefault();
		event.stopPropagation();
	},
	handleGenericas: function(event) {

		var id = $(this).attr("data-atcid");
		var titles = $(this).attr("data-atctitles");
		var title = $(this).text();
		
		
		var formattedTitle = "";
		
		if (title && title.length > 1) {
			formattedTitle = title.substr(0, 1).toUpperCase();
			formattedTitle += title.substr(1);
		} 

		//Decode html entities		
		titles = $("<div/>").html(titles).text();
		
		Ti.App.fireEvent("atcSelected", {id: id, titles: titles, title: formattedTitle});

		event.preventDefault();
		event.stopPropagation();

	},
	handleFigures: function(event) {

		var src = $(this).attr("src");
		var name = $(this).attr("alt");
		var text = $(this).parent().find("p.figureText").text();
		var html = $(this).parent().html();
		
		Ti.App.fireEvent("figureSelected", {url: src, name: name, text: text, html: html});

		event.preventDefault();
		event.stopPropagation();
		
	},
	handleBigTables: function(event) {
		var content = $(this).html();
		Ti.App.fireEvent("referenceSelected", {html: content, title: "Tabell"});
		event.preventDefault();
		event.stopPropagation();

	}
	
};

(function() {
	$(document).ready(function() {

		lb.init();

	});
})();

