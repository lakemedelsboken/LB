var cronJob = require('cron').CronJob;
var fs = require("fs-extra");
var path = require("path");
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
		sendFile(logPath, function(err) {
			if (err) {
				return callback(err);
			} else {
				return callback(null, "Finished sending log to piwik");
			}

		});
	});

}

function findLog(callback) {

	//Find a file named access.log-YYYY-MM-DD with todays date on it
	var expectedLogFileName = "access.log-" + new Date().toISOString().slice(0, 10);

	//TODO: Test file
	//expectedLogFileName = "access.log";

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

function sendFile(filePath, callback) {

	var hasExited = false;

	console.log("Sending: " + filePath);

	var baseName = path.basename(filePath);

	var rsync = spawn('rsync', ['-z', filePath, 'root@service.lakemedelsboken.se:/var/log/nginx/incoming/' + baseName]);

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
