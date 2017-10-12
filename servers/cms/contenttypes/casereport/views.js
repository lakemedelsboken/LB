var fs = require("fs");
var path = require("path");
var cheerio = require("cheerio");
var escape = require('escape-html');

var Views = {
	name: "Fallbeskrivning",
	description: "",
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

		var findTitle = new RegExp("edit:" + item.name + ":title:value", "g");
		editorTemplate = editorTemplate.replace(findTitle, escape(item.content.title));

		var findId = new RegExp("edit:" + item.name + ":id:value", "g");
		editorTemplate = editorTemplate.replace(findId, escape(item.content.id));

		return editorTemplate;
	},
	getOutput: function(item) {

		var output = fs.readFileSync(__dirname + "/output.html", "utf8");

		var removeCaseReportTitle = false;
		var removeSecondTitle = false;

		if (item.content.number > 0) {
			output = output.replace(new RegExp("{number}", "g"), item.content.number);
		} else {
			removeCaseReportTitle = true;
		}



		if (item.content.id !== "" && item.content.id !== "undefined" && item.content.id !== undefined) {
			output = output.replace(new RegExp("{id}", "g"), " id=\"" + item.content.id + "\"");
		} else {
			output = output.replace(new RegExp("{id}", "g"), "");
		}

		if (item.content.title && item.content.title !== "") {
			var resultHtml = item.content.title;

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

			output = output.replace(new RegExp("{title}", "g"), resultHtml);
		} else {
			output = output.replace(new RegExp("{title}", "g"), "");
			removeSecondTitle = true;
		}

		var $ = cheerio.load(item.content.text);

		//Count max columns in a row
		var maxColumns = 1;
		var table = $("table").first();

		if (table.length === 1) {
			table.find("tr").each(function(index, element) {
				var tr = $(element);
				var rowColumns = 0;
				tr.find("td").each(function(i, e) {
					if ($(e).attr("colspan") !== undefined) {
						rowColumns += parseInt($(e).attr("colspan"));
					} else {
						rowColumns++;
					}
				});
				if (rowColumns > maxColumns) {
					maxColumns = rowColumns;
				}
			});
		}

		output = output.replace(new RegExp("{columns}", "g"), maxColumns);

		var resultHtml = "<tr><td>" + item.content.text + "</td></tr>";

		if (table.length === 1) {
			//Render only <tbody> contents
			resultHtml = $("tbody").first().html();
		}

		if (resultHtml !== undefined && resultHtml !== null) {

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
		} else {
			resultHtml = "";
		}
		output = output.replace(new RegExp("{text}", "g"), resultHtml);

		if (removeCaseReportTitle) {
			$ = cheerio.load(output);
			//$("tr").first().remove();
			output = $.html();
		}

		if (removeSecondTitle) {
			$ = cheerio.load(output);
			/*if (removeCaseReportTitle) {
				$("tr").first().remove();
			} else {
				$("tr").eq(1).remove();
			}*/
			output = $.html();
		}

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
