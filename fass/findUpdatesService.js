var cheerio = require("cheerio");
var fs = require("fs");
var urlParser = require("url");
var http = require("http");

var isUpdating = false;
var foundUpdatesPath = __dirname + "/shared/foundUpdates.json";

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

var fassUserId = secretSettings.fass.fassUserId;

//Ten minutes
var updateInterval = 1000 * 60 * 10;

setInterval(function() {
	findUpdates();
}, updateInterval)

findUpdates();

function findUpdates() {

	if (isUpdating) {
		console.log("Update already in progress.");
		return;
	}
	
	isUpdating = true;
	
	//Create correct dates
	var currentDate = new Date();
	var oldUpdates = JSON.parse(fs.readFileSync(foundUpdatesPath, "utf8"));

	var previousDate = oldUpdates[0].time;

	console.log("From: " + previousDate);
	console.log("To: " + formatDate(currentDate));

	var productInfoEnvelope = "<env:Envelope xmlns:env=\"http://schemas.xmlsoap.org/soap/envelope/\"><env:Header /><env:Body><getUpdatedDocumentsElement xmlns=\"http://webservice.usersys.fass.lif.se/\"><fromDate>{FROMDATE}</fromDate><toDate>{TODATE}</toDate><userId>{USERID}</userId></getUpdatedDocumentsElement></env:Body></env:Envelope>";

	productInfoEnvelope = productInfoEnvelope.replace("{FROMDATE}", previousDate);
	productInfoEnvelope = productInfoEnvelope.replace("{TODATE}", formatDate(currentDate));

	productInfoEnvelope = productInfoEnvelope.replace("{USERID}", fassUserId);

	requestSoapData("http://www.fass.se/LIF/FassDocumentWebService?WSDL", productInfoEnvelope, function(err, answer) {

		if (answer !== undefined) {

			answer = answer.replace(/ns0\:result/g, "result");
			answer = answer.replace(/ns1\:result/g, "result");
			answer = answer.replace(/ns2\:result/g, "result");
			answer = answer.replace(/ns0\:nplId/g, "nplid");
			answer = answer.replace(/ns1\:nplId/g, "nplid");
			answer = answer.replace(/ns2\:nplId/g, "nplid");

			var $ = cheerio.load(answer, {xmlMode: true});

			var results = $("result");
			var nplIds = [];

			results.each(function(index, result) {
				var nplId = $($(result).children()[1]).text().trim();

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
				fs.writeFileSync(foundUpdatesPath, JSON.stringify(oldUpdates, null, "\t"), "utf8");
			
				isUpdating = false;
			
			} else {
				console.log("No updates since last check.");
			
				//Update time
				oldUpdates[0].time = formatDate(currentDate);

				//Save to shared/foundUpdates.json
				fs.writeFileSync(foundUpdatesPath, JSON.stringify(oldUpdates, null, "\t"), "utf8");

				isUpdating = false;
			}
			
		} else {
			console.log("Unable to get answer from Fass.");
			isUpdating = false;
		}

	});
}

function requestSoapData(url, xmlDoc, callback) {

	url = urlParser.parse(url);
	var responseXml = [];

	var options = {
	  host: url.host,
	  port: 80,
	  path: url.pathname + url.search,
	  method: 'POST',
	  headers: {"Content-Type": "text/xml"}
	};
	
	var req = http.request(options, function(res) {
		res.on('data', function (chunk) {
			responseXml.push(chunk);
		});
		res.on("end", function() {
			req = null;
			res = null;
			//Success
			callback(null, responseXml.join(""));
		});
		res.on("error", function(err) {
			req = null;
			res = null;
			callback(err);
		});
	});

	req.on("error", function(err) {
	    if (err.code === "ECONNRESET") {
			callback(new Error("Timeout for: " + url + " with data: " + xmlDoc));
	    } else {
	    	callback(err);
	    }
	});	

	req.write(xmlDoc);
	req.end();	
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
