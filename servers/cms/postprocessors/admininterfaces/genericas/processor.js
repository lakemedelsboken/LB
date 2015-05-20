var path = require("path");
var fs = require("fs-extra");

var processor = {
	addRoutes: function(router) {

		router.get("/processors/genericas", function(req, res) {

			var output = {id: req.path, title: "Substansnamn", keywords: getKeywords()};

			res.render("genericas_keywords", output);

		});

		router.get('/processors/genericas/updatekeyword', function(req,res) {
			if (req.xhr) {
				var word = req.query["keyword"];
				var atc = req.query["value"];
	
				if (word !== undefined && word !== "" && atc !== undefined && atc !== "") {
					if (atc.indexOf("(*") > -1) {
						atc = atc.split("(*")[0];
					}
					word = word.toLowerCase();
					updateWord(word, atc);
					res.send(200);
				} else {
					res.send(500, "Not what I was expecting...");
				}
			} else {
				res.send(500, "Not what I was expecting...");
			}
		});

		router.get('/processors/genericas/deletekeyword', function(req,res) {
			if (req.xhr) {
				var word = req.query["keyword"];
				if (word !== undefined && word !== "") {
					deleteWord(word);
					res.send(200);
				} else {
					res.send(500, "Not what I was expecting...");
				}
			} else {
				res.send(500, "Not what I was expecting...");
			}
		});

		router.get('/processors/genericas/atctree', function(req,res){

			var root = req.query["root"];

			if (root === "source") {
				root = "root";
			}

			var tree = getTreeChildren(root);

			res.json(tree);
		});

		router.get('/processors/genericas/keywords.json', function(req,res) {
			res.json(getKeywords());
		});
		
		router.get('/processors/genericas/atc', function(req,res){

			var query = req.query["query"];
			var results = [];
			var maxResults = 200;
			if (query !== undefined && query.length > 1) {

				query = query.toLowerCase();

				for (var i=0; i < atcTree.length; i++) {

					if (atcTree[i].id !== "root" && atcTree[i].type === "atc" && (atcTree[i].title.toLowerCase().indexOf(query) > -1 || atcTree[i].id.toLowerCase().indexOf(query) > -1)) {
						if (atcTree[i].title.toLowerCase() === query) {
							results.unshift(atcTree[i].id + " " + atcTree[i].title);
						} else {
							results.push(atcTree[i].id + " " + atcTree[i].title);
						}
						if (results.length >= maxResults) {
							break;
						}
					}

					if (atcTree[i].id !== "root" && atcTree[i].type !== "atc" && atcTree[i].title !== undefined && (atcTree[i].title.toLowerCase().indexOf(query) > -1 || atcTree[i].id.toLowerCase().indexOf(query) > -1)) {
						var parentATC = null;
						for (var j=0; j < atcTree.length; j++) {
							if (atcTree[j].id === atcTree[i].parentId) {
								parentATC = atcTree[j];
							}
						};
						results.push(parentATC.id + " " + parentATC.title + " (*" + atcTree[i].title + ")");
						if (results.length >= maxResults) {
							break;
						}
					}

				}
			}
			
			var options = {"options": results};

			res.json(options);

		});
		
		return {name: "genericas", route: "/processors/genericas"};
		
	}
}

var atcTree = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "..", "..", "..", "npl", "atcTree.json"), "utf8"));

function getTreeChildren(parentId, showATCCodes) {

	console.log("Fetching: " + parentId);

	var childATCCodes = [];
	var childProducts = [];
	var parent = null;

	var result = [];

	if (showATCCodes === undefined) {
		showATCCodes = true;
	}

	for (var j = 0; j < atcTree.length; j++) {

		if (atcTree[j].parentId === parentId) {
			var child = atcTree[j];
			if (child.type === "atc" && child.hasChildren) {
				childATCCodes.push(child);
			} else {
				childProducts.push(child);
			}
		}
	
		if (atcTree[j].id === parentId) {
			parent = atcTree[j];
		}
	}

	for (var i = 0; i < childATCCodes.length; i++) {
		result.push({text: ((showATCCodes) ? childATCCodes[i].id + " " : "") + childATCCodes[i].title, id: childATCCodes[i].id, hasChildren: true});
	}

	for (var i = 0; i < childProducts.length; i++) {
		var product = getProduct(childProducts[i].title);
		//result.push({text: childProducts[i].title, id: childProducts[i].id});
		var title = childProducts[i].title;
		title = title.split(",");
		title[0] = "<strong>" + title[0] + "</strong>";
		title = title.join(",");
		title = "<a href=\"#\" data-product-id=\"" + childProducts[i].id + "\" class=\"inlineProduct\">" + title + "</a>";
		product.children.push({text: title, id: childProducts[i].id});

	}

	//TODO: Fix products that have a single child

	return result;

	function getProduct(productTitle) {
		productTitle = productTitle.split(",")[0];
	
		var product = null;
		//Find if the product already exists
		for (var i=0; i < result.length; i++) {
			if (result[i].text === productTitle) {
				product = result[i];
				break;
			}
		}
	
		if (product === null) {
			product = {text: productTitle, id: productTitle, children: []};
			result.push(product)
		}
	
		return product;
	}

}

function getKeywords() {

	keywords = JSON.parse(fs.readFileSync(__dirname + "/keywords.json", "utf8"));

	//Sort keywords on ATC
	var sortedKeywords = [];
	for (var name in keywords) {
		sortedKeywords.push({name: name, atc: keywords[name].atc});
	}

	sortedKeywords.sort(function(a, b) {
		if(a.atc < b.atc) return -1;
		if(a.atc > b.atc) return 1;
		return 0;
	});

	//console.log(sortedKeywords);

	var sorted = {};
	for (var i = 0; i < sortedKeywords.length; i++) {
		sorted[sortedKeywords[i].name] = {atc: sortedKeywords[i].atc};
	}

	return sorted;

}
function deleteWord(word) {

	createBackupCopyOfWords();

	var words = getKeywords();
	delete words[word];
	fs.writeFileSync(__dirname + "/keywords.json", JSON.stringify(words, null, "\t"), "utf8");
	keywords = words;
}

function updateWord(word, atc) {

	createBackupCopyOfWords();

	var words = getKeywords();
	words[word] = {"atc": atc};
	fs.writeFileSync(__dirname + "/keywords.json", JSON.stringify(words, null, "\t"), "utf8");
	keywords = words;
}

function createBackupCopyOfWords() {
	var backupLocation = __dirname + "/backup/keywords-" + getCurrentTimestamp() + ".json";
	fs.copySync(__dirname + "/keywords.json", backupLocation);
}

function getPastTimestamp(t) {
	var d = new Date(t);
	var output = "";
	var items = new Array();
	var i = 0;
	items[i++] = d.getFullYear();
	items[i++] = d.getMonth() + 1;
	items[i++] = d.getDate();
	items[i++] = d.getHours();
	items[i++] = d.getMinutes();
	items[i]   = d.getSeconds();

	for(i=0;i<items.length;i+=1) {
		output += (items[i]<10)?"0"+items[i]:items[i];
		if(i < items.length - 1) output += '-'; 
	}

	return output;
}
function getCurrentTimestamp() {
	return getPastTimestamp((new Date()).getTime());
}


module.exports = processor;