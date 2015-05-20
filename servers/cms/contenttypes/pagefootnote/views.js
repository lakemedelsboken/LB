var fs = require("fs");
var path = require("path");
var escape = require('escape-html');

var Views = {
	name: "Sidfotnot",
	description: "Fotnot som ska visas i närheten av sin referens, t. ex. \"[2]\"",
	getEditor: function(item) {
		var editorTemplate = fs.readFileSync(__dirname + "/editor.html", "utf8");

		for (var key in item) {
			var find = new RegExp("{" + key + "}", "g");
			editorTemplate = editorTemplate.replace(find, escape(item[key]));
		}

		//Specific tags
		var findNumber = new RegExp("edit:" + item.name + ":number:value", "g");
		editorTemplate = editorTemplate.replace(findNumber, escape(item.content.number));

		var findText = new RegExp("edit:" + item.name + ":text:value", "g");
		editorTemplate = editorTemplate.replace(findText, escape(item.content.text));

		return editorTemplate;
	},
	getOutput: function(item) {

		var output = fs.readFileSync(__dirname + "/output.html", "utf8");
		
		output = output.replace(new RegExp("{number}", "g"), item.content.number);

		var resultHtml = item.content.text;

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

		output = output.replace(new RegExp("{text}", "g"), resultHtml);

		return output;
	},
	preProcess: function(item) {
		return item;
	},
	getDefaultType: function() {
		return JSON.parse(fs.readFileSync(__dirname + "/default.json"));
	}
};

module.exports = Views;