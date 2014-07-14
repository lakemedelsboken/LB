var cluster = require('cluster');
var path = require("path");
var fs = require("fs");
var wrench = require("wrench");
var async = require("async");
var crypto = require("crypto");
var request = require("request");
var zlib = require("zlib");
var chokidar = require("chokidar");

var secretSettingsPath = __dirname + "/../../settings/secretSettings.json";

if (!fs.existsSync(secretSettingsPath)) {
	console.error("Config file [" + secretSettingsPath + "] missing!");
	console.error("Did you forget to run `make decrypt_conf`?");
	process.exit(1);
}

(function() {
	var conf_time = fs.statSync(secretSettingsPath).mtime.getTime();
	var cast5_time = fs.statSync(secretSettingsPath + ".cast5").mtime.getTime();
 
	if (conf_time < cast5_time) {
		console.error("Your config file is out of date!");
		console.error("You need to run `make decrypt_conf` to update it.");
		process.exit(1);
	}
})();

var secretSettings = JSON.parse(fs.readFileSync(secretSettingsPath, "utf8"));

//Setup master index
var masterIndex = JSON.parse(fs.readFileSync(__dirname + "/masterIndex.json", "utf8"));

var atcTree = JSON.parse(fs.readFileSync(__dirname + "/../../npl/atcTree.json", "utf8"));
//var searchIndexer = require("../../search/createSearchIndex.js");
//var Fuse = require("./lib/fuse.js");

var settings = JSON.parse(fs.readFileSync(__dirname + "/../../settings/settings.json", "utf8"));

var networkPort = settings.internalServerPorts.site;
var searchPort = settings.internalServerPorts.search;

var app = require('./app').init(networkPort);

var finishedSearches = {};
var searchIndex = null;
var searchIndices = [];
var chapterFileNames = null;
var indexCache = {};
var siteMap = null;

initFileWatchers();

//TODO: Switch to polling
function initFileWatchers() {
	
	//var chaptersPath = path.normalize(__dirname + "/chapters/");
	var atcTreePath = path.normalize(__dirname + "/../../npl/atcTree.json");
	
	//var chaptersWatcher = chokidar.watch(chaptersPath, {ignored: /^\./, persistent: true, ignoreInitial: true, interval: 20000, binaryInterval: 20000});
	var atcTreeWatcher = chokidar.watch(atcTreePath, {persistent: true, ignoreInitial: true, interval: 20000, binaryInterval: 20000});

	//chaptersWatcher.on('error', function(error) {console.error('Error happened on chapters file watch', error);})
	//console.log("Watching " + chaptersPath + " for changes...");

	//chaptersWatcher.on('all', function(path, stats) {

	//	console.log("Clearing cached file reads.");
	//	clearCachedFileReads();

	//});

	atcTreeWatcher.on('error', function(error) {console.error('Error happened on atc file watch', error);})
	console.log("Watching " + atcTreePath + " for changes...");
	atcTreeWatcher.on('all', function(path, stats) {

		//TODO: Mail?

		console.log("Reloading ATC tree.");
		atcTree = JSON.parse(fs.readFileSync(__dirname + "/../../npl/atcTree.json", "utf8"));

	});

}

function clearCachedFileReads() {
	chapterFileNames = null;
	indexCache = {};
}

var locals = {
	title: 'Läkemedelsboken',
	description: '',
	author: '',
	version: settings.version
};

app.get('/sitemap.xml', function(req,res){

	getSiteMap(function(err, sitemapXml) {

		if (err) {
			console.log(err);
		}
		
		res.set('Content-Type', 'text/xml');
		res.send(200, sitemapXml);
	});

	
});

function htmlEscape (text) {

	return String(text)
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

//No javascript search results
app.get('/search', function(req,res){

	var terms = req.query["search"];

	if (typeof terms === "string") {
		terms = terms.trim()
	}
	
	if (terms === undefined) {
		terms = "";
	}

	locals.terms = terms;
	
	if (terms === "") {
		locals.err = false;
		locals.results = {medicinesearch: [], contentsearch: []};
		res.render('search.ejs', locals);
		
	} else {

		async.parallel({
			contentsearch: function(callback) {
				request('http://127.0.0.1:' + searchPort + '/contentsearch?search=' + encodeURIComponent(terms), {'json': true}, function (err, response, body) {

					if (err) {
						callback(err)
					} else {
						callback(null, body);
					}
				});
			},
			medicinesearch: function(callback) {
				request('http://127.0.0.1:' + searchPort + '/medicinesearch?search=' + encodeURIComponent(terms), {'json': true}, function (err, response, body) {

					if (err) {
						callback(err)
					} else {
						callback(null, body);
					}
				});
			},
		}, function(err, results) {

			if (err) {
				console.error(err);
				locals.err = "Något gick fel med sökningen, var god försök igen senare.";
				res.render('search.ejs', locals);
			} else {
				locals.err = false;
				locals.results = results;
				res.render('search.ejs', locals);
			}
		});
		
	}

});

app.get('/tree', function(req,res){

	var root = req.query["root"];

	if (root === "source") {
		root = "root";
	}

	var tree = getTreeChildren(root);

	res.json(tree);
});

app.get('/medlist', function(req,res){

	var id = req.query["id"];
	var tree = [];

	//Find item
	var items = [];
	
	for (var i=0; i < atcTree.length; i++) {
		if (atcTree[i].id === id) {
			items.push(atcTree[i]);
		}
	}
	
	if (items.length > 0) {
		for (var m=0; m < items.length; m++) {
			var item = items[m];

			//Find item's grandparent
			var parentId = item.parentId;
			var parent = null;
	
			for (var i=0; i < atcTree.length; i++) {
				if (atcTree[i].id === parentId) {
					parent = atcTree[i];
					break;
				}
			}
	
			if (parent !== null) {
				//Build list
				tree.push(parent);
				for (var i=0; i < atcTree.length; i++) {
					if (atcTree[i].type === "product" && atcTree[i].parentId === parent.id) {
						tree.push(atcTree[i]);
					}
				}
			}
		}
	}
	
	
	//Send back
	res.json(tree);
});

function isParentInItems(items, item) {
	var result = false;
	for (var i=0; i < items.length; i++) {
		if (items[i].id === item.parentId) {
			result = true;
			break;
		}
	}
	return result;
}


app.get('/tocitems', function(req,res){

	var parentId = req.query["id"];

	if (parentId === "root") {

		var index = masterIndex;
		
		//Return divisions
		var divisions = {};
		var chapterId;
		for (chapterId in index) {
			if (divisions[index[chapterId].division] === undefined) {
				divisions[index[chapterId].division] = [chapterId.toLowerCase()];
			} else {
				divisions[index[chapterId].division].push(chapterId.toLowerCase());
			}
		}

		var newDivisions = [];
		var division;
		for (division in divisions) {
			newDivisions.push({id: division, title: division, chapters: divisions[division], type: "division", hasChildren: true});
		}

		res.json(newDivisions);
		
	} else if (parentId === "" || (parentId.indexOf("_") === -1) || parentId === undefined || parentId === null) {

		var chapters = [];

		var files = getChapterFileNames();
		
		if (parentId.length < 4) {
			//Must be an id and not a division name
			
			//Find correct division name
			if (masterIndex[parentId.toUpperCase()] !== undefined) {
				parentId = masterIndex[parentId.toUpperCase()].division;
				chapters.push({headeritem: true, id: "", title: parentId, chapter: "", hasChildren: false});
			}
		}
		
		//Try with id === division name
		for (var chapterId in masterIndex) {
			if (masterIndex[chapterId].division === parentId) {
				//Find name of html file
				var fileName = "";
				for (var i=0; i < files.length; i++) {
					if (files[i].indexOf(chapterId.toLowerCase() + "_") === 0) {
						fileName = files[i];
						break;
					}
				}

				chapters.push({id: chapterId.toLowerCase() + "_", title: masterIndex[chapterId].name, chapter: fileName, hasChildren: (fileName !== "" ? true : false)});
			}
		}
		
		res.json(chapters);
	} else {
		//Find correct index
		var chapterId = parentId.split("_")[0];
		
		//Get index
		var index = getIndexByChapterId(chapterId);
		
		if (index === null) {
			res.json([]);
		} else {
			//Find out if parentId exists, otherwise set the first item (besides from root) as parentId
			var parentIdExists = false;
			for (var i=0; i < index.length; i++) {
				if (index[i].id === parentId) {
					parentIdExists = true;
					break;
				}
			}
			
			if (!parentIdExists) {
				parentId = index[1].id;
			}

			//Find children and add to response
			var children = [];
			for (var i=0; i < index.length; i++) {
				if (index[i].parentId === parentId) {
					//No need to worry about cloning
					index[i].content = null;
					if (index[i].headeritem !== undefined) {
						delete index[i].headeritem;
					}
					//index[i].headeritem = false;
					index[i].products = "";
					
					children.push(index[i]);
				}
				if (index[i].id === parentId) {
					//No need to worry about cloning
					index[i].content = null;
					index[i].headeritem = true;
					index[i].products = "";
					children.push(index[i]);
				}
				
				
			}
			res.json(children);
		}
	}

});

function getSiteMap(callback) {

	if (siteMap === null) {
		
		var header = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xsi:schemaLocation=\"http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd\" xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n";
		var footer = "\n</urlset>";
	
		var content = [];

		//Get all pages
		fs.readdir(__dirname + "/chapters", function(err, data) {
			if (err) {
				callback(err, "");
			} else {

				var htmlFiles = data.filter(function(fileName) { return (fileName.indexOf(".html") > -1);})
	
				for (var i = 0; i < htmlFiles.length; i++) {
					content.push("\t<url>");
					content.push("\t\t<loc>http://www.lakemedelsboken.se/" + htmlFiles[i] + "</loc>");
					content.push("\t</url>");
				}
	
				content = content.join("\n");
	
				var combined = header + content + footer;

				siteMap = combined;

				callback(null, siteMap);
			
			}
		
		});
	} else {
		callback(null, siteMap);
	}
}

function getIndexByChapterId(chapterId) {

	var index = null;

	if (indexCache[chapterId] === undefined) {
		//Iterate folders, find the correct one
		var foldersPath = __dirname + "/chapters/";
		var folders = fs.readdirSync(foldersPath);
		var filePath = null;
		for (var i=0; i < folders.length; i++) {
			if (folders[i].indexOf(chapterId + "_") > -1 && folders[i].indexOf("_index") > -1) {
				filePath = foldersPath + folders[i] + "/" + folders[i].replace("_index", ".json");
				break;
			}
		}
		if (filePath !== null) {
			index = JSON.parse(fs.readFileSync(filePath));
			indexCache[chapterId] = index;
		}
		
	} else {
		index = indexCache[chapterId];
	}

	return index;
}

app.get('/tocparentitems', function(req,res){

	var itemId = req.query["id"];

	var index = masterIndex;
		
	if (itemId.indexOf("parent") > -1 || itemId === "" || itemId === undefined || itemId === null) {
		//Return divisions
		var divisions = {};
		var chapterId;
		for (chapterId in index) {
			if (divisions[index[chapterId].division] === undefined) {
				divisions[index[chapterId].division] = [chapterId.toLowerCase()];
			} else {
				divisions[index[chapterId].division].push(chapterId.toLowerCase());
			}
		}

		var newDivisions = [];
		var division;
		for (division in divisions) {
			newDivisions.push({id: division, title: division, chapters: divisions[division], type: "division", hasChildren: true});
		}

		res.json(newDivisions);
	} else {
		//Return division and chapters based on one chapter id
		res.json(getChaptersFromChapterId(itemId));
	}

});


function getChapterFileNames() {
	
	if (chapterFileNames === null) {
		chapterFileNames = fs.readdirSync(__dirname + "/chapters").filter(function(fileName) { return (fileName.indexOf(".html") > -1);});
	}
	
	return chapterFileNames;
}

function getChaptersFromChapterId(chapterId) {

	var divisionId = null;
	var index = masterIndex;
	var itemId = chapterId;

	if (index[itemId.toUpperCase()] !== undefined) {
		divisionId = index[itemId.toUpperCase()].division;
	}
	
	if (divisionId === null) {
		return [];
	} else {
		var chapters = [];
	
		var chapterId;
		var files = getChapterFileNames();
		
		for (chapterId in index) {
			if (index[chapterId].division === divisionId) {
				//Find name of html file
				var fileName = "";
				for (var i=0; i < files.length; i++) {
					if (files[i].indexOf(chapterId.toLowerCase() + "_") === 0) {
						fileName = files[i];
						break;
					}
				}
				chapters.push({id: chapterId.toLowerCase() + "_", title: index[chapterId].name, chapter: fileName, hasChildren: (fileName !== "" ? true : false)});
			}
		}
	
		return chapters;
	}
	
}

app.get('/medicinesearch', function(req,res){

	request("http://127.0.0.1:" + searchPort + req.originalUrl, {'json': true}, function (error, response, body) {
		var requestResult = [];
		if (!error && response.statusCode == 200) {
			requestResult = body;
		} else if (error) {
			console.log(error);
		} else {
			console.log("Status code: " + response.statusCode);
		}
		res.json(requestResult);
	});

});

app.get('/titlesearch', function(req,res){

	request("http://127.0.0.1:" + searchPort + req.originalUrl, {'json': true}, function (error, response, body) {
		var requestResult = [];
		if (!error && response.statusCode == 200) {
			requestResult = body;
		} else if (error) {
			console.log(error);
		} else {
			console.log("Status code: " + response.statusCode);
		}
		res.json(requestResult);
	});

});

app.get('/contentsearch', function(req,res){

	request("http://127.0.0.1:" + searchPort + req.originalUrl, {'json': true}, function (error, response, body) {
		var requestResult = [];
		if (!error && response.statusCode == 200) {
			requestResult = body;
		} else if (error) {
			console.log(error);
		} else {
			console.log("Status code: " + response.statusCode);
		}
		res.json(requestResult);
	});

});

app.get('/boxsearch', function(req,res){

	request("http://127.0.0.1:" + searchPort + req.originalUrl, {'json': true}, function (error, response, body) {
		var requestResult = [];
		if (!error && response.statusCode == 200) {
			requestResult = body;
		} else if (error) {
			console.log(error);
		} else {
			console.log("Status code: " + response.statusCode);
		}
		res.json(requestResult);
	});

});

app.get('/atctree', function(req,res){

	var parentId = req.query["parentid"];

	if (parentId === "source") {
		parentId = "root";
	}

	var tree = getATCTreeChildren(parentId, false);

	res.json(tree);
});

function getATCTreeChildren(parentId, showATCCodes) {

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
			} else if (child.type === "product") {
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

		var parallelimport = (childProducts[i].parallelimport !== undefined && childProducts[i].parallelimport !== "") ? "(Parallelimport) " : "";

		title[1] = parallelimport + title[1];

		title = title.join(",");
		
		var images = (childProducts[i].images !== undefined) ? childProducts[i].images : [];

		product.children.push({text: title, id: childProducts[i].id, images: images, noinfo: (childProducts[i].noinfo === true)});

	}

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

function getTreeChildren(parentId, showATCCodes) {

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

app.get('/atc/:atcCodes?', function(req, res) {
	var atcCodes = ["root"];
	
	if (req.params.atcCodes !== undefined && req.params.atcCodes !== "") {
		atcCodes = req.params.atcCodes.split("-");
	}
	
	var atcItems = [];
	for (var i = 0; i < atcCodes.length; i++) {
		var atcItem = null;
		var children = [];
		for (var j = 0; j < atcTree.length; j++) {
			if (atcTree[j].id === atcCodes[i]) {
				atcItem = atcTree[j];
			}
			if (atcTree[j].parentId === atcCodes[i]) {
				children.push(atcTree[j]);
			}
		}
		
		if (atcItem !== null) {
			var titlePath = atcItem.titlePath.split(" / ");;
			var idPath = atcItem.idPath.split(" / ");
			
			titlePath.unshift("ATC");
			idPath.unshift("root");

			for (var k = 0; k < titlePath.length; k++) {
				titlePath[k] = "<a href=\"/atc/" + idPath[k] + "\">" + titlePath[k] + "</a>";
			}
			
			titlePath.pop();

			titlePath = titlePath.join(" &#187; ");

			var title = atcItem.title;
			if (title === undefined) {
				title = "ATC"
			}
			atcItems.push({title: title, titlePath: titlePath, children: children});
		}
	}

	locals.atc = atcItems;
	res.render("atc.ejs", locals);

});

app.get('/product/:nplId?', function(req, res) {
	var nplId = "";
	
	if (req.params.nplId !== undefined && req.params.nplId !== "") {
		nplId = req.params.nplId;
		nplId = nplId.replace(/\//g, "").replace(/\./g, "");
	}
		
	var product = {noinfo: true, id: nplId};

	async.parallel({
		product: function(callback) {
			if (nplId !== "" && nplId.length > 4) {
				//Check if product exists
				fs.exists(__dirname + "/../../fass/www/products/" + nplId + ".json", function(fileExists) {
					if (fileExists) {
						fs.readFile(__dirname + "/../../fass/www/products/" + nplId + ".json", "utf8", function(err, data) {
							if (err) {
								console.log(err);
							} else {
								product = JSON.parse(data);
							}
							callback(null, product);
						});
					} else {
						//console.error("File does not exist: " + nplId + ".json");
						callback(new Error("No product with nplId: " + nplId));
					}
				});
			} else {
				callback(new Error("Invalid nplId: " + nplId));
			}
		},
		medlist: function(callback) {
			request("http://127.0.0.1:" + networkPort + "/medlist?id=" + nplId, {'json': true}, function (error, response, body) {
				var requestResult = [];
				if (!error && response.statusCode == 200) {
					requestResult = body;
					callback(null, requestResult)
				} else if (error) {
					callback(error);
				} else {
					console.log("Status code: " + response.statusCode);
					callback(null, requestResult)
				}
			});
		}
	}, function(err, results) {
		if (err) {
			res.render('404.ejs', locals);
		} else {
			locals.product = results.product;
			locals.medList = results.medlist;
			res.render("product.ejs", locals);
		}
	});

});

var oldIndex = JSON.parse(fs.readFileSync(__dirname + "/previousSiteIndex.json", "utf8"));

function getOldNameFromChapterPath(chapterPath) {

	var foundName = undefined;

	for (var i = oldIndex.length - 1; i >= 0; i--) {
		if (oldIndex[i].chapter === chapterPath && oldIndex[i].level === 1) {
			foundName = oldIndex[i].title;
			break;
		}
	}
	
	return foundName;
}

app.get("/psidata", function(req, res){
	res.redirect(301, "/api/");
});

/* The 404 Route (Keep this as the last route) */
app.get('/*', function(req, res){

	res.status(400);

	var url = req.url;
	var query = req.query;

	var tocKey = undefined;
	var medicineName = undefined;
	var chapter = undefined;
	var pdf = undefined;
	
	
	//Requested toc in chapter?
	for (var key in query) {
		if (key.indexOf("toc") === 0) {
			tocKey = parseInt(key.replace("toc", ""));
		}
	}

	//Requested medicine?
	if (query["medicine"] !== null) {
		medicineName = query["medicine"];
	}
	
	//Requested chapter?
	if (url.toLowerCase().indexOf(".html") > -1) {
		chapter = url.toLowerCase().split(".html")[0];
		if (chapter.indexOf("/") > -1) {
			chapter = chapter.split("/");
			chapter = chapter[chapter.length - 1];
		}
		
		var possibleChapter = getOldNameFromChapterPath(chapter + ".html");
		if (possibleChapter === undefined) {
			chapter = decodeURIComponent(chapter);
		} else {
			chapter = possibleChapter;
		}
	}

	//Requested pdf?
	if (url.toLowerCase().indexOf(".pdf") > -1) {
		pdf = url.toLowerCase().split(".pdf")[0];
		if (pdf.indexOf("/") > -1) {
			pdf = pdf.split("/");
			pdf = pdf[pdf.length - 1];
		}
		chapter = decodeURIComponent(pdf);
	}

	var foundIndex = undefined;
	
	if (tocKey) {
		for (var i = oldIndex.length - 1; i >= 0; i--) {
			if (oldIndex[i].id === tocKey) {
				foundIndex = "\"" + oldIndex[i].title + "\"";
				chapter = "\"" + getOldNameFromChapterPath(oldIndex[i].chapter) + "\"";
				break;
			}
		}
	}
	
	locals.suggestions = [];
	locals.medicineSuggestions = [];

	if (foundIndex && chapter) {
		//Perform search
		request('http://127.0.0.1:' + searchPort + '/titlesearch?search=' + encodeURIComponent(foundIndex + " " + chapter), {'json': true}, function (err, response, body) {
			if (!err && body !== undefined) {
				locals.suggestions = body;
			}
			
			if (locals.suggestions.length === 0) {
				request('http://127.0.0.1:' + searchPort + '/titlesearch?search=' + encodeURIComponent(chapter), {'json': true}, function (err, response, body) {
					if (!err && body !== undefined) {
						locals.suggestions = body;

						locals.suggestions.sort(function(a,b){
							var aParam = a.id;
							var bParam = b.id;
							
							if (aParam.indexOf("_") > -1) {
								aParam = aParam.split("_")[1];
								if (aParam.length > 0) {
									aParam = parseInt(aParam);
								} else {
									aParam = a.id;
								}
							}

							if (bParam.indexOf("_") > -1) {
								bParam = bParam.split("_")[1];
								if (bParam.length > 0) {
									bParam = parseInt(bParam);
								} else {
									bParam = b.id;
								}
							}
							
							if(aParam < bParam) return -1;
							if(aParam > bParam) return 1;
							return 0;
						});

					}
						
					res.render('404.ejs', locals);

				});
				
			} else {
				res.render('404.ejs', locals);
			}

		});
	} else if (medicineName) {
		request('http://127.0.0.1:' + searchPort + '/medicinesearch?search=' + encodeURIComponent(medicineName), {'json': true}, function (err, response, body) {

			if (!err) {
				locals.medicineSuggestions = body;
			}
			
			res.render('404.ejs', locals);

		});

	} else if (chapter) {
		console.log("Searching for: " + chapter);
		request('http://127.0.0.1:' + searchPort + '/titlesearch?search=' + encodeURIComponent(chapter), {'json': true}, function (err, response, body) {
			if (!err) {
				locals.suggestions = body;

				locals.suggestions.sort(function(a,b){
					var aParam = a.id;
					var bParam = b.id;
					
					if (aParam.indexOf("_") > -1) {
						aParam = aParam.split("_")[1];
						if (aParam.length > 0) {
							aParam = parseInt(aParam);
						} else {
							aParam = a.id;
						}
					}

					if (bParam.indexOf("_") > -1) {
						bParam = bParam.split("_")[1];
						if (bParam.length > 0) {
							bParam = parseInt(bParam);
						} else {
							bParam = b.id;
						}
					}
					
					if(aParam < bParam) return -1;
					if(aParam > bParam) return 1;
					return 0;
				});

			}
				
			res.render('404.ejs', locals);

		});
		
	} else {
		res.render('404.ejs', locals);
	}

});
