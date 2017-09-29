var fs = require("fs");
var path = require("path");
var escape = require("escape-html");
var cheerio = require("cheerio");

var staticSettingsPath = path.join(__dirname, "..", "..", "output", "static", "settings.json");
var staticSettings = JSON.parse(fs.readFileSync(staticSettingsPath, "utf8"));

var chokidar = require("chokidar");

var chokidarOptions = {
	persistent: true,
	ignoreInitial: true
};

chokidar.watch(staticSettingsPath, chokidarOptions).on("all", function(event, path) {

	if (event === "change" || event === "add") {
		console.log("'settings.json' has changed, reloading /contenttypes/figure/views.js");
		staticSettings = JSON.parse(fs.readFileSync(staticSettingsPath, "utf8"));
	}

});

var Views = {
	name: "Figur",
	description: "Mall för figur",
	getEditor: function(item) {
		var editorTemplate = fs.readFileSync(__dirname + "/editor.html", "utf8");

		for (var key in item) {
			var find = new RegExp("{" + key + "}", "g");
			editorTemplate = editorTemplate.replace(find, item[key]);
		}

		//Specific tags
		var findNumber = new RegExp("edit:" + item.name + ":number:value", "g");
		editorTemplate = editorTemplate.replace(findNumber, escape(item.content.number));

		var findImage = new RegExp("edit:" + item.name + ":image:value", "g");
		editorTemplate = editorTemplate.replace(findImage, escape(item.content.image));

		var findText = new RegExp("edit:" + item.name + ":text:value", "g");
		editorTemplate = editorTemplate.replace(findText, escape(item.content.text));

		var findTitle = new RegExp("edit:" + item.name + ":title:value", "g");
		editorTemplate = editorTemplate.replace(findTitle, escape(item.content.title));

		var maxWidth = new RegExp("edit:" + item.name + ":maxwidth:value", "g");
		editorTemplate = editorTemplate.replace(maxWidth, escape(item.content.maxwidth));

		var findId = new RegExp("edit:" + item.name + ":id:value", "g");
		editorTemplate = editorTemplate.replace(findId, escape(item.content.id));

		return editorTemplate;
	},
	getOutput: function(item) {

		var output = fs.readFileSync(__dirname + "/output.html", "utf8");

		var removeTitle = false;
		var removeSecondTitle = false;

		if (item.content.number > 0) {
			output = output.replace(new RegExp("{number}", "g"), item.content.number);
		} else {
			output = output.replace(new RegExp("{number}", "g"), "");
			removeTitle = true;
		}

		if (item.content.id !== "" && item.content.id !== "undefined" && item.content.id !== undefined) {
			output = output.replace(new RegExp("{id}", "g"), " id=\"" + item.content.id + "\"");
		} else {
			output = output.replace(new RegExp("{id}", "g"), " id=\"figure_id_" + item.content.number + "\"");
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

			output = output.replace(new RegExp("{title}", "g"), " " + resultHtml);
		} else {
			output = output.replace(new RegExp("{title}", "g"), "");
			removeSecondTitle = true;
		}

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
		output = output.replace(new RegExp("{alt}", "g"), item.content.alt);

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

		output = output.replace(new RegExp("{source}", "g"), "{pre}/" + staticSettings.version + item.content.image);

		if (removeTitle) {
			$ = cheerio.load(output);
			//$("h4").first().remove();
			output = $.html();
		}

		if (removeSecondTitle) {
			$ = cheerio.load(output);
					/*if (removeFactsTitle) {
						$("tr").first().remove();
					} else {
						$("tr").eq(1).remove();
					}*/
			output = $.html();
		}


		return output;
	},
	preProcess: function(item,id) {

		//Remove the actual links to self and keep only the hash
		if (!(item.settings.preprocessors && item.settings.preprocessors["fixlinkstoself.js"] === "true")) {
			item.content.text = require(path.join(__dirname, "..", "..", "preprocessors", "fixlinkstoself.js")).process(item.content.text, id);
		}

		return item;
	},
	getDefaultType: function() {
		return JSON.parse(fs.readFileSync(__dirname + "/default.json"));
	}
};

module.exports = Views;
