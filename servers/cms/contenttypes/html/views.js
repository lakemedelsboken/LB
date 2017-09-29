var fs = require("fs");
var escape = require('escape-html');

var Views = {
	name: "Html",
	description: "Ren Html-redigerare",
	getEditor: function(item) {
		var editorTemplate = fs.readFileSync(__dirname + "/editor.html", "utf8");

		for (var key in item) {
			var find = new RegExp("{" + key + "}", "g");
			editorTemplate = editorTemplate.replace(find, escape(item[key]));
		}

		return editorTemplate;
	},
	getOutput: function(item) {
		//Do not run item.content through postprocessing
		return item.content;
	},
	preProcess: function(item) {
		return item;
	},
	getDefaultType: function() {
		return JSON.parse(fs.readFileSync(__dirname + "/default.json"));
	}
};

module.exports = Views;