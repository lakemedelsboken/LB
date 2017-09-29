var cheerio = require("cheerio");
var fs = require("fs");

var injector;

RegExp.quote = function(str) {
	return str.replace(/([.?*+^$[\]\\(){}-])/g, "\\$1");
};

var $;

module.exports = injector = {
	skippedTags: {
		h1: true,
		h2: true,
		h3: true,
		h4: true
	},
	process: function(text) {
		var self = this;

		if (text.indexOf("<body>") === -1) {
			text = "<body>" + text + "</body>";
		}

		//console.log(text);

		$ = cheerio.load(text);
		
		var body = $("body").first();

		self.iterate(body);
		
		return body.html();
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
				var skip = false;
				if (e.type === "tag" && (self.skippedTags[e.name] !== undefined || $(e).hasClass("overview"))) {
					skip = true;
				}
				if (!skip) {
					self.iterate(e)
				}
			});
		} else if (element.type === "text") {
			element.data = self._injectBoxLinks(element.data);
		}
		
	},
	_injectBoxLinks: function(text) {

		function extractNumbers(number) {
			var numbers = [];
			if (number.indexOf("-") > -1) {
				var start = parseInt(number.split("-")[0]);
				var stop = parseInt(number.split("-")[1]);
				for (var j=start; j <= stop; j++) {
					numbers.push(j);
				}
			} else {
				numbers = [parseInt(number)];
			}
			return numbers;
		}
		
		//Add a space for regex operations
//		text = " " + text;

//		text = text.replace(/[ (]Figur\s[0-9\-]+/g, function(match) {
		text = text.replace(/Figur\s[0-9]+/g, function(match) {
			//var firstChar = match.substr(0, 1);
			//match = match.substr(1);
			//console.log("Extract number from: \"" + match.split(" ") + "\"");
			var numbers = extractNumbers(match.split(/\s/)[1]);
			return "<a class=\"btn btn-small figureLink\" href=\"#figure_" + numbers[0] + "\" data-numbers=\"" + numbers.join(",") + "\">" + match + "</a>";
		});

//		text = text.replace(/[ (]Tabell\s[0-9\-]+/g, function(match) {
		text = text.replace(/Tabell\s[0-9]+/g, function(match) {
			//var firstChar = match.substr(0, 1);
			//match = match.substr(1);
			//console.log("Extract number from: \"" + match.split(" ") + "\"");
			var numbers = extractNumbers(match.split(/\s/)[1]);
			return "<a class=\"btn btn-small tableLink\" href=\"#table_" + numbers[0] + "\" data-numbers=\"" + numbers.join(",") + "\">" + match + "</a>";
		});

//		text = text.replace(/[ (]Faktaruta\s[0-9\-]+/g, function(match) {
		text = text.replace(/Faktaruta\s[0-9]+/g, function(match) {
			//var firstChar = match.substr(0, 1);
			//match = match.substr(1);
			//console.log("Extract number from: \"" + match.split(/\s/) + "\"");
			var numbers = extractNumbers(match.split(/\s/)[1]);
			//return firstChar + "<a class=\"btn btn-small factsLink\" href=\"#facts_" + numbers[0] + "\" data-numbers=\"" + numbers.join(",") + "\">" + match + "</a>";
			return "<a class=\"btn btn-small factsLink\" href=\"#facts_" + numbers[0] + "\" data-numbers=\"" + numbers.join(",") + "\">" + match + "</a>";
		});

		//Remove the added space
		//text = text.substr(1);
		return text;
		
	},
	isNumber:  function(o) {
	  return ! isNaN (o-0) && o !== null && o !== "" && o !== false;
	}
};
