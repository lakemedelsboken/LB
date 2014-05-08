var cluster = require('cluster');
var path = require("path");
var fs = require("fs");
var wrench = require("wrench");
var async = require("async");
var crypto = require("crypto");
var request = require("request");
var zlib = require("zlib");
var chokidar = require("chokidar");
var util = require("util");

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

var atcTree = JSON.parse(fs.readFileSync(__dirname + "/../../npl/atcTree.json", "utf8"));

var settings = JSON.parse(fs.readFileSync(__dirname + "/../../settings/settings.json", "utf8"));

var networkPort = settings.internalServerPorts.search;

var numCPUs = (require('os').cpus().length);

if (numCPUs < 2) {
	numCPUs = 2;
}

var app = require('./app').init(networkPort);

var searchIndex = null;
var searchIndices = [];

var workerFarm = null;
var contentSearchers = null;
var titleSearchers = null;
var boxSearchers = null;
var medicineSearchers = null;
var resultsLimit = 40;

initSearchIndex();
initFileWatchers();

//TODO: Switch to polling
function initFileWatchers() {
	
	//var chaptersPath = path.normalize(__dirname + "/../site/chapters/");
	//var staticPath = path.normalize(__dirname + "/static/");
	var atcTreePath = path.normalize(__dirname + "/../../npl/atcTree.json");
	var searchesPath = path.normalize(__dirname + "/../../search/");
	
	//var chaptersWatcher = chokidar.watch(chaptersPath, {ignored: /^\./, persistent: true, ignoreInitial: true, interval: 20000, binaryInterval: 20000});
	//var staticWatcher = chokidar.watch(chaptersPath, {ignored: /^\./, persistent: true, ignoreInitial: true, interval: 20000, binaryInterval: 20000});
	var atcTreeWatcher = chokidar.watch(atcTreePath, {persistent: true, ignoreInitial: true, interval: 20000, binaryInterval: 20000});
	/*
	var searchWatcher = chokidar.watch(searchesPath, {ignored: /^\./, persistent: false, ignoreInitial: true, interval: 1000, binaryInterval: 2000});

	searchWatcher.on('error', function(error) {console.error('Error happened on search file watch', error);})
	searchWatcher.on('add', function(path) {
		if (path.indexOf(".json.gz") > -1) {
			//console.log('File', path, 'has been added');
			finishedSearches[path] = true;
		}
	});

	searchWatcher.on('unlink', function(path) {
		if (path.indexOf(".json.gz") > -1) {
			finishedSearches[path] = undefined;
		}
	});
*/
	//chaptersWatcher.on('error', function(error) {console.error('Error happened on chapters file watch', error);})
	//console.log("Watching " + chaptersPath + " for changes...");

	/*
	chaptersWatcher.on('all', function(path, stats) {

		console.log("Reinitializing search index.");
		initSearchIndex();

	});
	*/

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


var locals = {
	title: 'Läkemedelsboken',
	description: '',
	author: '',
	version: settings.version
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
	
	if (terms === "") {
		locals.err = false;
		locals.results = {titlesearch: [], medicinesearch: [], contentsearch: []};
		res.render('search.ejs', locals);
		
	} else {

		async.parallel({
			titlesearch: function(callback) {
				request('http://127.0.0.1:' + networkPort + '/titlesearch?search=' + encodeURIComponent(terms), {'json': true}, function (err, response, body) {

					if (err) {
						callback(err)
					} else {
						callback(null, body);
					}
				});
			},
			contentsearch: function(callback) {
				request('http://127.0.0.1:' + networkPort + '/contentsearch?search=' + encodeURIComponent(terms), {'json': true}, function (err, response, body) {

					if (err) {
						callback(err)
					} else {
						callback(null, body);
					}
				});
			},
			medicinesearch: function(callback) {
				request('http://127.0.0.1:' + networkPort + '/medicinesearch?search=' + encodeURIComponent(terms), {'json': true}, function (err, response, body) {

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
	var previewFolders = fs.readdirSync(__dirname + "/../site/chapters/");
	for (var i=0; i < previewFolders.length; i++) {
		if (previewFolders[i].indexOf("_index") > -1) {
			var index = JSON.parse(fs.readFileSync(__dirname + "/../site/chapters/" + previewFolders[i] + "/" + previewFolders[i].replace("_index", ".json")));
			searchIndex = searchIndex.concat(index);
			searchIndices.push(previewFolders[i]);
		}
	}

	console.log("Book search index is populated with " + searchIndex.length + " items.");
	console.log("Medicine search index is populated with " + atcTree.length + " items.");

	//Create checksum for search index
	var indexChecksum = createCheckSum(JSON.stringify(searchIndex));
	var medicineIndexChecksum = createCheckSum(JSON.stringify(atcTree));

	titleSearchers = workerFarm({maxConcurrentWorkers: 20}, require.resolve("./workers/titlesearcher"));
	contentSearchers = workerFarm({maxConcurrentWorkers: 20}, require.resolve("./workers/contentsearcher"));
	boxSearchers = workerFarm({maxConcurrentWorkers: 20}, require.resolve("./workers/boxsearcher"));
	medicineSearchers = workerFarm({maxConcurrentWorkers: 24}, require.resolve("./workers/medicinesearcher"));

	//Clear prepopulated searches if checksums do not match 
	controlSearchChecksums(path.normalize(__dirname + "/../../search/titlesearches/"), indexChecksum);
	controlSearchChecksums(path.normalize(__dirname + "/../../search/contentsearches/"), indexChecksum);
	controlSearchChecksums(path.normalize(__dirname + "/../../search/boxsearches/"), indexChecksum);
	controlSearchChecksums(path.normalize(__dirname + "/../../search/medicinesearches/"), medicineIndexChecksum);

/*	
	populateFinishedSearches(path.normalize(__dirname + "/../../search/titlesearches/"));
	populateFinishedSearches(path.normalize(__dirname + "/../../search/contentsearches/"));
	populateFinishedSearches(path.normalize(__dirname + "/../../search/boxsearches/"));
	populateFinishedSearches(path.normalize(__dirname + "/../../search/medicinesearches/"));
*/
	isInitializingSearchIndex = false;
}

/*
function populateFinishedSearches(searchDir) {

	var files = fs.readdirSync(searchDir);
	for (var i = 0; i < files.length; i++) {
		if (files[i].indexOf(".json.gz") > -1) {
			finishedSearches[searchDir + files[i]] = true;
		}
	}
}
*/
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

function getSearchContents(fileName, limit, searchTerms, highlightedKeys, callback) {
	
	var results = [];
	
	fs.readFile(fileName, function(err, data) {
		if (err) {
			callback(err, []);
			fs.unlink(fileName, function(err) {});
		} else {
			zlib.unzip(data, function(err, buffer) {
				if (err) {
					
				} else {
					var errorParsingJSON = false;
					try {
						results = JSON.parse(buffer.toString());
					} catch (parserError) {
						errorParsingJSON = parserError;
					}

					if (errorParsingJSON) {
						callback(errorParsingJSON, []);
						fs.unlink(fileName, function(err) {});
						
					} else {

						if (limit && results.length > resultsLimit) {
							results.length = resultsLimit;
						}

						if (limit) {
							searchTerms = parseSearchTerms(searchTerms, !limit, false);
							results = highlightSearchTerms(results, searchTerms, highlightedKeys)
						}

						callback(null, results);

					}
				}
			});
		}
	});
}

app.get('/medicinesearch', function(req,res){

	var searchTerms = req.query["search"].trim().toLowerCase().replace(/\s+/g, " ");

	//var startDate = new Date().getTime();
	//var start = {time: startDate, terms: searchTerms};

	var searchLimit = req.query["limit"];

	//Implement limit
	var limit = true;
	if (searchLimit !== undefined) {
		limit = false;
	}

	var replaceCommon = req.query["replace"];

	//Implement replacement of common characters
	var replaceCommonCharacters = true;
	if (replaceCommon !== undefined) {
		replaceCommonCharacters = false;
	}

	replaceCommonCharacters = false;

	var results = [];
	
	//Find already finished search for the same terms
	var safeTerms = getSafeSearchTerms(searchTerms);
	var possibleMedicineSearchFileName = path.normalize(__dirname + "/../../search/medicinesearches/" + safeTerms + ".json.gz");

	fs.exists(possibleMedicineSearchFileName, function(fileExists) {

		if (fileExists) {
			getSearchContents(possibleMedicineSearchFileName, limit, searchTerms, ["title", "titlePath"], function(err, data) {
				if (err) {
					res.json([]);
					console.error(err);
				} else {
					res.json(data);
				}
			});
		} else {

			searchTerms = parseSearchTerms(searchTerms, !limit, replaceCommonCharacters);
		
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
			
				//Distribute search to 24 search workers
				//console.time("search");
				for (var i = 0; i < 24; i++) {
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
						
							if (limit) {
								results = highlightSearchTerms(results, searchTerms, ["title", "titlePath"])
							}

							//var endDate = new Date().getTime();
							//console.log(start.terms + " finished in " + (endDate - start.time));

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
					request("http://127.0.0.1:" + networkPort + "/medicinesearch?search=" + encodeURIComponent(task.term) + "&limit=off&replace=off", {'json': true}, function (error, response, body) {
						var requestResult = [];
						if (!error && response.statusCode == 200) {
							requestResult = body;
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

					if (limit) {
						results = highlightSearchTerms(results, searchTerms, ["title", "titlePath"])
					}
					//Async exit
					res.json(results);
					//var endDate = new Date().getTime();
					//console.log(start.terms + " finished in " + (endDate - start.time) + ", multiple terms search.");

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

});

app.get('/titlesearch', function(req,res){

	var searchTerms = req.query["search"].trim().toLowerCase().replace(/\s+/g, " ");

	var searchLimit = req.query["limit"];

	//Implement limit
	var limit = true;
	if (searchLimit !== undefined) {
		limit = false;
	}

	var replaceCommon = req.query["replace"];

	//Implement replacement of common characters
	var replaceCommonCharacters = true;
	if (replaceCommon !== undefined) {
		replaceCommonCharacters = false;
	}

	replaceCommonCharacters = false;

	var results = [];
	
	//Find already finished search for the same terms
	var safeTerms = getSafeSearchTerms(searchTerms);
	var possibleSearchFileName = path.normalize(__dirname + "/../../search/titlesearches/" + safeTerms + ".json.gz");

	searchTerms = parseSearchTerms(searchTerms, !limit, replaceCommonCharacters);

	fs.exists(possibleSearchFileName, function(fileExists) {

		if (fileExists) {
			getSearchContents(possibleSearchFileName, limit, searchTerms, ["title", "titlePath"], function(err, data) {
				if (err) {
					res.json([]);
					console.error(err);
				} else {
					res.json(data);
				}
			});
		} else {
			
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
						count++;
						if (count === searchIndices.length) {
							//Done searching, continue
							var merged = [];
							merged = merged.concat.apply(merged, allSearchResults);
						
							//Sort according to score and level
							merged.sort(function(a, b) {
								//return a.score - b.score;

							    var aScore = a.score;
							    var bScore = b.score;
							    var aLevel = a.level;
							    var bLevel = b.level;
							    //console.log(aLow + " | " + bLow);

							    if(aScore == bScore)
							    {
							        return (aLevel < bLevel) ? -1 : (aLevel > bLevel) ? 1 : 0;
							    }
							    else
							    {
							        return (aScore < bScore) ? -1 : 1;
							    }
							});

							searchResults[0] = merged;

							results = filterAndSaveSearchResults(searchTerms, searchResults, possibleSearchFileName);

							if (limit && results.length > resultsLimit) {
								results.length = resultsLimit;
							}
							
							if (limit) {
								results = highlightSearchTerms(results, searchTerms, ["title", "titlePath"]);
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
					request("http://127.0.0.1:" + networkPort + "/titlesearch?search=" + encodeURIComponent(task.term) + "&limit=off&replace=off", {'json': true}, function (error, response, body) {
						var requestResult = [];
						if (!error && response.statusCode == 200) {
							requestResult = body;
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

					//Sort according to score and level
					results.sort(function(a, b) {
						//return a.score - b.score;

					    var aScore = a.score;
					    var bScore = b.score;
					    var aLevel = a.level;
					    var bLevel = b.level;
					    //console.log(aLow + " | " + bLow);

					    if(aScore == bScore)
					    {
					        return (aLevel < bLevel) ? -1 : (aLevel > bLevel) ? 1 : 0;
					    }
					    else
					    {
					        return (aScore < bScore) ? -1 : 1;
					    }
					});

					if (limit && results.length > resultsLimit) {
						results.length = resultsLimit;
					}
					
					if (limit) {
						results = highlightSearchTerms(results, searchTerms, ["title", "titlePath"]);
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
			
	});


});

function escapeRegExp(str) {
	return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

function highlightSearchTerms(results, searchTerms, keysToHighlight) {
	
	var maxContentLength = 200;

	var keysLookup = {};

	for (var i = 0; i < keysToHighlight.length; i++) {
		keysLookup[keysToHighlight[i]] = true;
	}

	//console.log(keysLookup);
		
	for (var i = 0; i < results.length; i++) {
		var item = results[i];
		
		for (var key in item) {

			if (keysLookup.hasOwnProperty(key)) {

				var text = item[key];

				if (key === "content" && text.length > maxContentLength) {

					var blurbs = [];
					
					var charsLeft = 90;
					var charsRight = 90;

					for (var j = 0; j < searchTerms.length; j++) {
						var term = searchTerms[j];
						
						var index = text.indexOf(term);
						
						if (index > -1) {
							var start = ((index - charsLeft) < 0) ? 0 : (index - charsLeft);
							var nrOfChars = term.length + charsRight + charsLeft;
							
							if ((start + nrOfChars) > text.length) {
								nrOfChars = text.length - start;
							}
							
							if (start <= 100) {
								nrOfChars += start;
								start = 0;
							}
							
							var blurb = text.substr(start, nrOfChars);
							
							if (start > 0) {
								blurb = "..." + blurb;
							}
							
							if ((start + nrOfChars) < text.length) {
								blurb += "...";
							}
							
							blurbs.push(blurb);
							
							text = text.substr(start + nrOfChars);
						}
					}
					
					if (blurbs.length > 0) {
						text = blurbs.join(" ");
					} else if (text.length > maxContentLength) {
						text = text.substr(0, maxContentLength) + "...";
					}
					
					
				}
			
				for (var j = 0; j < searchTerms.length; j++) {
					var term = searchTerms[j];
					text = text.replace(new RegExp(escapeRegExp(term) + "(?!<)", "gi"), function(match) {
						
						//Add weird chars
						return "♘" + match + "♖"
					});
				}

				//Replace weird chars
				text = text.replace(/♘/g, "<span class=\"highlight\">").replace(/♖/g, "</span>");
				
				key = key + "_HL";
				
				item[key] = text;

			}

		}
		
		if (item["content"] !== undefined) {
			item.content = "";
		}
	}
	
	return results;
}


app.get('/contentsearch', function(req,res){

	var searchTerms = req.query["search"].trim().toLowerCase().replace(/\s+/g, " ");

	var searchLimit = req.query["limit"];

	//Implement limit
	var limit = true;
	if (searchLimit !== undefined) {
		limit = false;
	}

	var replaceCommon = req.query["replace"];

	//Implement replacement of common characters
	var replaceCommonCharacters = true;
	if (replaceCommon !== undefined) {
		replaceCommonCharacters = false;
	}

	replaceCommonCharacters = false;

	var results = [];
	
	
	//Find already finished search for the same terms
	var safeTerms = getSafeSearchTerms(searchTerms);
	var possibleSearchFileName = path.normalize(__dirname + "/../../search/contentsearches/" + safeTerms + ".json.gz");

	fs.exists(possibleSearchFileName, function(fileExists) {

		if (fileExists) {
			getSearchContents(possibleSearchFileName, limit, searchTerms, ["content", "title", "titlePath"], function(err, data) {
				if (err) {
					res.json([]);
					console.error(err);
				} else {
					res.json(data);
				}
			});

		} else {

			searchTerms = parseSearchTerms(searchTerms, !limit, replaceCommonCharacters);
		
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
						
							if (limit) {
								results = highlightSearchTerms(results, searchTerms, ["content", "title", "titlePath"]);
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
					request("http://127.0.0.1:" + networkPort + "/contentsearch?search=" + encodeURIComponent(task.term) + "&limit=off&replace=off", {'json': true}, function (error, response, body) {
						var requestResult = [];
						if (!error && response.statusCode == 200) {
							requestResult = body;
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

					if (limit) {
						results = highlightSearchTerms(results, searchTerms, ["content", "title", "titlePath"]);
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

});

app.get('/boxsearch', function(req,res){

	var searchTerms = req.query["search"].trim().toLowerCase().replace(/\s+/g, " ");

	var searchLimit = req.query["limit"];

	//Implement limit
	var limit = true;
	if (searchLimit !== undefined) {
		limit = false;
	}

	var replaceCommon = req.query["replace"];

	//Implement replacement of common characters
	var replaceCommonCharacters = true;
	if (replaceCommon !== undefined) {
		replaceCommonCharacters = false;
	}

	var results = [];
	
	//Find already finished search for the same terms
	var safeTerms = getSafeSearchTerms(searchTerms);
	var possibleSearchFileName = path.normalize(__dirname + "/../../search/boxsearches/" + safeTerms + ".json.gz");

	fs.exists(possibleSearchFileName, function(fileExists) {

		if (fileExists) {
			getSearchContents(possibleSearchFileName, limit, searchTerms, ["title", "titlePath"], function(err, data) {
				if (err) {
					res.json([]);
					console.error(err);
				} else {
					res.json(data);
				}
			});
		} else {

			searchTerms = parseSearchTerms(searchTerms, !limit, replaceCommonCharacters);
		
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
					request("http://127.0.0.1:" + networkPort + "/boxsearch?search=" + encodeURIComponent(task.term) + "&limit=off&replace=off", {'json': true}, function (error, response, body) {
						var requestResult = [];
						if (!error && response.statusCode == 200) {
							requestResult = body;
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
});

function filterAndSaveSearchResults(searchTerms, searchResults, fileName) {

	var results = [];

	if (searchTerms.length > 1) {
		results = getResultsThatMatchAllTerms(searchResults);
		
		//If none matched, return the results for the term with the most results
		//TODO: Improve this
		/*
		if (results.length === 0) {

			var sortedByLength = [];
			for (var key in searchResults) {
				sortedByLength.push(searchResults[key]);
			}
			sortedByLength.sort(function(a, b) {
				return b.length - a.length;
			});
			
			results = sortedByLength[0];
		}
		*/
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
			//trimmed[i].content = "";
			trimmed[i].products = "";
		}

		//If results have the same score, sort on level descending

		results = trimmed;
		
	}

	//Compress and save to file, async
	zlib.deflate(JSON.stringify(results), function(err, buffer) {
		if (!err) {

			fs.writeFile(fileName, buffer, function(err) {
				if (err) {
					console.error(err);
				}
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

function parseSearchTerms(terms, skipSplit, replaceCommonCharacters) {

	if (skipSplit === undefined) {
		skipSplit = false;
	}
	
	if (util.isArray(terms)) {
		terms = terms.join(" ");
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

	if (replaceCommonCharacters) {
		var newTerms = [];
	
		var commonReplacements = {
			"c": "k",
			"k": "c",
			"s": "z",
			"z": "s"
		};
		for (var i = 0; i < result.length; i++) {
			var original = result[i];
			var replaced = original;
			for (var key in commonReplacements) {
				var re = new RegExp(key, "g");
				replaced = original.replace(re, commonReplacements[key]);
				if (replaced !== original) {
					newTerms.push(replaced);
				}
			}
		}
	
		if (newTerms.length > 0) {
			result = result.concat(newTerms);
		}
		
	}
	
	//console.log("Finished terms: ", result);
	
	return result;
}

/* The 404 Route (Keep this as the last route) */
app.get('/*', function(req, res){

	res.status(400);
	res.end("404");
	
});
