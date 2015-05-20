var fs = require("fs");
var path = require("path");
var escape = require('escape-html');
var cheerio = require("cheerio");

var Views = {
	name: "Sammanfattning",
	description: "En sammanfattning som kan användas för listor",
	getEditor: function(item) {
		var editorTemplate = fs.readFileSync(__dirname + "/editor.html", "utf8");

		for (var key in item) {
			var find = new RegExp("{" + key + "}", "g");
			editorTemplate = editorTemplate.replace(find, escape(item[key]));
		}

		return editorTemplate;
	},
	preProcess: function(item) {
		//Assign id:s before saving in order to build a correct index of the page
//		if (!(item.settings.preprocessors && item.settings.preprocessors["idinjection.js"] === "true")) {
//			item.content = require(path.join(__dirname, "..", "..", "preprocessors", "idinjection.js")).process(item.content);
//		}

		return item;
		
	},
	getOutput: function(item) {
		//Run item.content through postprocessing

		var resultHtml = item.content;

		//Make sure all elements have class "summary"
		var $ = cheerio.load(resultHtml);
		$("*").each(function(index, element) {
			if (!$(element).hasClass("summary")) {
				$(element).addClass("summary");
			}
		});

		resultHtml = $.html();

		//Determine based on settings if any postprocessing should be omitted for the current item
		if (!(item.settings.postprocessors && item.settings.postprocessors["genericas.js"] === "true")) {
			resultHtml = require("../../postprocessors/genericas.js").process(resultHtml);
		}
		if (!(item.settings.postprocessors && item.settings.postprocessors["boxlinks.js"] === "true")) {
			resultHtml = require("../../postprocessors/boxlinks.js").process(resultHtml);
		}
		if (!(item.settings.postprocessors && item.settings.postprocessors["references.js"] === "true")) {
			resultHtml = require("../../postprocessors/references.js").process(resultHtml);
		}
		if (!(item.settings.postprocessors && item.settings.postprocessors["pagefootnotes.js"] === "true")) {
			resultHtml = require("../../postprocessors/pagefootnotes.js").process(resultHtml);
		}

		return resultHtml;

	},
	getDefaultType: function() {
		return JSON.parse(fs.readFileSync(__dirname + "/default.json"));
	}
};

module.exports = Views;