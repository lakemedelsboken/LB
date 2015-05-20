var express = require('express');
var router = express.Router();
var contentController = require("../controllers/contentcontroller");
var fs = require("fs");
var path = require("path");

var wrench = require("wrench");

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
