var express = require('express');
var fs = require("fs");
var request = require("request");
var genericasInjector = require("../cms/postprocessors/genericas.js")
var crypto = require("crypto");
var cheerio = require("cheerio");
var path = require("path");
var chokidar = require("chokidar");
var keywordExtractor = require("keyword-extractor");
var synonymFinder = require("../cms/search/synonyms.js");
var Stats = require('fast-stats').Stats;

var LRU = require("lru-cache")
  , options = {max: 2000}
  , cache = LRU(options)

var secretSettingsPath = __dirname + "/../../settings/secretSettings.json";
var secretApikeysPath =  "";

if(__dirname.indexOf("vagrant") !== -1) {
	secretApikeysPath =  "/vagrant/secretApikeys.json";
}else {
	secretApikeysPath =  "/var/www/lb/secretApikeys.json";
}

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
var secretApikeys = JSON.parse(fs.readFileSync(secretApikeysPath, "utf8"));
var settings = JSON.parse(fs.readFileSync(__dirname + "/../../settings/settings.json", "utf8"));
var thisPort = settings.internalServerPorts.api;
var sitePort = settings.internalServerPorts.site;
var searchPort = settings.internalServerPorts.search;

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


var app = require('./app').init(thisPort);

var locals = {
	title: 'Läkemedelsboken',
	description: '',
	author: '',
	version: settings.version
};


//BEGIN API VERSION 1

//Search medicine products and atc items
app.get('/api/v1/medicinesearch', function(req,res){

	var apiKey = req.query["apikey"];
	var isAllowed = checkIfApiKeyIsLegit(apiKey, req);

	if (isAllowed) {

		var strippedUrl = req.originalUrl.replace("api/v1/", "");

		request("http://127.0.0.1:" + searchPort + strippedUrl, {'json': true}, function (error, response, body) {
			var requestResult = [];
			if (!error && response.statusCode == 200) {
				requestResult = body;
			} else if (error) {
				console.log(error);
			} else {
				console.log("Status code: " + response.statusCode);
			}

			if (req.query["callback"] !== undefined && req.query["callback"] !== "") {
				res.jsonp(requestResult);
			} else {
				res.json(requestResult);
			}

		});

	} else {
		res.status(403);
		res.end("403 Forbidden, too many requests from the same ip-address without an api key");
	}

});

//Search in book titles
app.get('/api/v1/titlesearch', function(req,res){

	var apiKey = req.query["apikey"];
	var isAllowed = checkIfApiKeyIsLegit(apiKey, req);

	if (isAllowed) {

		var strippedUrl = req.originalUrl.replace("api/v1/", "");

		request("http://127.0.0.1:" + searchPort + strippedUrl, {'json': true}, function (error, response, body) {
			var requestResult = [];
			if (!error && response.statusCode == 200) {
				requestResult = body;
			} else if (error) {
				console.log(error);
			} else {
				console.log("Status code: " + response.statusCode);
			}

			if (req.query["callback"] !== undefined && req.query["callback"] !== "") {
				res.jsonp(requestResult);
			} else {
				res.json(requestResult);
			}

		});

	} else {
		res.status(403);
		res.end("403 Forbidden, too many requests from the same ip-address without an api key");
	}

});

//Search all of the book content
app.get('/api/v1/contentsearch', function(req,res){

	var apiKey = req.query["apikey"];
	var isAllowed = checkIfApiKeyIsLegit(apiKey, req);

	if (isAllowed) {

		var strippedUrl = req.originalUrl.replace("api/v1/", "");

		request("http://127.0.0.1:" + searchPort + strippedUrl, {'json': true}, function (error, response, body) {
			var requestResult = [];
			if (!error && response.statusCode == 200) {
				requestResult = body;
			} else if (error) {
				console.log(error);
			} else {
				console.log("Status code: " + response.statusCode);
			}

			if (req.query["callback"] !== undefined && req.query["callback"] !== "") {
				res.jsonp(requestResult);
			} else {
				res.json(requestResult);
			}

		});

	} else {
		res.status(403);
		res.end("403 Forbidden, too many requests from the same ip-address without an api key");
	}

});

//Search in information boxes
app.get('/api/v1/boxsearch', function(req,res){

	var apiKey = req.query["apikey"];
	var isAllowed = checkIfApiKeyIsLegit(apiKey, req);

	if (isAllowed) {

		var strippedUrl = req.originalUrl.replace("api/v1/", "");

		request("http://127.0.0.1:" + searchPort + strippedUrl, {'json': true}, function (error, response, body) {
			var requestResult = [];
			if (!error && response.statusCode == 200) {
				requestResult = body;
			} else if (error) {
				console.log(error);
			} else {
				console.log("Status code: " + response.statusCode);
			}

			if (req.query["callback"] !== undefined && req.query["callback"] !== "") {
				res.jsonp(requestResult);
			} else {
				res.json(requestResult);
			}

		});

	} else {
		res.status(403);
		res.end("403 Forbidden, too many requests from the same ip-address without an api key");
	}

});

//Get info from ATC tree
app.get('/api/v1/atctree', function(req,res){

	var apiKey = req.query["apikey"];
	var isAllowed = checkIfApiKeyIsLegit(apiKey, req);

	if (isAllowed) {

		var strippedUrl = req.originalUrl.replace("api/v1/", "");

		request("http://127.0.0.1:" + sitePort + strippedUrl, {'json': true}, function (error, response, body) {
			var requestResult = [];
			if (!error && response.statusCode == 200) {
				requestResult = body;
			} else if (error) {
				console.log(error);
			} else {
				console.log("Status code: " + response.statusCode);
			}

			if (req.query["callback"] !== undefined && req.query["callback"] !== "") {
				res.jsonp(requestResult);
			} else {
				res.json(requestResult);
			}

		});

	} else {
		res.status(403);
		res.end("403 Forbidden, too many requests from the same ip-address without an api key");
	}

});

//Get test html
app.get('/api/v1/injectgenericas/test1.html', function(req,res) {

	var apiKey = req.query["apikey"];
	var isAllowed = checkIfApiKeyIsLegit(apiKey, req);

	if (isAllowed) {

		var testFilePath = path.join(__dirname, "html", "test1.html");

		res.sendfile(testFilePath);

	} else {
		res.status(403);
		res.end("403 Forbidden, too many requests from the same ip-address without an api key");
	}

});

//Get full atcTree
app.get('/api/v1/atcTree.json', function(req,res) {

	var apiKey = req.query["apikey"];
	var isAllowed = checkIfApiKeyIsLegit(apiKey, req);

	if (isAllowed) {

		var atcTreePath = path.join(__dirname, "..", "..", "npl", "atcTree.json");

		res.sendfile(atcTreePath);

	} else {
		res.status(403);
		res.end("403 Forbidden, too many requests from the same ip-address without an api key");
	}

});


//Get css for injected generica names
app.get('/api/v1/injectgenericas/lb.injectgenericas.css', function(req,res) {

	var apiKey = req.query["apikey"];
	var isAllowed = checkIfApiKeyIsLegit(apiKey, req);

	if (isAllowed) {

		var cssPath = path.join(__dirname, "css", "lb.injectgenericas.min.css");

		res.sendfile(cssPath);

	} else {
		res.status(403);
		res.end("403 Forbidden, too many requests from the same ip-address without an api key");
	}

});

app.get('/api/v1/appindex', function(req,res) {

	var apiKey = req.query["apikey"];

	var isAllowed = checkIfApiKeyIsLegit(apiKey, req);

	if (isAllowed) {

		var index = JSON.parse(fs.readFileSync(path.join(__dirname, "app", "masterIndex.json")));

		if (req.query["callback"] !== undefined && req.query["callback"] !== "") {
			res.jsonp(index);
		} else {
			res.json(index);
		}

	} else {
		res.status(403);
		res.end("403 Forbidden, too many requests from the same ip-address without an api key");
	}

});

app.get('/api/v1/appify', function(req,res) {

	var apiKey = req.query["apikey"];
	var url = req.query["url"];

	var isAllowed = checkIfApiKeyIsLegit(apiKey, req);

	if (isAllowed) {

		url = url.replace(/\.\./g, "");

		//Find if the page exists
		var basePath = path.join(__dirname, "..", "cms", "output", "published");
		var fullPath = path.join(basePath, url);
		if (path.extname(fullPath) === ".html") {
			fs.exists(fullPath, function(exists) {
				if (exists && fs.statSync(fullPath).isFile()) {

					parseToAppHtml(fullPath, function(err, appHtml) {
						if (err) {
							res.status(404);
							res.end("Error");
						} else {
							res.set('Content-Type', 'text/html');
							res.send(appHtml);
						}
					});
				} else {
					res.status(403);
					res.end("Forbidden");
				}
			});

		} else {
			res.status(403);
			res.end("Forbidden");
		}

	} else {
		res.status(403);
		res.end("403 Forbidden, too many requests from the same ip-address without an api key");
	}

});

function parseToAppHtml(fullPath, callback) {

	var outline = fs.readFileSync(path.join(__dirname, "app", "appOutline.html"), "utf8");

	fs.readFile(fullPath, "utf8", function(err, data) {

		if (err) {
			return callback(err);
		}

		var $ = cheerio.load(data);

		//Fix images
		$("div.figureImage, div.image").each(function(index, element) {
			var $element = $(element);

			var correctSrc = undefined;

			$element.children().each(function(i, e) {
				if ($(e).attr("data-src") !== undefined && $(e).attr("data-src").indexOf("medium_x2.png") > -1) {
					correctSrc = $(e).attr("data-src");
					correctSrc = correctSrc.replace(/\.\.\//g, "/");
					correctSrc = correctSrc.replace(/\.\//g, "/");
					correctSrc = correctSrc.replace(/\/\//g, "/");
					correctSrc = "{server}" + correctSrc;
					return false;
				}
			});

			if (correctSrc !== undefined) {
				$element.empty();
				$element.replaceWith("<img src=\"" + correctSrc + "\" class=\" figureImage img-responsive\">");
			}

		});

		//Fix pageLinks
		$("a").each(function(index, element) {
			var $element = $(element);

			var href = $element.attr("href");

			if (href !== undefined && typeof href === "string" && href.indexOf("http://") === -1 && href.indexOf("https://") === -1) {
				if ($element.attr("class") === undefined || $element.attr("class") === "") {
					$element.addClass("pageLink");
				}
			}

		});


		//Fix header and footer, remove menu and search
		var mainContainer = $("div#main");

		var mainClasses = mainContainer.attr("class");

		if (mainClasses !== undefined) {
			outline = outline.replace("{mainclass}", " class=\"" + mainClasses + "\"");
		} else {
			outline = outline.replace("{mainclass}", "");
		}

		outline = outline.replace("{content}", mainContainer.html());
		var title = $("h1").first();
		if (title !== undefined && title.length === 1) {
			outline = outline.replace("{title}", title.text());
		}



		outline = outline.replace(/\{version\}/g, staticSettings.version);

		return callback(null, outline);

	});


}

//Get javascript for injecting generica names
app.get('/api/v1/injectgenericas/lb.injectgenericas.js/:selector?', function(req,res) {

	var apiKey = req.query["apikey"];
	var envSetting = req.query["env"];

	var isAllowed = checkIfApiKeyIsLegit(apiKey, req);

	if (isAllowed) {
		res.set({
			'Content-Type': 'application/javascript',
			'Vary': 'Accept-Encoding',
			'Last-Modified': '0'
		});

		var selector = req.params.selector;

		if (!selector) {
			selector = "body";
		}

		var environment = "www.lakemedelsboken.se";

		if (envSetting === "test") {
			environment = "localhost";
		}

		var cacheKey = createHash(apiKey + "_" + selector + "_" + environment);

		var script = "";

		if (cache.has(cacheKey)) {
			script = cache.get(cacheKey);
		} else {
			script = fs.readFileSync(path.join(__dirname, "scripts", "lb.injectgenericas.min.js"), "utf8");

			script = script.replace(/{SELECTOR}/g, selector);
			script = script.replace(/{URL_SELECTOR}/g, encodeURIComponent(selector));
			script = script.replace(/{APIKEY}/g, apiKey);
			script = script.replace(/{ENVIRONMENT}/g, environment);

			cache.set(cacheKey, script);
		}

		res.send(script);

	} else {
		res.status(403);
		res.end("403 Forbidden, too many requests from the same ip-address without an api key");
	}

});

//Tag generica names in a text
app.get('/api/v1/injectgenericas/:selector?', function(req,res){

//	res.header("Access-Control-Allow-Origin", "*");
//	res.header("Access-Control-Allow-Headers", "X-Requested-With");

	var content = req.query["content"];
	var url = req.query["url"];

	var apiKey = req.query["apikey"];
	var isAllowed = checkIfApiKeyIsLegit(apiKey, req);

	if (isAllowed) {

		//Fetch content if only url is provided
		if (content === undefined && url !== undefined) {
			getContentFromUrl(url, function(err, data) {
				var result = {content: ""};
				if (err) {
					if (req.query["callback"] !== undefined && req.query["callback"] !== "") {
						res.jsonp(result);
					} else {
						res.json(result);
					}
				} else {
					//Load in cheerio
					var $ = cheerio.load(data);

					var selector = req.params.selector;
					if (!selector) {
						selector = "body";
					}

					var selectedElement = $(selector);

					if (selectedElement.length > 0) {
						selectedElement = selectedElement.first();

						selectedElement.find("script").remove();

						data = selectedElement.html();
						data = data.replace(/\r\n/g, "\n"); //.replace(/\n/g, "").replace(/\t/g, "");

						if (data.length > 0) {
							data = genericasInjector.process(data);
							result.content = data;
						} else {
							console.log("No data");
						}

					}

					if (req.query["callback"] !== undefined && req.query["callback"] !== "") {
						res.jsonp(result);
					} else {
						res.json(result);
					}
				}
			});
		} else if (content) {
			var result = {content: content};

			var contentHash = createHash(content);
			if (cache.has(contentHash)) {
				content = cache.get(contentHash);
			} else {
				content = genericasInjector.process(content);
				cache.set(contentHash, content);
			}

			result.content = content;

			if (req.query["callback"] !== undefined && req.query["callback"] !== "") {
				res.jsonp(result);
			} else {
				res.json(result);
			}
		} else {
			var result = {content: ""};
			if (req.query["callback"] !== undefined && req.query["callback"] !== "") {
				res.jsonp(result);
			} else {
				res.json(result);
			}
		}


	} else {
		res.status(403);
		res.end("403 Forbidden, too many requests from the same ip-address without an api key");
	}

});

var meshTerms = null;

function extractKeywords(data, excludedWords) {

	if (meshTerms === null) {

		meshTerms = {};

		var terms = fs.readFileSync(path.join(__dirname, "..", "cms", "search", "synonyms", "terms.txt"), "utf8");
		terms = terms.replace(/\r/g, "");

		var rows = terms.split("\n");

		for (var i = 1; i < rows.length; i++) {

			var lineValues = rows[i].split("\t");
			var id = lineValues[0];
			var word = lineValues[2];

			if (word !== undefined) {
				word = word.toLowerCase();
			}

			if (word !== undefined) {
				meshTerms[word] = id;
			}

		}
	}

	var keywordsChained = keywordExtractor.extract(data, {language: "swedish", remove_digits: true, return_changed_case: true, return_chained_words: true});

	for (var i = keywordsChained.length - 1; i >= 0; i--) {
		//Duplicate each
		keywordsChained.push(keywordsChained[i]);
	}

	var keywordsUnchained = keywordExtractor.extract(data, {language: "swedish", remove_digits: true, return_changed_case: true, return_chained_words: false});

	var keywords = keywordsChained.concat(keywordsUnchained);

	var countedKeywords = {};

	keywords.forEach(function(word) {

		if (word.length > 2 && excludedWords.indexOf(word) === -1) {
			if (countedKeywords[word] === undefined) {
				countedKeywords[word] = 0;
			}

			countedKeywords[word] = countedKeywords[word] + 1;
		}
	});

	var rankedKeywords = [];
	for (var word in countedKeywords) {
		rankedKeywords.push({word: word, count: countedKeywords[word], meshterm: (meshTerms[word] !== undefined)});
	}

	//Triple the count for mesh terms, boosting
	rankedKeywords.forEach(function(item) {
		if (item.meshterm) {
			item.count = item.count * 3;
		}
	});


	rankedKeywords.sort(function(a, b) {
		return b.count - a.count;
	});

	for (var i = rankedKeywords.length - 1; i >= 0; i--) {
		if (rankedKeywords[i].count < 3) {
			rankedKeywords.splice(i, 1);
		}
	}

	var counts = [];

	var cutoff = 0;
	var total = 0;
	for (var i = 0; i < rankedKeywords.length; i++) {
		counts.push(rankedKeywords[i].count);
	}

	var stats = new Stats().push(counts);
	var mean = stats.amean();
	var stddev = stats.stddev();
	cutoff = Math.round(mean + stddev);

	for (var i = rankedKeywords.length - 1; i >= 0; i--) {
		if (rankedKeywords[i].count < cutoff) { // && rankedKeywords[i].meshterm === false
			rankedKeywords.splice(i, 1);
		}
	}

	rankedKeywords.forEach(function(item) {
		item.synonyms = synonymFinder.process(item.word).trim().replace(/\s\s+/g, ", ");
		if (item.synonyms !== "") {
			item.meshterm = true;
		}
	});

	rankedKeywords.sort(function(a, b) {
		if (a.meshterm && b.meshterm) {
			return b.count - a.count;
//			return 0;
		} else if (a.meshterm) {
			return -1;
		} else if (b.meshterm) {
			return 1;
		} else {
			return b.count - a.count;
//			return 0;
		}
	});

	return rankedKeywords;
}

//Return mesh items for a url
app.get('/api/v1/extractkeywords', function(req,res){

	var content = req.query["content"];
	var url = req.query["url"];
	var excludedWords = req.query["exclude"];

	if (excludedWords === undefined) {
		excludedWords = [];
	} else {
		try {
			excludedWords = JSON.parse(excludedWords);
		} catch(e) {
			excludedWords = [];
		}
	}

	var apiKey = req.query["apikey"];
	var isAllowed = checkIfApiKeyIsLegit(apiKey, req);

	if (isAllowed) {

		//Fetch content if only url is provided
		if (content === undefined && url !== undefined) {
			getContentFromUrl(url, function(err, data) {
				var result = {content: ""};
				if (err) {
					if (req.query["callback"] !== undefined && req.query["callback"] !== "") {
						res.jsonp(result);
					} else {
						res.json(result);
					}
				} else {
					//Load in cheerio
					var $ = cheerio.load(data);

					var selectedElement = $("body");

					if (selectedElement.length > 0) {
						selectedElement = selectedElement.first();

						selectedElement.find("script").remove();

						var data = selectedElement.text();
						data = data.replace(/\r\n/g, "\n"); //.replace(/\n/g, "").replace(/\t/g, "");

						if (data.length > 0) {
							result.content = extractKeywords(data, excludedWords);
						} else {
							console.log("No data ");
						}

					}

					if (req.query["callback"] !== undefined && req.query["callback"] !== "") {
						res.jsonp(result);
					} else {
						res.json(result);
					}
				}
			});
		} else if (content) {
			var result = {content: ""};

			var contentHash = createHash(content + excludedWords.join(","));
			if (cache.has(contentHash)) {
				result.content = cache.get(contentHash);
			} else {
				//Load in cheerio
				var $ = cheerio.load(content);

				var selectedElement = $("body");

				if (selectedElement.length > 0) {
					selectedElement = selectedElement.first();

					selectedElement.find("script").remove();

					var data = selectedElement.text();
					data = data.replace(/\r\n/g, "\n"); //.replace(/\n/g, "").replace(/\t/g, "");

					if (data.length > 0) {
						result.content = extractKeywords(data, excludedWords);
					} else {
						console.log("No data");
					}

				}

			}

			cache.set(contentHash, result.content);

			if (req.query["callback"] !== undefined && req.query["callback"] !== "") {
				res.jsonp(result);
			} else {
				res.json(result);
			}

		} else {
			var result = {content: ""};
			if (req.query["callback"] !== undefined && req.query["callback"] !== "") {
				res.jsonp(result);
			} else {
				res.json(result);
			}
		}


	} else {
		res.status(403);
		res.end("403 Forbidden, too many requests from the same ip-address without an api key");
	}

});

//Return mesh keywords from post html data
app.post('/api/v1/extractkeywords', express.urlencoded({extended: false, limit: "50mb"}), function(req,res){

	if (!req.body) return res.sendStatus(400);

	var content = req.body.content;

	if (!content) return res.sendStatus(400);

	var excludedWords = req.body.exclude;

	if (excludedWords === undefined) {
		excludedWords = [];
	} else {
		try {
			excludedWords = JSON.parse(excludedWords);
		} catch(e) {
			excludedWords = [];
		}
	}


	var apiKey = req.body.apikey;
	var isAllowed = checkIfApiKeyIsLegit(apiKey, req);

	if (isAllowed) {

		var result = {content: ""};

		var contentHash = createHash(content + excludedWords.join(","));
		if (cache.has(contentHash)) {
			result.content = cache.get(contentHash);
		} else {

			//Load in cheerio
			var $ = cheerio.load(content);

			var selectedElement = $("body");

			if (selectedElement.length > 0) {
				selectedElement = selectedElement.first();

				selectedElement.find("script").remove();

				var data = selectedElement.text();
				data = data.replace(/\r\n/g, "\n"); //.replace(/\n/g, "").replace(/\t/g, "");

				if (data.length > 0) {
					result.content = extractKeywords(data, excludedWords);
				} else {
					console.log("No data");
				}

			} else {
				console.log("body element is missing from the html document");
			}

		}

		cache.set(contentHash, result.content);

		if (req.query["callback"] !== undefined && req.query["callback"] !== "") {
			res.jsonp(result);
		} else {
			res.json(result);
		}

	} else {
		res.status(403);
		res.end("403 Forbidden, too many requests from the same ip-address without an api key");
	}

});



//END API VERSION 1

var requestChecker = {};
var allowedUnauthorizedRequestsPerTimeInterval = 100;
var unauthorizedRequestsTimeInterval = 1000 * 60 * 60; //1 hour

//Clear the requestChecker
setInterval(function() {requestChecker = {};}, unauthorizedRequestsTimeInterval);

function checkIfApiKeyIsLegit(apiKey, req) {
	var isLegit = false;

	//Check table of api keys and log request
	var apiKeys = secretApikeys.api.keys;
	console.log(apiKeys);
	if (apiKeys[apiKey] !== undefined) {
		//Key seems legit
		isLegit = true;

		//Log the request
		var url = req.originalUrl.replace(apiKey, "").replace("&apikey=", "").replace("apikey=", "");
		logRequest(apiKeys[apiKey], url);
	}

	//Allow a certain number of requests per time interval from an ip-address
	if (!isLegit) {
		if (requestChecker[req.ip.toString()] !== undefined) {
			requestChecker[req.ip.toString()]++;
		} else {
			requestChecker[req.ip.toString()] = 1;
		}

		if (requestChecker[req.ip.toString()] <= allowedUnauthorizedRequestsPerTimeInterval) {
			isLegit = true;
			logRequest("temp-" + req.ip.toString(), req.originalUrl);
		}
	}

	return isLegit;
}

function logRequest(nameOfService, url) {

	var now = new Date();
	var lineToLog = nameOfService + "\t" + url + "\n";
	var logFileName = __dirname + "/logs/log-" + now.getFullYear() + "-" + (now.getMonth() + 1) + "-" + now.getDate() + ".txt";

	fs.appendFile(logFileName, lineToLog, encoding='utf8', function (err) {
		if (err) {
			console.error(err);
		}
	});
}

function createHash(data) {
	var checksum = crypto.createHash("sha1");
	checksum.update(data);
	return checksum.digest("hex");
}

function getContentFromUrl(url, callback) {

	request(url, function(error, response, body) {
		if (!error && response.statusCode == 200) {
			return callback(null, body);
		} else if (error) {
			return callback(error);
		} else {
			return callback(new Error(response.statusCode));
		}
	});

};

app.get("/api/", function(req, res) {
	res.render("index.ejs", locals);
});


/* The 404 Route (Keep this as the last route) */
app.get('/*', function(req, res){

	res.status(400);
	res.end("404");

});
