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
var searchIndexer = require("../../search/createSearchIndex.js");
var Fuse = require("./lib/fuse.js");

var settings = JSON.parse(fs.readFileSync(__dirname + "/../../settings/settings.json", "utf8"));

var networkPort = settings.internalServerPorts.site;

var numCPUs = (require('os').cpus().length);

if (numCPUs < 2) {
	numCPUs = 2;
}

var app = require('./app').init(networkPort);

var finishedSearches = {};
var searchIndex = null;
var searchIndices = [];
var chapterFileNames = null;
var indexCache = {};

var workerFarm = null;
var contentSearchers = null;
var titleSearchers = null;
var boxSearchers = null;
var medicineSearchers = null;

initSearchIndex();
initFileWatchers();

//TODO: Switch to polling
function initFileWatchers() {
	
	var chaptersPath = path.normalize(__dirname + "/chapters/");
	//var staticPath = path.normalize(__dirname + "/static/");
	var atcTreePath = path.normalize(__dirname + "/../../npl/atcTree.json");
	var searchesPath = path.normalize(__dirname + "/../../search/");
	
	var chaptersWatcher = chokidar.watch(chaptersPath, {ignored: /^\./, persistent: true, ignoreInitial: true, interval: 20000, binaryInterval: 20000});
	//var staticWatcher = chokidar.watch(chaptersPath, {ignored: /^\./, persistent: true, ignoreInitial: true, interval: 20000, binaryInterval: 20000});
	var atcTreeWatcher = chokidar.watch(atcTreePath, {persistent: true, ignoreInitial: true, interval: 20000, binaryInterval: 20000});
	var searchWatcher = chokidar.watch(searchesPath, {ignored: /^\./, persistent: false, ignoreInitial: true, interval: 1000, binaryInterval: 2000});



	searchWatcher.on('error', function(error) {console.error('Error happened on search file watch', error);})
	searchWatcher.on('add', function(path) {
		if (path.indexOf(".json.gz") > -1) {
			//console.log('File', path, 'has been added');
			finishedSearches[path] = true;
			
		}
	});

	chaptersWatcher.on('error', function(error) {console.error('Error happened on chapters file watch', error);})
	console.log("Watching " + chaptersPath + " for changes...");

	chaptersWatcher.on('all', function(path, stats) {

		console.log("Clearing cached file reads.");
		clearCachedFileReads();

		console.log("Reinitializing search index.");
		initSearchIndex();

	});

	atcTreeWatcher.on('error', function(error) {console.error('Error happened on atc file watch', error);})
	console.log("Watching " + atcTreePath + " for changes...");
	atcTreeWatcher.on('all', function(path, stats) {

		//TODO: Mail?

		console.log("Reloading ATC tree.");
		atcTree = JSON.parse(fs.readFileSync(__dirname + "/../../npl/atcTree.json", "utf8"));

		console.log("Reinitializing search index.");
		initSearchIndex();

	});

}

function clearCachedFileReads() {
	chapterFileNames = null;
	indexCache = {};
}

var locals = {
	title: 		 'Läkemedelsboken',
	description: '',
	author: 	 ''
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
		locals.results = {titlesearch: [], medicinesearch: [], contentsearch: []};
		res.render('search.ejs', locals);
		
	} else {

		async.parallel({
			titlesearch: function(callback) {
				request('http://127.0.0.1:' + networkPort + '/titlesearch?search=' + encodeURIComponent(terms), {'json': true, 'auth': {'user': secretSettings.admin.basicAuthId,'pass': secretSettings.admin.basicAuthPassword,'sendImmediately': false}}, function (err, response, body) {

					if (err) {
						callback(err)
					} else {
						callback(null, body);
					}
				});
			},
			contentsearch: function(callback) {
				request('http://127.0.0.1:' + networkPort + '/contentsearch?search=' + encodeURIComponent(terms), {'json': true, 'auth': {'user': secretSettings.admin.basicAuthId,'pass': secretSettings.admin.basicAuthPassword,'sendImmediately': false}}, function (err, response, body) {

					if (err) {
						callback(err)
					} else {
						callback(null, body);
					}
				});
			},
			medicinesearch: function(callback) {
				request('http://127.0.0.1:' + networkPort + '/medicinesearch?search=' + encodeURIComponent(terms), {'json': true, 'auth': {'user': secretSettings.admin.basicAuthId,'pass': secretSettings.admin.basicAuthPassword,'sendImmediately': false}}, function (err, response, body) {

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
		locals.results = {titlesearch: [], medicinesearch: [], contentsearch: []};
		res.render('search.ejs', locals);
		
	} else {

		async.parallel({
			titlesearch: function(callback) {
				request('http://127.0.0.1:' + networkPort + '/titlesearch?search=' + encodeURIComponent(terms), {'json': true, 'auth': {'user': secretSettings.admin.basicAuthId,'pass': secretSettings.admin.basicAuthPassword,'sendImmediately': false}}, function (err, response, body) {

					if (err) {
						callback(err)
					} else {
						callback(null, body);
					}
				});
			},
			contentsearch: function(callback) {
				request('http://127.0.0.1:' + networkPort + '/contentsearch?search=' + encodeURIComponent(terms), {'json': true, 'auth': {'user': secretSettings.admin.basicAuthId,'pass': secretSettings.admin.basicAuthPassword,'sendImmediately': false}}, function (err, response, body) {

					if (err) {
						callback(err)
					} else {
						callback(null, body);
					}
				});
			},
			medicinesearch: function(callback) {
				request('http://127.0.0.1:' + networkPort + '/medicinesearch?search=' + encodeURIComponent(terms), {'json': true, 'auth': {'user': secretSettings.admin.basicAuthId,'pass': secretSettings.admin.basicAuthPassword,'sendImmediately': false}}, function (err, response, body) {

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
					children.push(index[i]);
				}
			}
			res.json(children);
		}
	}

});

function getSiteMap(callback) {
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
	
			var sitemap = header + content + footer;

			callback(null, sitemap);
			
		}
		
	});

	
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

function createCheckSum(data) {
	var checksum = crypto.createHash("sha1");
	checksum.update(data);
	return checksum.digest("hex");
}

function controlSearchChecksums(searchDir, checksum) {
	var prepopSearchesNr = 0;
	var searchChecksumPath = path.normalize(searchDir + "/indexchecksum.txt");
	var checksumsMatch = false;
	if (fs.existsSync(searchChecksumPath)) {
		var oldCheckSum = fs.readFileSync(searchChecksumPath, "utf8");
		//console.error("Checking if \"" + oldCheckSum + "\" == \"" + checksum + "\"");
		checksumsMatch = (oldCheckSum === checksum);
	}
	
	if (!checksumsMatch) {
		var files = fs.readdirSync(searchDir);
		for (var i=0; i < files.length; i++) {
			if (files[i].indexOf(".json") > -1) {
				prepopSearchesNr++;
				if (fs.existsSync(searchDir + files[i])) {
					fs.unlinkSync(searchDir + files[i]);
				}
			}
		}
	} else {
		console.log("Prepopulated search checksums match in dir: " + searchDir + ", not clearing searches.")
	}

	if (prepopSearchesNr > 0) {
		console.log(prepopSearchesNr + " prepopulated searches were cleared in dir: " + searchDir);
	}

	//Set current search index checksum for searches
	fs.writeFileSync(searchChecksumPath, checksum, "utf8");
	
}

var isInitializingSearchIndex = false;

function initSearchIndex() {

	if (isInitializingSearchIndex) {
		return;
	}

	isInitializingSearchIndex = true;

	//Cleanup
	if (workerFarm !== null) {
		workerFarm.end(titleSearchers);
		workerFarm.end(contentSearchers);
		workerFarm.end(boxSearchers);
		workerFarm.end(medicineSearchers);
	}

	if (workerFarm === null) {
		workerFarm = require("worker-farm");
	}
	
	searchIndex = [];
	searchIndices = [];

	//Iterate and add all search indexes
	var previewFolders = fs.readdirSync(__dirname + "/chapters/");
	for (var i=0; i < previewFolders.length; i++) {
		if (previewFolders[i].indexOf("_index") > -1) {
			var index = JSON.parse(fs.readFileSync(__dirname + "/chapters/" + previewFolders[i] + "/" + previewFolders[i].replace("_index", ".json")));
			searchIndex = searchIndex.concat(index);
			searchIndices.push(previewFolders[i]);
		}
	}

	console.log("Book search index is populated with " + searchIndex.length + " items.");
	console.log("Medicine search index is populated with " + atcTree.length + " items.");

	//Create checksum for search index
	var indexChecksum = createCheckSum(JSON.stringify(searchIndex));
	var medicineIndexChecksum = createCheckSum(JSON.stringify(atcTree));

	titleSearchers = workerFarm({maxConcurrentWorkers: 2}, require.resolve("./workers/titlesearcher"));
	contentSearchers = workerFarm({maxConcurrentWorkers: 4}, require.resolve("./workers/contentsearcher"));
	boxSearchers = workerFarm({maxConcurrentWorkers: 2}, require.resolve("./workers/boxsearcher"));
	medicineSearchers = workerFarm({maxConcurrentWorkers: 4}, require.resolve("./workers/medicinesearcher"));

	//Clear prepopulated searches if checksums do not match 
	controlSearchChecksums(path.normalize(__dirname + "/../../search/titlesearches/"), indexChecksum);
	controlSearchChecksums(path.normalize(__dirname + "/../../search/contentsearches/"), indexChecksum);
	controlSearchChecksums(path.normalize(__dirname + "/../../search/boxsearches/"), indexChecksum);
	controlSearchChecksums(path.normalize(__dirname + "/../../search/medicinesearches/"), medicineIndexChecksum);

	
	populateFinishedSearches(path.normalize(__dirname + "/../../search/titlesearches/"));
	populateFinishedSearches(path.normalize(__dirname + "/../../search/contentsearches/"));
	populateFinishedSearches(path.normalize(__dirname + "/../../search/boxsearches/"));
	populateFinishedSearches(path.normalize(__dirname + "/../../search/medicinesearches/"));

	isInitializingSearchIndex = false;
}

function populateFinishedSearches(searchDir) {
	var files = fs.readdirSync(searchDir);
	for (var i = 0; i < files.length; i++) {
		if (files[i].indexOf(".json.gz") > -1) {
			finishedSearches[searchDir + files[i]] = true;
		}
	}
}

function getResultsThatMatchAllTerms(searchResults) {
	
	var numberOfSearchResults = Object.keys(searchResults).length;

	//Check which array is the shortest one
	var shortestResultsKey = null;
	for (var key in searchResults) {
		if (shortestResultsKey === null) {
			shortestResultsKey = key;
		} else {
			if (searchResults[key].length < searchResults[shortestResultsKey].length) {
				shortestResultsKey = key;
			}
		}
	}
	
	//Create objects for the other arrays with id as key
	var compareToSearchResults = [];
	for (var key in searchResults) {
		if (key !== shortestResultsKey) {
			var resultObject = {};
			var resultArray = searchResults[key];
			for (var i=0; i < resultArray.length; i++) {
				resultObject[resultArray[i].id] = resultArray[i].score;
			}
			compareToSearchResults.push(resultObject);
		}
	}

	var crossMatches = {};
	//Check cross matches
	var shortestArray = searchResults[shortestResultsKey];
	for (var i=0; i < shortestArray.length; i++) {
		var idToMatch = shortestArray[i].id;
		for (var j=0; j < compareToSearchResults.length; j++) {
			if (compareToSearchResults[j][idToMatch] !== undefined) {
				//A match
				if (crossMatches[idToMatch] === undefined) {
					crossMatches[idToMatch] = {item: shortestArray[i], count: 2, score: (shortestArray[i].score + compareToSearchResults[j][idToMatch])};
				} else {
					crossMatches[idToMatch].count++;
					crossMatches[idToMatch].score += compareToSearchResults[j][idToMatch];
				}
			}
		}
	}


	var resultsWithScores = [];
	var results = [];
	
	//Only keep the ones that match all terms
	for (var id in crossMatches) {
		if (crossMatches.hasOwnProperty(id) && (crossMatches[id].count >= numberOfSearchResults)) {
			resultsWithScores.push({item: crossMatches[id].item, score: crossMatches[id].score});
		}
	}

	//Sort on lowest score
	resultsWithScores.sort(function (a, b) {
		return a.score - b.score;
	});

	//Return only the items
	for (var i = 0; i < resultsWithScores.length; i++) {
		results.push(resultsWithScores[i].item);
	}	
	
	return results;
}

app.get('/medicinesearch', function(req,res){

	var searchTerms = req.query["search"].trim().toLowerCase().replace(/\s+/g, " ");

	var startDate = new Date().getTime();
	var start = {time: startDate, terms: searchTerms};

	var searchLimit = req.query["limit"];

	//Implement limit
	var limit = true;
	if (searchLimit !== undefined) {
		limit = false;
	}

	var results = [];
	
	var resultsLimit = 40;
	
	//Find already finished search for the same terms
	var safeTerms = getSafeSearchTerms(searchTerms);
	var possibleMedicineSearchFileName = path.normalize(__dirname + "/../../search/medicinesearches/" + safeTerms + ".json.gz");

	if (finishedSearches[possibleMedicineSearchFileName] !== undefined) {

		fs.readFile(possibleMedicineSearchFileName, function(err, data) {
			if (err) {
				fs.unlinkSync(possibleMedicineSearchFileName);
				res.json([]);
				console.error("err");
			} else {
				zlib.unzip(data, function(err, buffer) {
					if (!err) {
						var errorParsingJSON = false;
						try {
							results = JSON.parse(buffer.toString());
						} catch (err) {
							console.error(err);
							errorParsingJSON = true;
						}


						if (!errorParsingJSON) {
							if (limit && results.length > resultsLimit) {
								results.length = resultsLimit;
							}

							//Exit 1
							res.json(results);

							var endDate = new Date().getTime();
							console.log(start.terms + " finished in " + (endDate - start.time) + ", fetched from finished search.");
						} else {

							fs.unlinkSync(possibleMedicineSearchFileName);

							res.json([]);

							var endDate = new Date().getTime();
							console.log(start.terms + " finished in " + (endDate - start.time) + ", generated an error when trying to parse the file " + possibleMedicineSearchFileName);
							
						}

					} else {
						res.json([]);
						console.error("err");
					}
				});
			}
		});
	} else {

		searchTerms = parseSearchTerms(searchTerms, !limit);
		
		if (searchIndex === null) {
			initSearchIndex();
		}

		var searchResults = {};

		//Perform the actual searching

		if (searchTerms.length === 1) {
			//Main search for one word
			var term = searchTerms[0];

			if (term.length > 32) {
				term = term.substr(0, 32);
			}

			var allSearchResults = [];
			var count = 0;
			
			//Distribute search to 8 search workers
			//console.time("search");
			for (var i = 0; i < 8; i++) {
				//console.time("start");
				medicineSearchers({index: i, term: term}, function(err, data) {

					//console.timeEnd("start");

					if (err) {
						console.error(err);
					}

					allSearchResults.push(data);
					count++;
					if (count === 8) {
						//console.timeEnd("search");

						//Done searching, continue
						var merged = [];
						merged = merged.concat.apply(merged, allSearchResults);
						
						//Sort according to score
						merged.sort(function(a, b) {
							return a.score - b.score;
						});

						searchResults[0] = merged;
						
						//console.time("filter 1");
						results = filterAndSaveSearchResults(searchTerms, searchResults, possibleMedicineSearchFileName);
						//console.timeEnd("filter 1");

						if (limit && results.length > resultsLimit) {
							results.length = resultsLimit;
						}

						var endDate = new Date().getTime();
						console.log(start.terms + " finished in " + (endDate - start.time));

						//Normal exit
						res.json(results);
					}
				});
			}
			
			
		} else if (searchTerms.length > 1){
			//Multiple words, perform searches in parallel

			//Limit to 6 words
			if (searchTerms.length > 6) {
				searchTerms.length = 6;
			}

			//Create queue
			var searchQueue = async.queue(function (task, callback) {
				request("http://127.0.0.1:" + networkPort + "/medicinesearch?search=" + encodeURIComponent(task.term) + "&limit=off", {'auth': {'user': secretSettings.admin.basicAuthId,'pass': secretSettings.admin.basicAuthPassword,'sendImmediately': true}}, function (error, response, body) {
					var requestResult = [];
					if (!error && response.statusCode == 200) {
						requestResult = JSON.parse(body);
					} else if (error) {
						console.log(error);
					} else {
						console.log("Status code: " + response.statusCode);
					}
					callback(null, task.index, requestResult);
				});
			}, (numCPUs - 1));

			//When all the searches have finished
			searchQueue.drain = function() {
				//Finished with async search
				//console.time("filter 2");
				results = filterAndSaveSearchResults(searchTerms, searchResults, possibleMedicineSearchFileName);
				//console.timeEnd("filter 2");

				if (limit && results.length > resultsLimit) {
					results.length = resultsLimit;
				}

				//Async exit
				res.json(results);
				var endDate = new Date().getTime();
				console.log(start.terms + " finished in " + (endDate - start.time) + ", multiple terms search.");

			}

			//Iterate terms and add to queue
			for (var i=0; i < searchTerms.length; i++) {
				var term = searchTerms[i];

				if (term.length > 32) {
					term = term.substr(0, 32);
				}
				
				//Add item to the queue
				searchQueue.push({index: i, term: term}, function (err, index, result) {
					//Callback when a request has finished
					if (err) {
						console.log(err);
					} else {
						//Add result to master object
						searchResults[index] = result;
					}
				});
			}

		} else {
			//Exit, empty
			res.json([]);

			var endDate = new Date().getTime();
			//console.log(start.terms + " finished in " + (endDate - start.time) + ", no terms.");
		}

	}


});

app.get('/titlesearch', function(req,res){

	var searchTerms = req.query["search"].trim().toLowerCase().replace(/\s+/g, " ");

	var searchLimit = req.query["limit"];

	//Implement limit
	var limit = true;
	if (searchLimit !== undefined) {
		limit = false;
	}

	var results = [];
	
	var resultsLimit = 40;
	
	//Find already finished search for the same terms
	var safeTerms = getSafeSearchTerms(searchTerms);
	var possibleSearchFileName = path.normalize(__dirname + "/../../search/titlesearches/" + safeTerms + ".json.gz");

//	fs.exists(possibleSearchFileName, function(fileExists) {
		if (finishedSearches[possibleSearchFileName] !== undefined) {
			fs.readFile(possibleSearchFileName, function(err, data) {
				zlib.unzip(data, function(err, buffer) {
					if (!err) {
						
						results = JSON.parse(buffer.toString());

						if (limit && results.length > resultsLimit) {
							results.length = resultsLimit;
						}

						//Exit 1
						res.json(results);

					} else {
						res.json([]);
						console.error(err);
					}
				});
			});
		} else {

			searchTerms = parseSearchTerms(searchTerms, !limit);
			
			if (searchIndex === null) {
				initSearchIndex();
			}

			var searchResults = {};

			//Perform the actual searching

			if (searchTerms.length === 1) {
				//Main search for one word
				var term = searchTerms[0];

				if (term.length > 32) {
					term = term.substr(0, 32);
				}

				var allSearchResults = [];
				var count = 0;
			
				//Distribute search to search workers
				for (var i = 0; i < searchIndices.length; i++) {
					titleSearchers({index: searchIndices[i], term: term}, function(err, data) {
						allSearchResults.push(data);
						count++
						if (count === searchIndices.length) {
							//Done searching, continue
							var merged = [];
							merged = merged.concat.apply(merged, allSearchResults);
						
							//Sort according to score
							merged.sort(function(a, b) {
								return a.score - b.score;
							});

							searchResults[0] = merged;

							results = filterAndSaveSearchResults(searchTerms, searchResults, possibleSearchFileName);

							if (limit && results.length > resultsLimit) {
								results.length = resultsLimit;
							}

							//Normal exit
							res.json(results);
						}
					});
				}
			
			} else if (searchTerms.length > 1){
				//Multiple words, perform searches in parallel

				//Limit to 6 words
				if (searchTerms.length > 6) {
					searchTerms.length = 6;
				}

				//Create queue
				var titleQueue = async.queue(function (task, callback) {
					request("http://127.0.0.1:" + networkPort + "/titlesearch?search=" + encodeURIComponent(task.term) + "&limit=off", {'auth': {'user': secretSettings.admin.basicAuthId,'pass': secretSettings.admin.basicAuthPassword,'sendImmediately': true}}, function (error, response, body) {
						var requestResult = [];
						if (!error && response.statusCode == 200) {
							requestResult = JSON.parse(body);
						} else if (error) {
							console.log(error);
						} else {
							console.log("Status code: " + response.statusCode);
						}
						callback(null, task.index, requestResult);
					});
				}, (numCPUs - 1));

				//When all the searches have finished
				titleQueue.drain = function() {
					//Finished with async search
					results = filterAndSaveSearchResults(searchTerms, searchResults, possibleSearchFileName);

					if (limit && results.length > resultsLimit) {
						results.length = resultsLimit;
					}

					//Async exit
					res.json(results);
				}

				//Iterate terms and add to queue
				for (var i=0; i < searchTerms.length; i++) {
					var term = searchTerms[i];

					if (term.length > 32) {
						term = term.substr(0, 32);
					}
				
					//Add item to the queue
					titleQueue.push({index: i, term: term}, function (err, index, result) {
						//Callback when a request has finished
						if (err) {
							console.log(err);
						} else {
							//Add result to master object
							searchResults[index] = result;
						}
					});
				}

			} else {
				//Exit, empty
				res.json([]);
			}

		}
			
//	});


});


app.get('/contentsearch', function(req,res){

	var searchTerms = req.query["search"].trim().toLowerCase().replace(/\s+/g, " ");

	var searchLimit = req.query["limit"];

	//Implement limit
	var limit = true;
	if (searchLimit !== undefined) {
		limit = false;
	}

	var results = [];
	
	var resultsLimit = 40;
	
	//Find already finished search for the same terms
	var safeTerms = getSafeSearchTerms(searchTerms);
	var possibleSearchFileName = path.normalize(__dirname + "/../../search/contentsearches/" + safeTerms + ".json.gz");

	if (finishedSearches[possibleSearchFileName] !== undefined) {

		fs.readFile(possibleSearchFileName, function(err, data) {
			zlib.unzip(data, function(err, buffer) {
				if (!err) {
					results = JSON.parse(buffer.toString());

					if (limit && results.length > resultsLimit) {
						results.length = resultsLimit;
					}

					//Exit 1
					res.json(results);

				} else {
					res.json([]);
					console.error("err");
				}
			});
		});
	} else {

		searchTerms = parseSearchTerms(searchTerms, !limit);
		
		if (searchIndex === null) {
			initSearchIndex();
		}

		var searchResults = {};

		//Perform the actual searching
		if (searchTerms.length === 1) {
			//Main search for one word
			var term = searchTerms[0];

			if (term.length > 32) {
				term = term.substr(0, 32);
			}

			var allSearchResults = [];
			var count = 0;
			
			//Distribute search to search workers
			for (var i = 0; i < searchIndices.length; i++) {
				contentSearchers({index: searchIndices[i], term: term}, function(err, data) {
					allSearchResults.push(data);
					count++;
					if (count === searchIndices.length) {
						//Done searching, continue
						var merged = [];
						merged = merged.concat.apply(merged, allSearchResults);
						
						//Sort according to score
						merged.sort(function(a, b) {
							return a.score - b.score;
						});

						searchResults[0] = merged;

						results = filterAndSaveSearchResults(searchTerms, searchResults, possibleSearchFileName);

						if (limit && results.length > resultsLimit) {
							results.length = resultsLimit;
						}

						//Normal exit
						res.json(results);
					}
				});
			}
		} else if (searchTerms.length > 1){
			//Multiple words, perform searches in parallel

			//Limit to 6 words
			if (searchTerms.length > 6) {
				searchTerms.length = 6;
			}

			//Create queue
			var contentQueue = async.queue(function (task, callback) {
				request("http://127.0.0.1:" + networkPort + "/contentsearch?search=" + encodeURIComponent(task.term) + "&limit=off", {'auth': {'user': secretSettings.admin.basicAuthId,'pass': secretSettings.admin.basicAuthPassword,'sendImmediately': true}}, function (error, response, body) {
					var requestResult = [];
					if (!error && response.statusCode == 200) {
						requestResult = JSON.parse(body);
					} else if (error) {
						console.log(error);
					} else {
						console.log("Status code: " + response.statusCode);
					}
					callback(null, task.index, requestResult);
				});
			}, (numCPUs - 1));

			//When all the searches have finished
			contentQueue.drain = function() {
				//Finished with async search
								
				results = filterAndSaveSearchResults(searchTerms, searchResults, possibleSearchFileName);

				if (limit && results.length > resultsLimit) {
					results.length = resultsLimit;
				}

				//Async exit
				res.json(results);
			}

			//Iterate terms and add to queue
			for (var i=0; i < searchTerms.length; i++) {
				var term = searchTerms[i];

				if (term.length > 32) {
					term = term.substr(0, 32);
				}
				
				//Add item to the queue
				contentQueue.push({index: i, term: term}, function (err, index, result) {
					//Callback when a request has finished
					if (err) {
						console.log(err);
					} else {
						//Add result to master object
						searchResults[index] = result;
					}
				});
			}

		} else {
			//Exit, empty
			res.json([]);
		}

	}


});

app.get('/boxsearch', function(req,res){

	var searchTerms = req.query["search"].trim().toLowerCase().replace(/\s+/g, " ");

	var searchLimit = req.query["limit"];

	//Implement limit
	var limit = true;
	if (searchLimit !== undefined) {
		limit = false;
	}

	var results = [];
	
	var resultsLimit = 40;
	
	//Find already finished search for the same terms
	var safeTerms = getSafeSearchTerms(searchTerms);
	var possibleSearchFileName = path.normalize(__dirname + "/../../search/boxsearches/" + safeTerms + ".json.gz");

	if (finishedSearches[possibleSearchFileName] !== undefined) {

		fs.readFile(possibleSearchFileName, function(err, data) {
			zlib.unzip(data, function(err, buffer) {
				if (!err) {
					results = JSON.parse(buffer.toString());

					if (limit && results.length > resultsLimit) {
						results.length = resultsLimit;
					}

					//Exit 1
					res.json(results);

				} else {
					res.json([]);
					console.error("err");
				}
			});
		});
	} else {

		searchTerms = parseSearchTerms(searchTerms, !limit);
		
		if (searchIndex === null) {
			initSearchIndex();
		}

		var searchResults = {};

		//Perform the actual searching

		if (searchTerms.length === 1) {
			//Main search for one word
			var term = searchTerms[0];

			if (term.length > 32) {
				term = term.substr(0, 32);
			}

			var allSearchResults = [];
			var count = 0;
			
			//Distribute search to search workers
			for (var i = 0; i < searchIndices.length; i++) {
				boxSearchers({index: searchIndices[i], term: term}, function(err, data) {
					allSearchResults.push(data);
					count++;
					if (count === searchIndices.length) {
						//Done searching, continue
						var merged = [];
						merged = merged.concat.apply(merged, allSearchResults);
						
						//Sort according to score
						merged.sort(function(a, b) {
							return a.score - b.score;
						});

						searchResults[0] = merged;

						results = filterAndSaveSearchResults(searchTerms, searchResults, possibleSearchFileName);

						if (limit && results.length > resultsLimit) {
							results.length = resultsLimit;
						}

						//Normal exit
						res.json(results);
					}
				});
			}
			
		} else if (searchTerms.length > 1){
			//Multiple words, perform searches in parallel

			//Limit to 6 words
			if (searchTerms.length > 6) {
				searchTerms.length = 6;
			}

			//Create queue
			var therapyQueue = async.queue(function (task, callback) {
				request("http://127.0.0.1:" + networkPort + "/boxsearch?search=" + encodeURIComponent(task.term) + "&limit=off", {'auth': {'user': secretSettings.admin.basicAuthId,'pass': secretSettings.admin.basicAuthPassword,'sendImmediately': true}}, function (error, response, body) {
					var requestResult = [];
					if (!error && response.statusCode == 200) {
						requestResult = JSON.parse(body);
					} else if (error) {
						console.log(error);
					} else {
						console.log("Status code: " + response.statusCode);
					}
					callback(null, task.index, requestResult);
				});
			}, (numCPUs - 1));

			//When all the searches have finished
			therapyQueue.drain = function() {
				//Finished with async search
				results = filterAndSaveSearchResults(searchTerms, searchResults, possibleSearchFileName);

				if (limit && results.length > resultsLimit) {
					results.length = resultsLimit;
				}

				//Async exit
				res.json(results);
			}

			//Iterate terms and add to queue
			for (var i=0; i < searchTerms.length; i++) {
				var term = searchTerms[i];

				if (term.length > 32) {
					term = term.substr(0, 32);
				}
				
				//Add item to the queue
				therapyQueue.push({index: i, term: term}, function (err, index, result) {
					//Callback when a request has finished
					if (err) {
						console.log(err);
					} else {
						//Add result to master object
						searchResults[index] = result;
					}
				});
			}

		} else {
			//Exit, empty
			res.json([]);
		}

	}

});

function filterAndSaveSearchResults(searchTerms, searchResults, fileName) {

	var results = [];

	if (searchTerms.length > 1) {
		results = getResultsThatMatchAllTerms(searchResults);
		
		//If none matched, return the results for the first term
		//TODO: Improve this
		//if (results.length === 0) {
		//	results = searchResults[0];
		//}
	} else {
		results = searchResults[0];
	}

	//Remove duplicates
	results = removeDuplicates(results);

	//If this is a medicine search
	if (results.length > 0 && results[0].indications !== undefined) {

		var removedItems = [];
		//Send medicines with no info to the bottom of the list
		for (var k = results.length - 1; k >= 0; k--) {
			if (results[k].noinfo === true) {
				removedItems = removedItems.concat(results.splice(k, 1));
			}
		}

		if (removedItems.length > 0) {
			results = results.concat(removedItems);
		}

		//Create copy of array
		var trimmed = JSON.parse(JSON.stringify(results));

		//Remove indications blob before returning or saving
		for (var i = trimmed.length - 1; i >= 0; i--){
			trimmed[i].indications = "";
		}

		results = trimmed;
		
	} else if (results.length > 0 && results[0].content !== undefined) {
		//Remove content blob
		var trimmed = JSON.parse(JSON.stringify(results));

		for (var i = trimmed.length - 1; i >= 0; i--){
			trimmed[i].content = "";
			trimmed[i].products = "";
		}

		results = trimmed;
		
	}

	//Compress and save to file, async
	zlib.deflate(JSON.stringify(results), function(err, buffer) {
		if (!err) {

			fs.writeFile(fileName, buffer, function(err) {
				if (err) {
					console.error(err);
				}
				finishedSearches[fileName] = true;
			});

		} else {
			console.error(err);
		}
	});

	return results;
}


function removeDuplicates(items) {
	var usedIds = {};
	var results = [];
	
	for (var i = 0; i < items.length; i++) {
		if (usedIds[items[i].id] === undefined) {
			results.push(items[i]);
			usedIds[items[i].id] = true;
		}
	}
	
	return results;
}

function getSafeSearchTerms(terms) {
	return createCheckSum(terms);
}

function parseSearchTerms(terms, skipSplit) {

	if (skipSplit === undefined) {
		skipSplit = false;
	}

	var result = [];
	var groups = [];

	//Find encapsulated terms
	if (terms.indexOf("\"") > -1) {

		//console.log("Incoming: " + terms);

		//Find all "
		var groupLocations = [];
		for (var i = 0; i < terms.length; i++) {
			if (terms[i] === "\"") {
				groupLocations.push(i);
			}
		}
		
		//Clear strays
		if (groupLocations.length === 1 || (groupLocations.length % 2) !== 0) {
			terms = terms.split("");
			terms.splice(groupLocations[groupLocations.length - 1], 1);
			groupLocations.pop();
			terms = terms.join("");
		}
		
		//console.log("Cleared strays: " + terms);
		//console.log("Group locations: ", groupLocations);

		//Start grouping into ""
		if (groupLocations.length > 1) {
			for (var i = groupLocations.length - 1; i >= 0; i = i - 2) {
				var start = groupLocations[i - 1];
				var stop = groupLocations[i];
				var term = terms.substr(start + 1, (stop - start - 1));
				groups.push(term);
				//Remove from terms
				terms = terms.split("");
				terms.splice(start, stop - start + 1);
				terms = terms.join("");
				
				//console.log("Singled out: " + term);
				//console.log("Removed from terms: " + terms);
			}
		}

	}

	if (!skipSplit && terms.indexOf(" ") > -1) {
		result = terms.split(" ");
	} else {
		result = [terms];
	}
	
	if (groups.length > 0) {
		result = result.concat(groups);
	}
	
	//Clear empty terms
	for (var i = result.length - 1; i >= 0; i--) {
		if (result[i].trim() === "") {
			result.splice(i, 1);
		}
	}
	
	//console.log("Finished terms: ", result);
	
	return result;
}

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
		
		var images = (childProducts[i].images !== undefined) ? childProducts[i].images : false;


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
					locals.product = product
					res.render("product.ejs", locals);
				});
			} else {
				console.log("File does not exist.")
				locals.product = product;
				res.render("product.ejs", locals);
			}
		});
	} else {
		locals.product = product;
		res.render("product.ejs", locals);
	}
});

/*
app.get('/atc', function(req, res) {

	//locals.date = new Date().toLocaleDateString();

	var query = req.query["query"];
	var results = [];
	var maxResults = 200;
	if (query !== undefined && query.length > 1) {

		query = query.toLowerCase();

		for (var i=0; i < atcTree.length; i++) {

			if (atcTree[i].type === "atc" && (atcTree[i].title.toLowerCase().indexOf(query) > -1 || atcTree[i].id.toLowerCase().indexOf(query) > -1)) {
				if (atcTree[i].title.toLowerCase() === query) {
					results.unshift(atcTree[i].id + " " + atcTree[i].title);
				} else {
					results.push(atcTree[i].id + " " + atcTree[i].title);
				}
				if (results.length >= maxResults) {
					break;
				}
			}

			if (atcTree[i].type !== "atc" && atcTree[i].title !== undefined && (atcTree[i].title.toLowerCase().indexOf(query) > -1 || atcTree[i].id.toLowerCase().indexOf(query) > -1)) {
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
*/

/* The 404 Route (Keep this as the last route) */
app.get('/*', function(req, res){
	var url = req.url;
	var query = req.query;

	//Requested medicine?
	if (query["medicine"] !== null) {
		var medicineName = query["medicine"];
		//Perform search
	}
	
	//Requested chapter?
	if (url.toLowerCase().indexOf(".html") > -1) {
		
	}

	//Requested pdf?
	if (url.toLowerCase().indexOf(".pdf") > -1) {
		
	}
	
	//Requested toc in chapter?
	for (var key in url) {
		if (key.indexOf("toc") === 0) {
			
		}
	}

	console.log(url);
	console.log(query);

	res.render('404.ejs', locals);
});
