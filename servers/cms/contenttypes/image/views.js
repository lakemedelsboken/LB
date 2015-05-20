var fs = require("fs");
var path = require("path");
var escape = require('escape-html');

var Views = {
	name: "Bild",
	description: "Välj en bild",
	getEditor: function(item) {
		var editorTemplate = fs.readFileSync(__dirname + "/editor.html", "utf8");

		for (var key in item) {
			var find = new RegExp("{" + key + "}", "g");
			editorTemplate = editorTemplate.replace(find, escape(item[key]));
		}

		var findImage = new RegExp("edit:" + item.name + ":image:value", "g");
		editorTemplate = editorTemplate.replace(findImage, escape(item.content.image));

		var findText = new RegExp("edit:" + item.name + ":alt:value", "g");
		editorTemplate = editorTemplate.replace(findText, escape(item.content.alt));

		var findBefore = new RegExp("edit:" + item.name + ":htmlbefore:value", "g");
		editorTemplate = editorTemplate.replace(findBefore, escape(item.content.htmlbefore));

		var findAfter = new RegExp("edit:" + item.name + ":htmlafter:value", "g");
		editorTemplate = editorTemplate.replace(findAfter, escape(item.content.htmlafter));

		var maxWidth = new RegExp("edit:" + item.name + ":maxwidth:value", "g");
		editorTemplate = editorTemplate.replace(maxWidth, escape(item.content.maxwidth));

		return editorTemplate;
	},
	getOutput: function(item) {
		var output = fs.readFileSync(__dirname + "/output.html", "utf8");

		output = output.replace(new RegExp("{source}", "g"), path.join("{pre}", item.content.image));

		output = output.replace(new RegExp("{alt}", "g"), item.content.alt);

		output = output.replace(new RegExp("{htmlbefore}", "g"), item.content.htmlbefore);
		output = output.replace(new RegExp("{htmlafter}", "g"), item.content.htmlafter);
		
		var maxWidth = item.content.maxwidth;

		if (maxWidth && maxWidth !== undefined && maxWidth !== "undefined" && maxWidth !== "") {
			if (maxWidth.indexOf("px") > 1 || maxWidth.indexOf("%") > -1) {
				maxWidth = " style=\"max-width: " + maxWidth + ";\"";
			} else {
				maxWidth = " style=\"max-width: " + maxWidth + "px;\"";
			}
		} else {
			maxWidth = "";
		}
		
		output = output.replace(new RegExp("{maxwidth}", "g"), maxWidth);

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