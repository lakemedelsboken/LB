var http = require("http");
http.globalAgent.maxSockets = 20;

var request = require("request");
var async = require("async");
var fs = require("fs");

var secretSettingsPath = __dirname + "/../settings/secretSettings.json";

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

var settings = JSON.parse(fs.readFileSync(__dirname + "/../settings/settings.json", "utf8"));

var networkPort = settings.externalServerPorts.main;

var counter = 0;
var intervalCounter = 0;

var intervalInSeconds = 5;

var interval = setInterval(function() {
	var approx = (intervalCounter / intervalInSeconds);
	intervalCounter = 0;
	
	approx = parseInt(approx * 1000) / 1000;
	console.log(approx + " terms per second.")
}, (intervalInSeconds * 1000))

//Create queue
var searchQueue = async.queue(function (task, callback) {
	request("http://127.0.0.1:" + networkPort + "/medicinesearch?search=" + encodeURIComponent(task.term) + "", {'auth': {'user': secretSettings.admin.basicAuthId,'pass': secretSettings.admin.basicAuthPassword,'sendImmediately': true}}, function (error, response, body) {
		
		counter++;
		intervalCounter++;
		
		if ((counter % 100) === 0) {
			console.log(counter + " terms processed");
		}

		if (!error && response.statusCode == 200) {
			//requestResult = JSON.parse(body);
		} else if (error) {
			console.log(error);
			console.log(task.term);
		} else {
			console.log("Status code: " + response.statusCode);
		}
		callback(null, task.term);
	});
}, 1);

//When all the searches have finished
searchQueue.drain = function() {
	
	clearInterval(interval);

	console.log("Finished, processed " + counter + " items.")
	
}

var searchTerms = JSON.parse(fs.readFileSync(__dirname + "/productSearchTerms.json"), "utf8");

console.log("Sending requests for " + searchTerms.length + " search terms...");

//Iterate terms and add to queue
for (var i = searchTerms.length - 1; i >= 0; i--) {
	var term = searchTerms[i];

	if (term.length > 32) {
		term = term.substr(0, 32);
	}
	
	//Add item to the queue
	searchQueue.push({index: i, term: term}, function (err, term) {
		//Callback when a request has finished
		
		if (err) {
			console.log(err);
		} else {
			//console.log("Finished " + term);
		}
	});
}
