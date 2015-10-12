var cronJob = require('cron').CronJob;
var fs = require("fs-extra");
var path = require("path");
var lineReader = require('line-reader');
var spawn = require('child_process').spawn;

var job = new cronJob({
	cronTime: '00 00 10 * * *',
	onTick: function() {
		// Runs every day at 10:00:00 AM.

		run(function(err, message) {
			if (err) {
				console.error(err);
			} else {
				console.log(message);
			}
		});
	},
	start: true
});

function run(callback) {

	findLog(function(err, logPath) {
		if (err) {
			return callback(err);
		}
		splitLog(logPath, function(err, logPaths) {
			if (err) {
				return callback(err);
			}
			
			sendLogs(logPaths, function(err) {
				if (err) {
					return callback(err);
				} else {
					return callback(null, "Finished sending logs to piwik")
				}
				
			});
		});
	});
	
}

function findLog(callback) {

	//Find a file named access.log-YYYY-MM-DD with todays date on it
	var expectedLogFileName = "access.log-" + new Date().toISOString().slice(0, 10);
	
	console.log("Looking for log named: " + expectedLogFileName);

	var logsDirPath = "/var/log/nginx/";

	if (!fs.existsSync(logsDirPath)) {
		return callback(new Error("Dir: " + logsDirPath + " does not exist."));
	}

	var expectedLogFilePath = path.join(logsDirPath, expectedLogFileName);
	
	if (!fs.existsSync(expectedLogFilePath)) {
		return callback(new Error("File: " + expectedLogFilePath + " does not exist."));
	}

	callback(null, expectedLogFilePath);

}

function splitLog(logPath, callback) {

	var regular = 0;
	var api = 0;
	var undef = 0;
	var total = 0;

	var outputLogsDir = path.join(__dirname, "logs");
	
	fs.ensureDirSync(outputLogsDir);

	var apiLogFilePath = path.join(outputLogsDir, "api-" + new Date().toISOString().slice(0, 10) + ".log");
	var regularLogFilePath = path.join(outputLogsDir, "regular-" + new Date().toISOString().slice(0, 10) + ".log");

	var apiStream = fs.createWriteStream(apiLogFilePath);
	var regularStream = fs.createWriteStream(regularLogFilePath);

	lineReader.eachLine(logPath, function(line, last) {

		total++;
		
		var url = undefined;
		
		if (line.indexOf("\"GET ") > -1) {
			url = line.split("\"GET ")[1];
			url = url.split("\"")[0];
		}

		if (url !== undefined) {
			if (url.indexOf("/api/v") === 0) {
				api++;
				apiStream.write(line + "\n");
			} else {
				regular++;
				regularStream.write(line + "\n");
			}
		} else {
			undef++;
			regularStream.write(line + "\n");
		}

/*
		if ((total % 10000) === 0) {
			console.log("regular: " + regular);
			console.log("api: " + api);
			console.log("undef: " + undef);
			console.log("total: " + total);
			console.log("");
		}
*/

		if (last) {
			apiStream.end();
			regularStream.end();

			console.log("Regular: " + regular);
			console.log("API: " + api);
			console.log("Undef: " + undef);
			console.log("Total: " + total);

			callback(null, {regular: regularLogFilePath, api: apiLogFilePath});
		}
	});	
}

function sendLogs(logPaths, callback) {

	sendFile(logPaths.api, function(err) {
		if (err) {
			return callback(err);
		} else {
			sendFile(logPaths.regular, function(err) {
				if (err) {
					return callback(err);
				} else {
					
					//Delete used log files
					fs.unlinkSync(logPaths.api);
					fs.unlinkSync(logPaths.regular)
					
					return callback();
				}
			});
		}
	});
	
}

function sendFile(filePath, callback) {

	var hasExited = false;
	
	console.log("Sending: " + filePath);

	var baseName = path.basename(filePath);

	var rsync = spawn('rsync', ['-z', filePath, 'root@staging.lakemedelsboken.se:/var/log/nginx/incoming/' + baseName]);

	rsync.stdout.on('data', function (data) {
		console.log('stdout: ' + data);
	});

	rsync.stderr.on('data', function (data) {
		console.log('stderr: ' + data);
	});

	rsync.on('close', function (code) {
		if (code !== 0) {
			console.log('Child process exited with code ' + code);
		}

		if (!hasExited) {
			hasExited = true;
			callback();
		}
	});	

	rsync.on('error', function (err) {

		console.log('Child process exited with err ', err);

		if (!hasExited) {
			hasExited = true;
			callback(err);
		}
	});	

}