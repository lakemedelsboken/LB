var fs = require("fs");
var path = require("path");
var escape = require('escape-html');

var Views = {
	name: "Text",
	description: "Textredigerare",
	getEditor: function(item) {
		var editorTemplate = fs.readFileSync(__dirname + "/editor.html", "utf8");

		for (var key in item) {
			var find = new RegExp("{" + key + "}", "g");
			editorTemplate = editorTemplate.replace(find, escape(item[key]));
		}

		return editorTemplate;
	},
	preProcess: function(item, id) {
		//Assign id:s before saving in order to build a correct index of the page
		if (!(item.settings.preprocessors && item.settings.preprocessors["idinjection.js"] === "true")) {
			item.content = require(path.join(__dirname, "..", "..", "preprocessors", "idinjection.js")).process(item.content);
		}

		//Remove the actual links to self and keep only the hash
		if (!(item.settings.preprocessors && item.settings.preprocessors["fixlinkstoself.js"] === "true")) {
			item.content = require(path.join(__dirname, "..", "..", "preprocessors", "fixlinkstoself.js")).process(item.content, id);
		}

		return item;

	},
	getOutput: function(item, id) {
		//Run item.content through postprocessing
		var resultHtml = item.content;

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
