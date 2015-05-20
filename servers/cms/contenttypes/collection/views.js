var fs = require("fs");
var path = require("path");
var contentController = require("../../controllers/contentcontroller");
var historyModel = require("../../models/historymodel");
var wrench = require("wrench");
var cheerio = require("cheerio");
var escape = require("escape-html");
var urlparser = require("url");

var Views = {
	name: "Lista",
	description: "Visa korta avsnitt från ett flertal sidor",
	getEditor: function(item) {
		var editorTemplate = fs.readFileSync(__dirname + "/editor.html", "utf8");

		for (var key in item) {
			var find = new RegExp("{" + key + "}", "g");
			editorTemplate = editorTemplate.replace(find, escape(item[key]));
		}

		//Specific tags
		editorTemplate = editorTemplate.replace(new RegExp("edit:" + item.name + ":basedir:value", "g"), escape(item.content.basedir));
		editorTemplate = editorTemplate.replace(new RegExp("edit:" + item.name + ":filter:value", "g"), escape(item.content.filter));
		editorTemplate = editorTemplate.replace(new RegExp("edit:" + item.name + ":perpage:value", "g"), escape(item.content.perpage));
		editorTemplate = editorTemplate.replace(new RegExp("edit:" + item.name + ":htmlbefore:value", "g"), escape(item.content.htmlbefore));
		editorTemplate = editorTemplate.replace(new RegExp("edit:" + item.name + ":htmlafter:value", "g"), escape(item.content.htmlafter));

		if (item.content.createfeed && item.content.createfeed === "true") {
			editorTemplate = editorTemplate.replace(new RegExp("edit:" + item.name + ":createfeed:value", "g"), "checked");
		} else {
			editorTemplate = editorTemplate.replace(new RegExp("edit:" + item.name + ":createfeed:value", "g"), "");
		}

		return editorTemplate;
	},
	getOutput: function(item, publishType) {
		
		if (publishType !== "published") {
			publishType = "draft";
		}
		
		//Run item.content through postprocessing
		//var output = fs.readFileSync(__dirname + "/output.html", "utf8");
		
		var sortedPages = getSortedPages(item, publishType);

		//Build the output
		var output = [];

		//Trim to the first items
		if (item.content.perpage && item.content.perpage !== "" && item.content.perpage > 0 && sortedPages.length > parseInt(item.content.perpage)) {
			sortedPages.length = item.content.perpage;
		}

		for (var i = 0; i < sortedPages.length; i++) {
			var page = sortedPages[i];
			
			var url = "{pre}" + page.contentPath;
			
			output.push(item.content.htmlbefore.replace(/\{URL\}/ig, url));
			
			//Try to find a summary
			var summaries = [];
			for (var j = 0; j < page.content.content.length; j++) {
				if (page.content.content[j].type === "summary") {
					var contentViews = contentController.getContentTypes()["summary"];
					if (contentViews !== undefined) {
						summaries.push(contentViews.getOutput(page.content.content[j], publishType));
					}
				}
			}

			var title = page.content.title;


			//Get the html output from this page
			var pageContentPath = page.content.path;

			if (!pageContentPath) {
				pageContentPath = "unknown.json";
			}

			var outPath = path.join(contentController.baseDir, "..", "output", publishType, pageContentPath.replace(".json", ".html").replace(contentController.baseDir, ""));

			var renderedPage = "<html></html>";

			if (fs.existsSync(outPath)) {
				renderedPage = fs.readFileSync(outPath, "utf8");
			}
		
			var $ = cheerio.load(renderedPage);
		
			var titleItem = $("h1").first();
		
			if (titleItem.length === 0) {
				titleItem = $("h2").first();
			}

			if (title === "" && titleItem.length === 1) {
				title = titleItem.text().trim();
			}

			if (title === "" || title === undefined) {
				title = "[Ingen titel]";
			}

			if (summaries.length === 0) {

				//Get first content of the page
				var main = $("div#main").first();
			
				if (main.length === 0) {
					main = $("body");
				}
			
				main.find(".nonindexed").remove();
			
				var summary = main.find("p.ingress").first();
		
				if (summary === undefined || summary === null || summary.length === 0) {
					summary = main.find("p").first();
				}

				if (summary === undefined || summary === null || summary.length === 0) {
					summary = "";
				} else {
					summary = summary.html();
				}

				summaries.push("<p>" + summary + "</p>");

			}

			output.push("<h2><a href=\"" + url + "\">" + title + "</a></h2>");

			//TODO: Better handling of first paragraphs from the content
			output.push(summaries.join(""));

			output.push(item.content.htmlafter.replace(/\{URL\}/ig, url));
		}
		
		output = output.join("\n");
				
		return output;

	},
	getFeedItems: function(item, publishType) {

		if (item.content.createfeed !== "true") {
			return [];
		} else {

			if (publishType !== "published") {
				publishType = "draft";
			}

			var output = [];
		
			var sortedPages = getSortedPages(item, publishType);

			for (var i = 0; i < sortedPages.length; i++) {

				var item = {
					title: "",
					url: "",
					author: "",
					modified: "",
					published: "",
					summary: "",
					content: ""
				};

				var page = sortedPages[i];

				//Set url
				item.url = "{pre}" + page.contentPath;

				//Try to find a summary
				var summaries = [];
				for (var j = 0; j < page.content.content.length; j++) {
					if (page.content.content[j].type === "summary") {
						var contentViews = contentController.getContentTypes()["summary"];
						if (contentViews !== undefined) {
							var out = contentViews.getOutput(page.content.content[j], publishType);
							var $ = cheerio.load("<div>" + out + "</div>");
							var $element = fixLocalLinks($("div").first());
							summaries.push($element.html());
						}
					}
				}

				if (page.content.author && page.content.author !== "") {
					//Set author
					item.author = page.content.author;
				}

				//Set published
				item.published = page.content.published;
				if (item.published === "") {
					item.published = new Date(Date.parse(page.content.created));
				} else {
					item.published = new Date(Date.parse(item.published));
				}
		
				//Set modified
				item.modified = (page.content.modified || page.content.published);
				if (item.modified === "") {
					//console.log("modified: page.content.created: " + page.content.created);
					item.modified = new Date(Date.parse(page.content.created));
				} else {
					//console.log("modified: item.modified: " + item.modified);
					item.modified = new Date(Date.parse(item.modified));
				}

				var title = page.content.title;

				//Get the html output from this page
				var pageContentPath = page.content.path;
				if (!pageContentPath) {
					pageContentPath = "unknown.json";
				}

				var outPath = path.join(contentController.baseDir, "..", "output", publishType, pageContentPath.replace(".json", ".html").replace(contentController.baseDir, ""));

				var renderedPage = "<html></html>";
				if (fs.existsSync(outPath)) {
					renderedPage = fs.readFileSync(outPath, "utf8");
				}
		
				var $ = cheerio.load(renderedPage);
		
				var titleItem = $("h1").first();
		
				if (titleItem.length === 0) {
					titleItem = $("h2").first();
				}

				if (title === "" && titleItem.length === 1) {
					title = titleItem.text().trim();
				}

				if (title === "" || title === undefined) {
					title = "[Ingen titel]";
				}

				var main = $("div#main").first();
	
				if (main.length === 0) {
					main = $("body");
				}

				if (summaries.length === 0) {
					//Get first content of the page
		
					var summary = main.find("p.ingress").first();
		
					if (summary === undefined || summary === null || summary.length === 0) {
						summary = main.find("p").first();
					}

					if (summary === undefined || summary === null || summary.length === 0) {
						summary = "";
					} else {
						summary = fixLocalLinks(summary);
						summary = summary.html();
					}
				
					summaries.push(summary);
				}

				//Set title
				item.title = title;

				//Set summary
				item.summary = escape(summaries.join("")).trim();

				if (main.length > 0) {

					//Remove any nonindexed elements
					main.find(".nonindexed").remove();

					//Fix urls to include domain name
					main = fixLocalLinks(main);

					//Set full content
					item.content = escape(main.html()).trim();
				}
			
				output.push(item);

			}
		
			//Trim feed to 20 items
			if (output.length > 20) {
				output.length = 20;
			}
		
			return output;
			
		}

	},
	preProcess: function(item) {
		return item;
	},
	getDefaultType: function() {
		return JSON.parse(fs.readFileSync(__dirname + "/default.json"));
	},
	getSortedPages: function(item, publishType) {
		return getSortedPages(item, publishType);
	}
};

function fixLocalLinks($element) {
	//Fix urls to include domain name
	var query = cheerio.load("<div/>");

	var links = $element.find("a[href]");
	
	links.each(function(index, element) {
		var href = query(element).attr("href");
		if (href !== undefined && href !== "") {
			var url = urlparser.parse(href);
			
			if (url.hostname === undefined || url.hostname === null || url.hostname === "") {
				//TODO: Read from config
				url.protocol = "http:";
				url.hostname = "www.lakemedelsboken.se";
				query(element).attr("href", urlparser.format(url));
			}
		}
		
	});

	var images = $element.find("img[src]");
	
	images.each(function(index, element) {
		var src = query(element).attr("src");
		if (src !== undefined && src !== "") {
			var url = urlparser.parse(src);
			
			if (url.hostname === undefined || url.hostname === null || url.hostname === "") {
				//TODO: Read from config
				url.protocol = "http:";
				url.hostname = "www.lakemedelsboken.se";
				query(element).attr("src", urlparser.format(url));
			}
		}
		
	});

	//Make responsive images a single regular image in the feed
	var pictures = $element.find("div[data-picture]");
	
	pictures.each(function(index, element) {

		var image = query(element).find("img").first();
		
		if (image.length === 1) {
			query(element).replaceWith(image);
		}
		
	});
	
	return $element;
}

function getSortedPages(item, publishType) {

	var baseDir = path.join(contentController.baseDir, item.content.basedir);

	var allFiles = [];
	
	if (fs.existsSync(baseDir)) {
		allFiles = wrench.readdirSyncRecursive(baseDir);
	}
	
	var foundPages = allFiles.filter(function(element) {
		return (
			element.indexOf(".json") > -1 
			&& fs.statSync(baseDir + "/" + element).isFile() 
			&& element.indexOf(".snapshot") === -1 
			&& element.indexOf(".published") === -1
			&& element.indexOf("components/") === -1
			&& fs.statSync(baseDir + "/" + element).isFile())
			&& item.pagePath !== undefined
			&& path.normalize(baseDir + "/" + element) !== path.normalize(item.pagePath);
	});
	
	//Sort items by creation date
	var sortedPages = [];
	
	for (var i = foundPages.length - 1; i >= 0; i--) {
		var pagePath = path.join(baseDir, foundPages[i]);

		if (item.content.basedir === "") {
			item.content.basedir = "/";
		}
		
		if (publishType === "published") {

			//Check if the page is published
			var pageContent = JSON.parse(fs.readFileSync(pagePath, "utf8"));
			
			if (pageContent.isPublished) {
				var publishedVersions = historyModel.getPublished(pagePath);
				if (publishedVersions.length > 0) {
					var lastPublishedVersion = publishedVersions[0];
					sortedPages.push({path: pagePath, contentPath: path.join(item.content.basedir, foundPages[i].replace(".json", ".html")), content: JSON.parse(fs.readFileSync(lastPublishedVersion.path, "utf8"))});
				}
			}
		} else {
			sortedPages.push({path: pagePath, contentPath: path.join(item.content.basedir, foundPages[i].replace(".json", ".html")), content: JSON.parse(fs.readFileSync(pagePath, "utf8"))});
		}

	}
	
	sortedPages.sort(function(a, b) {
		var aDateString = (a.content.created || a.content.published || a.content.modified);
		var bDateString = (b.content.created || b.content.published || b.content.modified);
		
		if (aDateString === "" || aDateString === undefined) {
			aDateString = a.content.created;
		} 
		
		if (bDateString === "" || bDateString === undefined) {
			bDateString = b.content.created;
		}
		
		var aCreatedDate = new Date(Date.parse(aDateString)).getTime();
		var bCreatedDate = new Date(Date.parse(bDateString)).getTime();

		return bCreatedDate - aCreatedDate;
	});

	//Apply filters based on page tags
	if (item.content.filter && item.content.filter !== "") {
		var allowedPageTags = {};
		
		var filters = item.content.filter.split(",");
		for (var j = 0; j < filters.length; j++) {
			var filter = filters[j].trim();
			allowedPageTags[filter] = true;
		}

		sortedPages = sortedPages.filter(function(element) {
			var pageTags = element.content.pageType.split(",");
			var hasTag = false;

			for (var i = 0; i < pageTags.length; i++) {
				var tag = pageTags[i].trim();
				if (allowedPageTags[tag] !== undefined) {
					hasTag = true;
					break;
				}
			}

			return hasTag;
		});
	}

	return sortedPages;
}

module.exports = Views;