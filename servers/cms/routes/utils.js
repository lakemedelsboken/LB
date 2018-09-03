var express = require('express');
var router = express.Router();
var contentController = require("../controllers/contentcontroller");
var fs = require("fs-extra");
var path = require("path");
var request = require("request");

var wrench = require("wrench");

router.get("/extractkeywords", function(req, res) {

	var id = req.query["id"];

	var result = [];

	if (id !== undefined) {

		var secretApikeys = fs.readJsonSync("/var/www/lb/secretApikeys.json");
		var apiKeys = secretApikeys.api.keys;
		
		var apiKey = null;

		var key;

		for (key in apiKeys) {
			if (apiKeys[key] === "CMS") {
				apiKey = key;
				break;
			}
		}

		if (apiKey !== null) {

			id = id.replace(".json", ".html");

			var draftPath = path.join(contentController.baseDir, "..", "output", "draft", id);
			if (fs.existsSync(draftPath) && fs.statSync(draftPath).isFile()) {
				var content = fs.readFileSync(draftPath, "utf8");
				content = content.replace(/\n/g, "");
				content = content.replace(/\r/g, "");

				var excludedWords = ["behandling", "behandlas", "behandlas", "symtom", "faktaruta", "tabell", "risken", "patienter", "läkemedel", "effekt", "visat", "behandlas", "risk", "män", "svåra", "patienten", "personer", "pga", "kvinnor", "sverige", "mg/dag", "ökad", "ges", "for", "figur", "doser", "isbn", "användas", "alternativ", "form", "äldre", "barn", "vuxna", "månader", "veckor", "grupp", "ses", "differentialdiagnoser", "orsakas", "enstaka", "akut", "sjukdom", "preparat", "övervägas", "hand", "förekomst", "tecken", "vanligen", "patienterna", "utgör", "leda", "tillägg", "behov", "information"];

				request.post({url: "http://127.0.0.1:8003/api/v1/extractkeywords", 'json': true, form: {apikey: apiKey, content: content, exclude: JSON.stringify(excludedWords)}}, function (error, response, body) {
					var requestResult = [];
					if (!error && response.statusCode == 200) {
						requestResult = body;
					} else if (error) {
						console.log(error);
					} else {
						console.log("Status code: " + response.statusCode);
						console.log(body)
					}
					res.json(requestResult);
				});


			} else {
				console.log(draftPath + " does not exist or is not a file");
				res.json(result);
			}

		} else {
			console.log("Could not find API key for CMS");
			res.json(result);
		}

	} else {
		console.log("id was undefined");
		res.json(result);

	}

});


router.get("/links.json", function(req, res) {

	var allFiles = wrench.readdirSyncRecursive(contentController.baseDir);
	var foundPages = allFiles.filter(function(element) {
		return (element.indexOf(".index") > -1
				&& element.indexOf(".snapshot") === -1
				&& element.indexOf(".published") === -1
				&& fs.statSync(contentController.baseDir + "/" + element).isFile()
			);});

	var links = [];

	for (var i = 0; i < foundPages.length; i++) {
		var pagePath = foundPages[i];
		var parts = pagePath.split("/");

		var index = parts.pop();

		var menu = addParts(parts);

		addPageIndex(menu, pagePath);


	}

	function addParts(parts) {

		var lastMenu = links;

		for (var i = 0; i < parts.length; i++) {
			var part = parts[i];

			var exists = false;
			for (var j = 0; j < lastMenu.length; j++) {
				if (lastMenu[j].title === part) {
					exists = true;
					lastMenu = lastMenu[j].menu;
				}
			}

			if (!exists) {
				lastMenu.push({title: part, menu: []});
				lastMenu = lastMenu[lastMenu.length - 1].menu;
			}
		}

		return lastMenu;
	}

	function addPageIndex(menu, pagePath) {
		var pageName = pagePath.split("/").pop().replace(".index", ".html");
		menu.push({title: pageName, menu: [{title: pageName, value: "{pre}/" + pagePath.replace(".index", ".html")}]});
		var currentMenu = menu[menu.length - 1].menu;

		//Load index
		var index = null;

		try {
			index = JSON.parse(fs.readFileSync(path.join(contentController.baseDir, pagePath), "utf8"));
		} catch(err) {
			console.log("Error reading " + pagePath)
		}

		if (index !== null) {
			//Remove the root item
			index.shift();

			for (var i = 0; i < index.length; i++) {
				index[i].value = "{pre}/" + pagePath.replace(".index", ".html") + "#" + index[i].id;
				var indent = "";
				for (var j = 0; j < index[i].level; j++) {
					indent += "––";
				}
				index[i].title = indent + " " + index[i].title;

				if (index[i].title.length > 90) {
					index[i].title = index[i].title.substr(0, 90) + "...";
				}

				currentMenu.push(index[i]);
			}
		}

	}

	res.json(links);

/*
//TEMPLATE
	var links = [
		{title: 'Item 1', value: '/'},
		{title: 'Category Level 1', menu: [
			{title: 'C1 Page 1', value: '/c1/foo'},
			{title: 'C1 Page 2', value: '/c1/bar'},
			{title: 'Category Level 2', menu: [
				{title: 'C2 Page 1', value: '/c1/c2/foo'},
				{title: 'C2 Page 2', value: '/c1/c2/bar'}
			]}
		]}
	];
*/

});

module.exports = router;
