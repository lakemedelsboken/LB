var cheerio = require("cheerio");
var fs = require("fs");

var injector;

RegExp.quote = function(str) {
	return str.replace(/([.?*+^$[\]\\(){}-])/g, "\\$1");
};

var $;

module.exports = injector = {
	skippedTags: {
	},
	process: function(text) {
		var self = this;

		if (text.indexOf("<body>") === -1) {
			text = "<body>" + text + "</body>";
		}

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
			element.data = self.injectPageFootnotes(element.data);
		}
		
	},
	injectPageFootnotes: function(text) {

		function extractNumbers(number) {
			var numbers = [];
			if (number.indexOf("-") > -1) {
				var start = parseInt(number.split("-")[0]);
				var stop = parseInt(number.split("-")[1]);
				for (var j=start; j <= stop; j++) {
					numbers.push(j);
				}
			} else if (number.indexOf(",") > -1) {
				//Remove spaces
				numbers = number.replace(/\s+/g, "").split(",");
				//Parse to integers
				numbers = numbers.map(function(current) {return parseInt(current);});
			} else {
				numbers = [parseInt(number)];
			}
			return numbers;
		}
		
		text = text.replace(/\[[0-9\-,]+\]/g, function(match) {
			//Exclude "[" and "]"
			var numbers = extractNumbers(match.replace(/[\[\]]/g, ""));
			if (numbers.length > 0) {
				return "<a class=\"pageFootnoteItem\" href=\"#pagefootnote_" + numbers[0] + "\" data-pagefootnotenumber=\"" + numbers.join(",") + "\"><sup>" + numbers.join(", ") + "</sup></a>";
			} else {
				return match;
			}
		});

		return text;
		
	}
};
