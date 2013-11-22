var fs = require("fs");

var exports = module.exports = createSearchIndex;

var $ = null;
var chapterName = null;
var chapterIdentifier = null;
var toc = null;
var contentsId = 0;

var atcTree = JSON.parse(fs.readFileSync(__dirname + "/../npl/atcTree.json", "utf8"));

function createSearchIndex(htmlContent, name) {

	$ = require("cheerio").load(htmlContent);
	chapterName = name;
	chapterIdentifier = chapterName.split("_")[0];

	toc = [{title: "root", level: 0, id: chapterIdentifier + "_" + contentsId, parentId: null, chapter: null, type: "header", titlePath: "", "hasChildren": false}];
	
	var body = $("div#main")[0];
	iterateElement(body, "");

	return JSON.stringify(toc, null, "\t");

}

function findParent(level) {
	for (var i = toc.length - 1; i >= 0; i--) {
		if (toc[i].level < level && toc[i].type === "header") {
			return toc[i];
			break;
		}
	}
}

function addToToc(id, title, level, type) {

	title = title.trim();
	var parent = findParent(level);
	parent.hasChildren = true;

	var titlePath = parent.titlePath + (parent.titlePath !== "" ? " && " : "") + title;

	var shortTitle = title;
	var shortTitleMaxLength = 95

	/*
	if (shortTitle.length > shortTitleMaxLength) {
		if (shortTitle.indexOf(",") > -1 && shortTitle.indexOf(",") < shortTitleMaxLength) {
			shortTitle = shortTitle.split(",")[0];
		} else if (shortTitle.indexOf(".") > -1 && shortTitle.indexOf(".") < shortTitleMaxLength) {
			shortTitle = shortTitle.split(".")[0];
		} else {
			shortTitle = shortTitle.substr(0, shortTitleMaxLength);
		}
	}
	*/

	toc.push({
		"title": shortTitle, 
		"level": level, 
		"id": id, 
		"parentId": parent.id, 
		"chapter": chapterName, 
		"type": type, 
		"titlePath": titlePath, 
		"content": title,
		"products": ""
	});
	
}

function addContent(content, elementName, element) {

	if (content !== undefined && content !== "undefined" && content !== "") {

		var findTypeOfHeader = {"header": null};

		if (elementName === "td") {
			findTypeOfHeader = {"facts": null, "therapyRecommendations": null, "infoTable": null};
		}

		if (element.hasClass("figureText")) {
			findTypeOfHeader = {"figure": null};
		}

		var tocItem = null;

		//Find correct tocItem
		for (var i = toc.length - 1; i >= 0; i--){
			if (findTypeOfHeader.hasOwnProperty(toc[i].type)) {
				tocItem = toc[i];
				break;
			}
		}

		if (tocItem !== null && tocItem.title !== "root" && (tocItem.level > 1 || element.hasClass("authors"))) {
			if (tocItem.type === "figure") {
				var appendTitle = content;
				var appendTitleMaxLength = 95

				if (appendTitle.length > appendTitleMaxLength) {
					if (appendTitle.indexOf(",") > -1 && appendTitle.indexOf(",") < appendTitleMaxLength) {
						appendTitle = appendTitle.split(",")[0];
					} else if (appendTitle.indexOf(".") > -1 && appendTitle.indexOf(".") < appendTitleMaxLength) {
						appendTitle = appendTitle.split(".")[0];
					} else {
						appendTitle = appendTitle.substr(0, appendTitleMaxLength);
					}
				}

				tocItem.title += (" " + appendTitle + "...");
			}
			tocItem.content += " " + content;
			tocItem.content = tocItem.content.replace(/\s+/g, " ");
			
//			if (tocItem.type === "therapyRecommendations") {
				var genericas = element.find(".inlineGenerica");
				var foundProducts = {};
				
				if (tocItem.products !== "" && typeof tocItem.products !== "string") {
					console.error("Error: ", tocItem);
				}
				
				
				if (tocItem.products !== "") {
					tocItem.products.split(" ").forEach(function(word) {
						foundProducts[word] = true;
					});
				}

				if (genericas.length > 0) {
					//Find underlying product names
					genericas.each(function(index, generica) {
						generica = $(generica);
						
						//console.error(generica);
						
						var atcCodes = generica.attr("data-atcid").split(",");
						
						for (var i = 0; i < atcCodes.length; i++) {
							var productNames = findProductNamesFromATCCode(atcCodes[i]);
							for (var j = 0; j < productNames.length; j++) {
								foundProducts[productNames[j]] = true;
							}
						}
					});
				}
				
				var endProducts = [];
				for (var productName in foundProducts) {
					endProducts.push(productName);
				}
				
				if (endProducts.length > 0) {
					tocItem.products = endProducts.join(" ");
				}
//			}
			
		} else {
//			console.error("Could not find toc item of type: ");
//			console.error(findTypeOfHeader);
//			console.error("For element " + elementName + " with content " + content);
		}
	} else {
		//console.error("Skipping content: " + content);
	}

}

var indent = "";

var savedTable = null;

function iterateElement(element) {

	if (element.type === "tag") {

		var headerTags = {"h1": 1, "h2": 2, "h3": 3, "h4": 4};

		if (headerTags[element.name] !== undefined && !$(element).hasClass("overview")) {

			var level = headerTags[element.name];
			/*
			indent = "";
			for (var i=0; i < (level - 1); i++) {
				indent += "\t";
			}

			console.log(indent + "HEADER " + level + " " + $(element).text());
			*/
			
			var type = "header";
			
			//Identify facts, therapyRecommendations and infoTables
			if ($(element).hasClass("facts")) {
				type = "facts";
			} else if ($(element).hasClass("therapyRecommendations")) {
				type = "therapyRecommendations";
			} else if ($(element).hasClass("infoTable")) {
				type = "infoTable";
			} else if ($(element).hasClass("figure")) {
				type = "figure";
			}

			//TODO: Find indices?

			var dataId = $(element).attr("id");

			if (dataId === undefined) {
				console.error(element);
			}
			
			if (type === "facts" || type === "figure" || type === "therapyRecommendations" || type === "infoTable") {
				//Switch level to 3
				level = 3;
			}
			
			if (type === "facts" && $(element).hasClass("skip")) {
				//If the last item was also a facts item (it probably was) add the title to that header
				if (toc[toc.length - 1].type === "facts") {
					toc[toc.length - 1].title += (" - " + $(element).text());
				} else {
                    $(element).find("a.inlineReference").remove();
					addToToc(dataId, $(element).text(), level, type);
				}
			} else {
                //Remove references from text
                $(element).find(".inlineReference").remove();
				addToToc(dataId, $(element).text(), level, type);
			}
		
		} else if (element.attribs["id"] !== "main" && !$(element).hasClass("tableLine") && element.name !== "a" && element.name !== undefined && element.name !== "em" && element.name !== "span" && element.name !== "ol" && element.name !== "br" && element.name !== "ul" && element.name !== "tr" && element.name !== "button" && element.name !== "img" && element.name !== "strong" && element.name !== "table" && element.name !== "thead"  && element.name !== "th" && element.name !== "i") {
			
			//console.log(indent + "\t" + element.name + " : " + $(element).text());
			//console.error("Adding tag content for: " + element.name);
			addContent($(element).text(), element.name, $(element));
			
		}

		//Repeat for children
		if (element.children !== undefined) {
			for (var i=0; i < element.children.length; i++) {
				iterateElement(element.children[i]);
			}
		}
	}
}

function findProductNamesFromATCCode(atcCode) {
	var result = [];

	for (var i = 0; i < atcTree.length; i++) {
		if (atcTree[i].parentId === atcCode) {
			if (atcTree[i].type === "product") {
				var productName = atcTree[i].title.split(",")[0].toLowerCase().replace("®", "").split(" ");

				var end = productName.length;
				if (end > 1) {
					end = (end - 1);
				}

				for (var j = 0; j < end; j++) {
					result.push(productName[j]);
				}
			} else if (atcTree[i].type === "atc") {
				result = result.concat(findProductNamesFromATCCode(atcTree[i].id));
			}
		}
	}
	
	return result;
}
