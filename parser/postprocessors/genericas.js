var cheerio = require("cheerio");
var fs = require("fs");

var injector;

RegExp.quote = function(str) {
	return str.replace(/([.?*+^$[\]\\(){}-])/g, "\\$1");
};

var $;

module.exports = injector = {
	genericas: null,
	process: function(text) {
		var self = this;

		if (text.indexOf("<body>") === -1) {
			text = "<body>" + text + "</body>";
		}

		$ = cheerio.load(text);
		
		var body = $("body").first();

		self.iterate(body);
		
		return $.html();
	},
	htmlEscape: function(text) {

		return String(text)
			.replace(/&/g, '&amp;')
			.replace(/%/g, '&#37;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');

	},
	
	iterate: function(element) {
		var self = this;

		
		if (element.type === "tag" || (element.length && element.length > 0)) {
			element = $(element);
			element.contents().each(function(i, e) {
				//console.log(e);
				self.iterate(e)
			});
		} else if (element.type === "text") {
			element.data = self._injectGenericas(element.data);
			//console.log(element.data);
		}
		
	},
	_injectGenericas: function(text) {
		var self = this;
		
		if (self.genericas === null) {
			self.loadGenericas();
		}

		if (text.trim() !== "") {

			text = " " + text + " ";

			for (var title in self.genericas) {
				var genericaName = title;
				
				var re = new RegExp("[ (/;\[\-]" + RegExp.quote(genericaName.toLowerCase()) + "[^<]", "gi"); 
				text = text.replace(re, function(match) {

					var genericaATC = [];
					var genericaTitles = [];
					var saveGenericaTitles = [];
					
					for (var i=0; i < self.genericas[title].length; i++) {
						genericaATC.push(self.genericas[title][i].id);

						var originalItem = self.getGenericaById(self.genericas[title][i].id);
						if (originalItem !== undefined) {
							genericaTitles.push(self.htmlEscape(originalItem.titlePath).replace(/\s\/\s/g, "<|>").replace(/\(/g, "(|").replace(/\)/g, "|)").replace(/\s/g, "_"));
							saveGenericaTitles.push(originalItem.titlePath + " :: " + originalItem.idPath);
						} else {
							if (self.genericas[title][i].id === "X") {
								genericaTitles = [];
								break;
							}
							//console.error("Could not find generica for: " + title + " with id: " + self.genericas[title][i].id);
						}
					}

					var href = "/atc/" + genericaATC.join("-");
					//console.error("Match: \"" + match + "\"");
					var matchedWord = match.substr(1, match.length - 2);
					
					
					if (genericaTitles.length > 0) {
						var result = match.substr(0, 1) + "<a href=\"" + href + "\" data-atcid=\"" + genericaATC.join(",") + "\" data-atctitles=\"" + genericaTitles.join("##") + "\" class=\"inlineGenerica text\">" + matchedWord + "</a>" + match.substr(match.length - 1);

						return result;
					} else {
						return match.substr(0, 1) + "<span>" + matchedWord + "</span>" + match.substr(match.length - 1);
					}
					//TODO: Perhaps dangerous: data-atc-title=\"" + self.htmlEscape(genericaName) + "\"
				});
			}
			
			text = text.substr(1, text.length - 2);
			text = text.replace(/\<\|\>/g, "--");
			text = text.replace(/\(\|/g, "(");
			text = text.replace(/\|\)/g, ")");

		}


		return text;

	},
	originalGenericas : null,
	getGenericaById: function(id) {
		var self = this;
		var returnItem = undefined;
		
		if (self.originalGenericas === null) {
			self.originalGenericas = JSON.parse(fs.readFileSync(__dirname + "/../npl/atcTree.json"), "utf8");
		}
		for (var i=0; i < self.originalGenericas.length; i++) {
			if (self.originalGenericas[i].id === id) {
				returnItem = self.originalGenericas[i];
				break;
			}
		}
		
		return returnItem;
	},
	loadGenericas: function() {
		var self = this;
		
		var genericas = JSON.parse(fs.readFileSync(__dirname + "/../../npl/atcTree.json"), "utf8");
		genericas.shift(); //remove root element

		var blackList = {
			"övrigt": true,
			"kol": true,
			"vitaminer": true,
			"kombinationer": true,
			"skelett": true
		};

		//remove non atc types, exclude short atc-codes and short titles
		genericas = genericas.filter(function(element) {
			if (element.type === "atc" && element.id.length > 3 && element.title.length > 3 && (blackList[element.title.toLowerCase()] === undefined)) {
				var subProducts = self.findProductNamesFromATCCode(element.id);
				return (subProducts.length > 0);
			} else {
				return false;
			}
		});

		//sort with the longest title first
		genericas.sort(function(a, b) {
			return (b.title.length - a.title.length)
		});

		var distilledGenericas = {};

		//add keywords
		var keywords = JSON.parse(fs.readFileSync(__dirname + "/../../servers/admin/keywords.json"), "utf8");

		var sortedKeywords = [];

		for (var keyword in keywords) {
			sortedKeywords.push({title: keyword, atc: keywords[keyword].atc});
		}

		//sort with the longest title first
		sortedKeywords.sort(function(a, b) {
			return (b.title.length - a.title.length)
		});

		for (var i=0; i < sortedKeywords.length; i++) {
			if (distilledGenericas[sortedKeywords[i].title.toLowerCase()] === undefined) {
				distilledGenericas[sortedKeywords[i].title.toLowerCase()] = [{id: sortedKeywords[i].atc.split(" ")[0], title: sortedKeywords[i].title, type: "atc"}];
			} else {
				distilledGenericas[sortedKeywords[i].title.toLowerCase()].push({id: sortedKeywords[i].atc.split(" ")[0], title: sortedKeywords[i].title, type: "atc"});
			}
		}

		//create object with keywords for genericas with the same name
		for (var i=0; i < genericas.length; i++) {
			if (distilledGenericas[genericas[i].title.toLowerCase()] === undefined) {
				distilledGenericas[genericas[i].title.toLowerCase()] = [genericas[i]];
			} else {
				/*
				//TODO: Fix: Check if current generica is a descendant of an already added generica
				var alreadyAdded = false;
				for (var j=0; j < distilledGenericas[genericas[i].title.toLowerCase()].length; j++) {
					var item = distilledGenericas[genericas[i].title.toLowerCase()][j];
					if (item.id.indexOf(genericas[i].id) === 0) {
						alreadyAdded = true;
						break;
					}
				}
				if (!alreadyAdded) {
					distilledGenericas[genericas[i].title.toLowerCase()].push(genericas[i]);
				}
				*/
				distilledGenericas[genericas[i].title.toLowerCase()].push(genericas[i]);
			}
		}

		self.genericas = distilledGenericas;

		return;
	},
	isNumber:  function(o) {
	  return ! isNaN (o-0) && o !== null && o !== "" && o !== false;
	},
	findProductNamesFromATCCode: function(atcCode) {
		var result = [];
		var self = this;

		if (self.originalGenericas === null) {
			self.originalGenericas = JSON.parse(fs.readFileSync(__dirname + "/../../npl/atcTree.json"), "utf8");
		}

		var atcTree = self.originalGenericas;

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
					result = result.concat(self.findProductNamesFromATCCode(atcTree[i].id));
				}
			}
		}
	
		return result;
	}
	
};

//var testText = "<html><body><p><span>paracetamol</span>tramadol</p></body></html>";
//console.log(injector.injectGenericas(testText));