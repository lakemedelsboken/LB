var fs = require("fs");

var authors = JSON.parse(fs.readFileSync(__dirname + "/Authors.json", "utf8"));
var chapters = JSON.parse(fs.readFileSync(__dirname + "/Chapters.json", "utf8"));
var masterIndex = JSON.parse(fs.readFileSync(__dirname + "/../../site/MasterIndex.json", "utf8"));

var AuthorsRegistry = {

	getIndexedAuthors: function() {
		var indexed = {};

		for (var i = 0; i < authors.length; i++) {

			var author = authors[i];

			var written = getChapters(author.id_author);
	
			if (written.length > 0) {

				author.chapters = written;

				var firstLetter = author.name.substr(0, 1).toUpperCase();
		
				if (indexed[firstLetter] === undefined) {
					indexed[firstLetter] = [];
				}
		
				indexed[firstLetter].push(author);
		
			} else {
				console.log("Could not find any chapters for: \"" + author.name + "\"");
			}
		}
	
		return indexed;
	}
}

function getChapters(author_id) {

	var result = [];
	for (var i = 0; i < chapters.length; i++) {
		if (chapters[i].id_author === author_id) {
				
			var htmlFileName = getHtmlFile(chapters[i].chaptertitle);
			if (htmlFileName !== null) {
				chapters[i].htmlFile = htmlFileName;
			}

			result.push(chapters[i]);
		}
	}
	
	return result;
}

var _files = null;
function getFiles() {
	if (_files === null) {
		_files = fs.readdirSync(__dirname + "/../../site/chapters/");
	}
	
	return _files;
}

function getHtmlFile(chapterName) {

	var files = getFiles();
	
	for (var key in masterIndex) {
		if (masterIndex[key].name === chapterName) {
			key = key.toLowerCase();
			for (var i = 0; i < files.length; i++) {
				var fileName = files[i].toLowerCase();
				if (fileName.indexOf("_") > -1) {
					var possibleKey = fileName.split("_")[0];
					if (possibleKey === key) {
						return fileName;
					}
				}
			}
		}
	}
	
	console.log("Could not find chapter for: \"" + chapterName + "\"")
	return null;
}

module.exports = AuthorsRegistry;
