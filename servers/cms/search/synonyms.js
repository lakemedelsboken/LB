var cheerio = require("cheerio");
var fs = require("fs");
var crypto = require("crypto");
var path = require("path");
var chokidar = require("chokidar");

var injector;

var $;

module.exports = injector = {
	synonyms: null,
	stringifiedSynonyms: null,
	process: function(text) {
		var self = this;

		if (self.synonyms === null) {
			self.loadSynonyms();
			self.stringifiedSynonyms = JSON.stringify(self.synonyms);
		}

		var contentToChecksum = text + self.stringifiedSynonyms;

		var textHash = self.createCheckSum(contentToChecksum);
		
		var result = self.getPreparsedText(textHash);
		
		if (result === undefined) {

			result = self._injectSynonyms(text);
			
			self.savePreparsedText(textHash, result);
		}

		return result;
	},
	getPreparsedText: function(hash) {
		var possibleFilePath = path.join(__dirname, "synonyms", "preparsed_synonyms", hash + ".txt");
		if (fs.existsSync(possibleFilePath)) {
			return fs.readFileSync(possibleFilePath, "utf8");
		} else {
			return undefined;
		}
	},
	savePreparsedText: function(hash, parsedText) {
		fs.writeFileSync(path.join(__dirname, "synonyms", "preparsed_synonyms", hash + ".txt"), parsedText, "utf8");
	},
	createCheckSum: function(data) {
		var checksum = crypto.createHash("sha1");
		checksum.update(data);
		return checksum.digest("hex");
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
			element.data = self._injectSynonyms(element.data);
			//console.log(element.data);
		}
		
	},
	_injectSynonyms: function(text) {
		var self = this;
		
		if (self.synonyms === null) {
			self.loadSynonyms();
		}

		var foundSynonyms = [];

		if (text.trim() !== "") {

			text = " " + text.toLowerCase() + " ";
			text = text.replace(/\./g, "");

			for (var i = self.synonymKeys.length - 1; i >= 0; i--) {
				var index = text.indexOf(" " + self.synonymKeys[i] + " ");
				if (index > -1) {
					foundSynonyms.push({index: index, synonyms: self.synonyms[self.synonymKeys[i]]});
				}
			}

/*
			var words = text.split(" ");

			words.forEach(function(word) {

				word = word.toLowerCase();

				if (self.synonyms[word] !== undefined) {
					foundSynonyms = foundSynonyms.concat(self.synonyms[word]);
				}
				
			});
*/

		}

		if (foundSynonyms.length > 0) {
			var result = "";
			
			foundSynonyms.sort(function(a, b) {
				return a.index - b.index;
			});
			
			foundSynonyms.forEach(function(item) {
				var fillerLength = item.index - result.length;
				if (fillerLength < 1) {
					fillerLength = 1;
				}

				var filler = "";

				for (var i = 0; i < fillerLength; i++) {
					filler += " ";
				}
				result = result + filler + item.synonyms.join(" ");
			});
			
			return result;
			
		} else {
			return "";
		}

		return foundSynonyms.join(" ");

	},
	loadSynonyms: function() {
		var self = this;

		var terms = fs.readFileSync(path.join(__dirname, "synonyms", "terms.txt"), "utf8");
		terms = terms.replace(/\r/g, "");

		var rows = terms.split("\n");

		var ids = {};

		for (var i = 1; i < rows.length; i++) {

			var lineValues = rows[i].split("\t");
			var id = lineValues[0];
			var word = lineValues[2];
	
			if (ids[id] === undefined) {
				ids[id] = [];
			}
	
			if (word !== "") {
				ids[id].push(word);
			}
	
		}

		var synonyms = fs.readFileSync(path.join(__dirname, "synonyms", "synonyms.txt"), "utf8");
		synonyms = synonyms.replace(/\r/g, "");

		var rows = synonyms.split("\n");

		for (var i = 1; i < rows.length; i++) {

			var lineValues = rows[i].split("\t");
			var id = lineValues[1];
			var word = lineValues[0];

			if (word !== "") {
				if (ids[id] !== undefined) {
					ids[id].push(word);
				}
			}

		}

		var synonyms = {};

		for (var id in ids) {
			if (ids[id].length > 1) {

				for (var i = 0; i < ids[id].length; i++) {
					var word = ids[id][i].toLowerCase();
					if (synonyms[word] === undefined) {
						synonyms[word] = [];
					}
		
					for (var j = 0; j < ids[id].length; j++) {
						var otherword = ids[id][j].toLowerCase();
						if (otherword !== word && otherword !== "") {
							synonyms[word].push(otherword);
						}
					}
			
				}
			}
		}
		
		self.synonyms = synonyms;
		self.synonymKeys = Object.keys(synonyms);


		return;
	}	
};

