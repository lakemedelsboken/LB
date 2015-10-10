var cheerio = require("cheerio");
var fs = require("fs");
var contentModel = require("../../models/contentmodel");
var path = require("path");

var Hooks = {
	settings: {
		menuRoot: ""
	},
	preRender: function(html, data) {
		return html;
	},
	postRender: function(html, data) {

		var $ = cheerio.load(html);

		var searchIndexPath = path.join(contentModel.baseDir, data.path.replace(".json", ".index"));

		//Read search index for this page
		var searchIndex = JSON.parse(fs.readFileSync(searchIndexPath, "utf8"));
		
		//Build table of contents for side bar
		var toc = buildSideBarToc(searchIndex);

		//Add toc to page
		$("#sideBar").empty().append(toc);
		
		//Parse authors
		var authors = [];
		
		for (var i = 0; i < data.content.length; i++) {
			if (data.content[i].type === "author") {
				authors.push(data.content[i]);
			}
		}

		var authorsDisclosureListItemsHtml = "";
		var authorsList = [];

		for (var i = 0; i < authors.length; i++) {
			var authorInfo = authors[i].content;

			var authorName = "";

			if (authorInfo.firstname.length > 0) {
				authorName = authorInfo.firstname;
			}

			if (authorInfo.surname.length > 0) {
				if (authorName.length > 0) {
					authorName += " " + authorInfo.surname;
				} else {
					authorName = authorInfo.surname;
				}
			}

			if (authorInfo.description.length > 0) {
				if (authorName.length > 0) {
					authorName += ", " + authorInfo.description;
				} else {
					authorName = authorInfo.description;
				}
			}
		
			var chapterName = $("h1").first().text();
			authorsDisclosureListItemsHtml += "<li>" + authorName  + " <a href=\"mailto:registrator@mpa.se?subject=" + encodeURIComponent('Förfrågan om jävsdeklaration') + "&body=" + encodeURIComponent('Jag önskar jävsdeklaration för') + "%0D%0A" + encodeURIComponent(authorName) + "%0D%0A" + encodeURIComponent('författare till kapitlet ' + chapterName) + encodeURIComponent(', Läkemedelsboken 2014.') + "%0D%0A%0D%0A" + encodeURIComponent('Vänliga hälsningar') + "%0D%0A\" class=\"btn btn-mini\"><i class=\"fa fa-envelope-o\"></i> Fråga efter jävsdeklaration via mejl</a></li>";

			authorName = require("../../postprocessors/references.js").process(authorName);
			authorName = require("../../postprocessors/pagefootnotes.js").process(authorName);

			authorsList.push(authorName);
		}
		
		//Add authors disclosure
		if (authorsDisclosureListItemsHtml.length > 0) {
			$("#main").append($("<div class=\"authorsDisclosure\"><p>Jävsdeklarationer för kapitlets författare kan erhållas via <a href=\"mailto:registrator@mpa.se\">registrator@mpa.se</a>. Enklast sker detta genom de förberedda mejlen nedan.</p><ul class=\"authors\">" + authorsDisclosureListItemsHtml + "</ul></div>"))
		}

		//Add authors to beginning of document
		if (authorsList.length > 0) {
			var firstHeader = $("#main").find("h1,h2,h3,h4").first();
			
			if (firstHeader.length === 1) {
				firstHeader.after($("<p class=\"authors\">" + authorsList.join("<br>") + "</p>"));
			} else {
				$("#main").prepend($("<p class=\"authors\">" + authorsList.join("<br>") + "</p>"));
			}
		}

		//Add overview of boxes in this chapter
		var facts = [];
		var therapies = [];
		var tables = [];
		var figures = [];
		
		for (var i = 0; i < data.content.length; i++) {
			if (data.content[i].type === "tablewide" || data.content[i].type === "tablenarrow") {
				tables.push(data.content[i]);
			}

			if (data.content[i].type === "therapy") {
				therapies.push(data.content[i]);
			}

			if (data.content[i].type === "facts") {
				facts.push(data.content[i]);
			}

			if (data.content[i].type === "figure") {
				figures.push(data.content[i]);
			}

		}

		//Sort each by number
		therapies.sort(function(a, b){
			return a.content.number - b.content.number;
		});
		figures.sort(function(a, b){
			return a.content.number - b.content.number;
		});
		facts.sort(function(a, b){
			return a.content.number - b.content.number;
		});
		tables.sort(function(a, b){
			return a.content.number - b.content.number;
		});
		

		/*
		Order:
			Therapy
			Facts
			Tables
			Figures
		*/

		var therapiesOverview = $("<ul class=\"thumbnails clearfix overview therapiesOverview\"></ul>");
		var tablesOverview = $("<ul class=\"thumbnails clearfix overview tablesOverview\"></ul>");
		var factsOverview = $("<ul class=\"thumbnails clearfix overview factsOverview\"></ul>");
		var figuresOverview = $("<ul class=\"thumbnails clearfix overview figuresOverview\"></ul>");

		for (var i = 0; i < therapies.length; i++) {
			therapiesOverview.append($("<li class=\"span4\"><div class=\"thumbnail therapyLink\" data-numbers=\"" + therapies[i].content.number + "\"><div class=\"caption\"><i class=\"fa fa-info-circle\"></i><h5 class=\"overview\"><a href=\"#therapy_" + therapies[i].content.number + "\" class=\"therapyLink\" data-numbers=\"" + therapies[i].content.number + "\">Terapirekommendationer</a></h5><p><a href=\"#therapy_" + therapies[i].content.number + "\" class=\"therapyLink\" data-numbers=\"" + therapies[i].content.number + "\">" + $("<div>" + therapies[i].content.title + "</div>").text() + "</a></p></div></div></li>"));
		}

		for (var i = 0; i < facts.length; i++) {
			factsOverview.append($("<li class=\"span2\"><div class=\"thumbnail factsLink\" data-numbers=\"" + facts[i].content.number + "\"><div class=\"caption\"><i class=\"fa fa-th-list\"></i><h5 class=\"overview\"><a href=\"#facts_" + facts[i].content.number + "\" class=\"factsLink\" data-numbers=\"" + facts[i].content.number + "\">Faktaruta " + facts[i].content.number + "</a></h5><p><a href=\"#facts_" + facts[i].content.number + "\" class=\"factsLink\" data-numbers=\"" + facts[i].content.number + "\">" + $("<div>" + facts[i].content.title + "</div>").text() + "</a></p></div></div></li>"));
		}

		for (var i = 0; i < tables.length; i++) {
			var width = "span2";
			if (tables[i].type === "tablewide") {
				width = "span4";
			}
			tablesOverview.append($("<li class=\"" + width + "\"><div class=\"thumbnail tableLink\" data-numbers=\"" + tables[i].content.number + "\"><div class=\"caption\"><i class=\"fa fa-th-large\"></i><h5 class=\"overview\"><a href=\"#table_" + tables[i].content.number + "\" class=\"tableLink\" data-numbers=\"" + tables[i].content.number + "\">Tabell " + tables[i].content.number + "</a></h5><p><a href=\"#table_" + tables[i].content.number + "\" class=\"tableLink\" data-numbers=\"" + tables[i].content.number + "\">" + $("<div>" + tables[i].content.title + "</div>").text() + "</a></p></div></div></li>"));
		}

		for (var i = 0; i < figures.length; i++) {
			var text = $("<div>" + figures[i].content.text + "</div").text();
			if (text.length > 50) {
				text = text.substr(0,50) + "...";
			}
			figuresOverview.append($("<li class=\"span2\"><div class=\"thumbnail figureLink\" data-numbers=\"" + figures[i].content.number + "\"><div class=\"caption\"><i class=\"fa fa-bar-chart\"></i><h5 class=\"overview\"><a href=\"#figure_" + figures[i].content.number + "\" class=\"figureLink\" data-numbers=\"" + figures[i].content.number + "\">Figur " + figures[i].content.number + "</a></h5><p><a href=\"#figure_" + figures[i].content.number + "\" class=\"figureLink\" data-numbers=\"" + figures[i].content.number + "\">" + text + "</a></p></div></div></li>"));
		}

		var overview = $("<div id=\"boxCollection\" />");
		
		var addOverview = false;
		
		if (therapies.length > 0) {
			addOverview = true;
			overview.append(therapiesOverview);
		}

		if (facts.length > 0) {
			addOverview = true;
			overview.append(factsOverview);
		}

		if (tables.length > 0) {
			addOverview = true;
			overview.append(tablesOverview);
		}

		if (figures.length > 0) {
			addOverview = true;
			overview.append(figuresOverview);
		}

		if (addOverview) {
			var after = $("p.authors").first();
			
			if (after.length === 0) {
				after = $("h1,h2,h3,h4").first();
			}
			
			if (after.length === 0) {
				after = $("#main").children().first();
			}
			
			if (after.length === 1) {
				overview.prepend($("<h2>Terapirekommendationer / Faktarutor etc.</h2>"))
				after.after(overview);
				//after.after($("<h2>Terapirekommendationer / Faktarutor etc.</h2>"));
			}
		}

		//Make room for left column
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

function buildSideBarToc(index) {
	var content = "<li><a href=\"{pre}/\"><i class=\"fa fa-chevron-left\"></i> Tillbaka</a><ul>";

	var root = index[0];

	if (root.hasChildren) {
		content += getChildrenAsHtml(index, root.id);
	}
	
	content += "</li></ul>"
	return content;
}

function getIcon(type) {
	var icons = {
		parent: "fa fa-bookmark-o",
		header: "fa fa-bookmark-o",
		infoTable: "fa fa-th-large",
		facts: "fa fa-th-list",
		therapyRecommendations: "fa fa-info-circle",
		figure: "fa fa-bar-chart",
		division: "fa fa-bookmark-o"
	}
	if (icons[type] !== undefined) {
		return icons[type];
	} else {
		return icons["header"];
	}
}

function getChildrenAsHtml(index, parentId) {
	var content = "";
	var children = getIndexChildrenById(index, parentId);

	for (var i=0; i < children.length; i++) {
		content += "<li><a href=\"{pre}" + children[i].url + "#" + children[i].id + "\"><i class=\"fa " + (children[i].hasChildren ? "fa-bookmark-o" : getIcon(children[i].type)) + "\"></i> " + htmlEscape(children[i].title) + "</a>";
		if (children[i].hasChildren) {
			content += "<ul>"; //class=\"nav nav-list\"
			content += getChildrenAsHtml(index, children[i].id);
			content += "</ul>";
		}
		content += "</li>"
	}
	return content;
}

function htmlEscape (text) {

	return String(text)
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function getIndexChildrenById(index, parentId) {
	var children = [];
	for (var i=0; i < index.length; i++) {
		if (index[i].parentId === parentId) {
			children.push(index[i]);
		}
	}
	return children;
}
