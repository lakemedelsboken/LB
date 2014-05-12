var fs = require("fs");
var request = require("request");
var genericasInjector = require("../../parser/postprocessors/genericas.js")
var crypto = require("crypto");

var LRU = require("lru-cache")
  , options = {max: 2000}
  , cache = LRU(options)

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
var settings = JSON.parse(fs.readFileSync(__dirname + "/../../settings/settings.json", "utf8"));
var thisPort = settings.internalServerPorts.api;
var sitePort = settings.internalServerPorts.site;
var searchPort = settings.internalServerPorts.search;

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

//Tag generica names in a text
app.get('/api/v1/injectgenericas', function(req,res){

	var content = req.query["content"];

	var apiKey = req.query["apikey"];
	var isAllowed = checkIfApiKeyIsLegit(apiKey, req);

	if (isAllowed) {

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
	var apiKeys = secretSettings.api.keys;
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

app.get("/api/", function(req, res) {
	res.render("index.ejs", locals);
});


/* The 404 Route (Keep this as the last route) */
app.get('/*', function(req, res){

	res.status(400);
	res.end("404");
	
});
