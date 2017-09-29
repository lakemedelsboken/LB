var fs = require("fs");
var path = require("path");
var cheerio = require("cheerio");
var escape = require('escape-html');

var Views = {
	name: "Författare",
	description: "Information om en författare",
	getEditor: function(item) {
		var editorTemplate = fs.readFileSync(__dirname + "/editor.html", "utf8");

		for (var key in item) {
			var find = new RegExp("{" + key + "}", "g");
			editorTemplate = editorTemplate.replace(find, escape(item[key]));
		}

		//Specific tags
		var findFirstname = new RegExp("edit:" + item.name + ":firstname:value", "g");
		editorTemplate = editorTemplate.replace(findFirstname, escape(item.content.firstname));

		var findSurname = new RegExp("edit:" + item.name + ":surname:value", "g");
		editorTemplate = editorTemplate.replace(findSurname, escape(item.content.surname));

		var findDescription = new RegExp("edit:" + item.name + ":description:value", "g");
		editorTemplate = editorTemplate.replace(findDescription, escape(item.content.description));

		var findEmail = new RegExp("edit:" + item.name + ":email:value", "g");
		editorTemplate = editorTemplate.replace(findEmail, escape(item.content.email));

		return editorTemplate;
	},
	getOutput: function(item) {
		return "";
	},
	preProcess: function(item) {
		return item;
	},
	getDefaultType: function() {
		return JSON.parse(fs.readFileSync(__dirname + "/default.json"));
	}
};

module.exports = Views;