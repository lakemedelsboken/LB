var cluster = require('cluster');
var path = require("path");
var fs = require("fs");
var wrench = require("wrench");
var async = require("async");
var crypto = require("crypto");
var request = require("request");
var zlib = require("zlib");
var chokidar = require("chokidar");
var uuid = require('node-uuid');
var spawn = require("child_process").spawn;
var dateFormat = require("dateformat");
var pdfCreator = require("./lib/prince/pdfcreator.js");


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

var redirect = require("express-redirect");

redirect(app);

var finishedSearches = {};
var searchIndex = null;
var searchIndices = [];
var chapterFileNames = null;
var indexCache = {};
var siteMap = null;

initFileWatchers();

var currentRedirects = [];

//Set a stamp in the router stack where future redirects should be inserted after
app.redirect("/thisisastamp", "/");
var indexAfterStamp = app._router.stack.length;

initRedirects();

function initRedirects() {
	console.log("Initializing redirects...");

	var possibleRedirectsListPath = path.normalize(path.join(__dirname, "..", "cms", "output", "published", "redirects.json"));

	if (fs.existsSync(possibleRedirectsListPath)) {

		var redirects = null;
		try {
			redirects = JSON.parse(fs.readFileSync(possibleRedirectsListPath, "utf8"));
		} catch (err) {
			redirects = null;
			console.error(err);
		}

		if (redirects !== null) {

			console.log("Found " + redirects.length + " redirects...")

			//Unregister current redirects
			if (currentRedirects.length > 0) {
				var routes = app._router.stack;
				for (var i = routes.length - 1; i >= 0; i--) {
					if (routes[i].route !== undefined && routes[i].route.path !== undefined) {
						var routePath = routes[i].route.path;

						var toBeRemoved = false;
						for (var j = currentRedirects.length - 1; j >= 0; j--) {
							if (currentRedirects[j].path === routePath) {
								toBeRemoved = true;
								break;
							}
						}

						if (toBeRemoved) {
							console.log("Unregistering old redirect: " + routePath);
							routes.splice(i, 1);
						}
					}
				}

				currentRedirects = [];
			}

			//Register new redirects
			for (var i = 0; i < redirects.length; i++) {
				var route = redirects[i];

				if (route.path !== undefined && route.target !== undefined) {

					console.log("Registering redirect: " + route.path + " to: " + route.target);
					if (route.type !== undefined) {
						//route.type = 301 for permanent etc... http://en.wikipedia.org/wiki/List_of_HTTP_status_codes#3xx_Redirection
						app.redirect(route.path, route.target, route.type);
					} else {
						//route.type = defaults to 307, temporary redirect
						app.redirect(route.path, route.target);
					}

					//Save new current redirects
					currentRedirects.push({path: route.path, target: route.target});
				}

			}

			//Now move all the new redirects to the top of the stack
			if (currentRedirects.length > 0) {
				var routes = app._router.stack;
				var stackToBeMoved = [];
				for (var i = routes.length - 1; i >= 0; i--) {
					if (routes[i].route !== undefined && routes[i].route.path !== undefined) {
						var routePath = routes[i].route.path;

						var toBeMoved = false;
						for (var j = currentRedirects.length - 1; j >= 0; j--) {
							if (currentRedirects[j].path === routePath) {
								toBeMoved = true;
								break;
							}
						}

						if (toBeMoved) {
							stackToBeMoved.unshift(routes.splice(i, 1)[0]);
						}
					}
				}

				if (stackToBeMoved.length > 0) {
					//Insert in router stack after stamp ala http://stackoverflow.com/questions/7032550/javascript-insert-an-array-inside-another-array

					routes.splice.apply(routes, [indexAfterStamp, 0].concat(stackToBeMoved));

					console.log("Moved " + stackToBeMoved.length + " after index " + indexAfterStamp + " in stack.");
				}

			}

		}

	}

}

function initFileWatchers() {

	var atcTreePath = path.normalize(__dirname + "/../../npl/atcTree.json");

	var atcTreeWatcher = chokidar.watch(atcTreePath, {persistent: true, ignoreInitial: true, interval: 20000, binaryInterval: 20000});

	atcTreeWatcher.on('error', function(error) {console.error('Error happened on atc file watch', error);})
	console.log("Watching " + atcTreePath + " for changes...");
	atcTreeWatcher.on('all', function(path, stats) {

		//TODO: Mail?

		setTimeout(function() {
			console.log("Reloading ATC tree.");
			atcTree = JSON.parse(fs.readFileSync(__dirname + "/../../npl/atcTree.json", "utf8"));
		}, 5000);

	});


	var redirectsPath = path.normalize(path.join(__dirname, "..", "cms", "output", "published", "redirects.json"));

	var redirectsWatcher = chokidar.watch(redirectsPath, {persistent: true, ignoreInitial: true, interval: 5000, binaryInterval: 5000});

	redirectsWatcher.on('error', function(error) {console.error('Error happened on redirects file watch', error);})
	console.log("Watching " + redirectsPath + " for changes...");
	redirectsWatcher.on('all', function(path, stats) {

		setTimeout(function() {
			console.log("Reloading redirects.");
			initRedirects();
		}, 4000);

	});

}

function clearCachedFileReads() {
	chapterFileNames = null;
	indexCache = {};
}

var staticSettingsPath = __dirname + "/../cms/output/static/settings.json";
var staticSettings = JSON.parse(fs.readFileSync(staticSettingsPath, "utf8"));

var chokidarOptions = {
	persistent: true,
	ignoreInitial: true
};

chokidar.watch(staticSettingsPath, chokidarOptions).on("all", function(event, path) {

	if (event === "change" || event === "add") {
		console.log("'settings.json' has changed, reloading in site/server.js");
		staticSettings = JSON.parse(fs.readFileSync(staticSettingsPath, "utf8"));
		locals.version = staticSettings.version;
	}

});

var locals = {
	title: 'Läkemedelsboken',
	description: '',
	author: '',
	version: staticSettings.version
};

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
	locals.results = undefined;

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
/*
app.get('/tree', function(req,res){

	var root = req.query["root"];

	if (root === "source") {
		root = "root";
	}

	var tree = getTreeChildren(root);

	res.json(tree);
});
*/
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

/*
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
*/

/*
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
*/

/*
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
*/
/*
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
*/
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

	//Sort ATC-codes by name
	childATCCodes.sort(function(a, b){
	    if(a.title < b.title) return -1;
	    if(a.title > b.title) return 1;
	    return 0;
	});

	for (var i = 0; i < childATCCodes.length; i++) {
		result.push({text: ((showATCCodes) ? childATCCodes[i].id + " " : "") + childATCCodes[i].title, id: childATCCodes[i].id, hasChildren: true});
	}

	//Sort products by name
	childProducts.sort(function(a, b){
	    if(a.title < b.title) return -1;
	    if(a.title > b.title) return 1;
	    return 0;
	});

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
			if (result[i].text === productTitle && result[i].type === "product") {
				product = result[i];
				break;
			}
		}

		if (product === null) {
			product = {text: productTitle, id: productTitle, children: [], type: "product"};
			result.push(product)
		}

		return product;
	}

}
/*
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
*/
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
		//nplId = nplId.replace(/\//g, "").replace(/\./g, "");
	}
	nplId = nplId.toLowerCase();
	if((nplId.indexOf(".") > -1)) {
		res.sendFile(nplId, {root: __dirname + "../../../npl/content-providers/static-spc-documents/"}, function(err) {
			if (err) {
      			console.log(err);
      			res.status(err.status).end();
    		} else {
      		console.log('Sent:', nplId);
    		}

		});
		return;
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

/*
 http://www.riksdagen.se/sv/Dokument-Lagar/Lagar/Svenskforfattningssamling/Lag-2010566-om-vidareutnytt_sfs-2010-566/
*/
app.get("/psidata", function(req, res){
	res.redirect(301, "/api/");
});

app.get("/pdf/download", function(req, res) {
	console.log("download from server.js");
	var url = req.query["url"];

	if (url !== undefined && url !== "") {

		if (url.indexOf('.json') !== -1 ) {
			url = url.replace('.json', '.html');
		}

		pdfCreator.createFromUrl(url, req.cookies, function(err, result) {
			if (err) {
				console.log(err);
				res.status(500);
				res.render('error', {
					message: 'Child process exited with err: ' + err.message,
					error: err
				});
			} else {
				if (result.name !== undefined && result.name !== "" && result.path !== undefined && result.path !== "") {
					console.log("result.name = "+result.name);
					console.log("result.path = "+result.path);
					res.download(result.path, result.name);
				} else {
					res.status(500);
					res.render("error", {
						message: "Result was malformed after creating the PDF.",
						error: new Error("Result was malformed after creating the PDF.")
					});
				}
			}
		});

	}
});

/*app.get("/pdf/download_old", function(req, res) {
	var url = req.query["url"];

	if (url !== undefined && url !== "") {

		if (url.indexOf('.json') !== -1 ) {
			url = url.replace('.json', '.html');
		}

		var outPath = path.join(require("os").tmpdir(), uuid.v1() + ".pdf");

		var date = new Date();
		var fileNameDate = dateFormat(date, "yyyy-mm-dd--HH-MM-ss");

		var newFileName = path.basename(url, ".html") + "-" + fileNameDate + ".pdf";

		var cookies = [];
//"--disable-smart-shrinking", "--zoom", "0.6", "--dpi", "240",
		var arguments = ["--print-media-type",  "-n", "--no-background"];

		arguments = arguments.concat(["--footer-font-size", 8]);
		arguments = arguments.concat(["--header-font-size", 8]);
		arguments = arguments.concat(["--footer-font-name", "Courier"]);
		arguments = arguments.concat(["--header-font-name", "Courier"]);
		arguments = arguments.concat(["--margin-left", "20mm"]);
		arguments = arguments.concat(["--margin-right", "20mm"]);

		arguments.push("http://localhost" + url)
		arguments.push(outPath);

		var hasExited = false;
		var converter = spawn('wkhtmltopdf', arguments);

		converter.stdout.on('data', function (data) {
			console.log('stdout: ' + data);
		});

		converter.stderr.on('data', function (data) {
			console.log('stderr: ' + data);
		});

		converter.on('close', function (code) {
			if (code !== 0) {
				console.log('Child process exited with code ' + code);
				hasExited = true;

				res.status(500);
				var err = new Error('Child process exited with code ' + code);
				res.render('error', {
					message: err.message,
					error: err
				});

			} else if (!hasExited) {
				hasExited = true;

				//Everything is ok
				res.download(outPath, newFileName);

			}
		});

		converter.on('error', function (err) {

			console.log('Child process exited with err ', err);

			if (!hasExited) {
				hasExited = true;
				res.status(500);
				res.render('error', {
					message: 'Child process exited with err: ' + err.message,
					error: err
				});
			}
		});

	} else {
		res.redirect("back");
	}

});*/

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
