var cheerio = require("cheerio");
var fs = require("fs");
var Q = require('q');
var urlParser = require("url");
var request = require('request');
var auth = require('./authenticationService');

var isUpdating = false;
var foundUpdatesPath = __dirname + "/shared/foundUpdates.json";
var foundUpdatesTempPath = __dirname + "/shared/foundUpdatesFindLock.json";


var secretSettingsPath = __dirname + "/../settings/secretSettings.json";

// Check id the settings file exists.
if (!fs.existsSync(secretSettingsPath)) {
	console.error("Config file [" + secretSettingsPath + "] missing!");
	console.error("Did you forget to run `make decrypt_conf`?");
	process.exit(1);
}


// Check if the settings file is up to date.
(function() {
	var conf_time = fs.statSync(secretSettingsPath).mtime.getTime();
	var cast5_time = fs.statSync(secretSettingsPath + ".cast5").mtime.getTime();

	if (conf_time < cast5_time) {
		console.error("Your config file is out of date!");
		console.error("You need to run `make decrypt_conf` to update it.");
		process.exit(1);
	}
})();

// Read the settings file
var secretSettings = JSON.parse(fs.readFileSync(secretSettingsPath, "utf8"));
var fassUsername = secretSettings.fass.username;
var fassPassword = secretSettings.fass.password;

//Check if there is any updates from fass every 10 minutes.
var updateInterval = 1000 * 60 * 10;
setInterval(function() {
	findUpdates();
}, updateInterval)

findUpdates();


// This method checks for updates.
function findUpdates() {
	if (isUpdating) {
		console.log("Update already in progress.");
		return;
	}

	isUpdating = true;

	//Create correct dates
	var currentDate = new Date();

	// Get shared/foundUpdates.json
	var oldUpdates = JSON.parse(fs.readFileSync(foundUpdatesPath, "utf8"));

	// The the date from the shared/foundUpdates.json
	var fromDate = oldUpdates[0].time;
	console.log("From: " + fromDate);
	console.log("To: " + formatDate(currentDate));




	auth.login(fassUsername, fassPassword)
	.then(checkForFassUpdates)
	.then(parseResponseAndSave)
	.then(auth.logout);





	function checkForFassUpdates(ticket) {
		var deferred = Q.defer();

		var options = {
			url: 'https://www.fass.se/rest/fassdocument/updated?version=1.0&fromDate='+fromDate+'&toDate='+formatDate(currentDate) ,
			headers: {
				'ticket': ticket
			}
		};

		request(options, function (error, response, body) {
			deferred.resolve(body);
		}).on('error', function (e) {
			deferred.reject(e);
		});

		return deferred.promise
	}




	function parseResponseAndSave(response) {
		response = response.replace(/ns0\:documentInfo/g, "result");
		response = response.replace(/ns0\:id/g, "nplid");

		var nplIds = [];
		var $ = cheerio.load(response, {xmlMode: true});
		var results = $("result");

		results.each(function(index, result) {
			nplId = $(result).children()['0'].children[0].data;

			if (nplId !== "") {
				nplIds.push(nplId);
			}
		});

		if (nplIds.length > 0) {
			console.log("Found " + nplIds.length + " updates.");
			//Add to oldUpdates
			oldUpdates = oldUpdates.concat(nplIds);

			//Update time
			oldUpdates[0].time = formatDate(currentDate);

			//Save to shared/foundUpdates.json
			fs.writeFileSync(foundUpdatesTempPath, JSON.stringify(oldUpdates, null, "\t"), "utf8");
			fs.renameSync(foundUpdatesTempPath, foundUpdatesPath);

			isUpdating = false;

		} else {
			console.log("No updates since last check.");

			//Update time
			oldUpdates[0].time = formatDate(currentDate);

			//Save to shared/foundUpdates.json
			fs.writeFileSync(foundUpdatesTempPath, JSON.stringify(oldUpdates, null, "\t"), "utf8");
			fs.renameSync(foundUpdatesTempPath, foundUpdatesPath);

			isUpdating = false;
		}
	}

}


function formatDate(time) {
	var month = (time.getMonth() + 1).toString();
	if (month.length === 1) {
		month = "0" + month;
	}
	var days = time.getDate().toString();
	if (days.length === 1) {
		days = "0" + days;
	}
	var hours = time.getHours().toString();
	if (hours.length === 1) {
		hours = "0" + hours;
	}
	var minutes = time.getMinutes().toString();
	if (minutes.length === 1) {
		minutes = "0" + minutes;
	}
	var newTime = time.getFullYear() + "-" + month + "-" + days + " " + hours + ":" + minutes;
	return newTime;
}
