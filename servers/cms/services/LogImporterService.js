var cronJob = require("cron").CronJob;
var fs = require("fs-extra");
var path = require("path");
var lineReader = require("line-reader");
var spawn = require("child_process").spawn;
var async = require("async")

var job = new cronJob({
	cronTime: '00 00 11 * * *',
	onTick: function() {
		// Runs every day at 11:00:00 AM.

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

run(function(err, message) {
	if (err) {
		console.error(err);
	} else {
		console.log(message);
	}
});

function run(callback) {

	findLogs(function(err, foundLogs) {
		if (err) {
			return callback(err);
		}

		splitLogs(foundLogs, function(err, splittedLogs) {
			if (err) {
				return callback(err);
			}

			//Move found logs to processed dir
			fs.ensureDirSync("/var/log/nginx/processed/");

			async.eachSeries(foundLogs, function(item, callback) {

				fs.rename(item, "/var/log/nginx/processed/" + path.basename(item), callback);

			}, function(err) {

				if (err) {
					return callback(err);
				}

				//Import the splitted log files
				async.eachSeries(splittedLogs, function(item, callback) {
					importRegularLogFile(item.regular, function(err) {
						if (err) {
							return callback(err);
						}

						fs.unlinkSync(item.regular);

						importApiLogFile(item.api, function(err) {
							if (err) {
								return callback(err);
							}

							fs.unlink(item.api, callback);

						});
					});
				}, function(err) {
					if (err) {
						return callback(err);
					}

					//Archive = pre process time periods
					archiveReports(function(err) {
						if (err) {
							return callback(err);
						}

						return callback(null, "Finished importing logs");

					});

				});

			});

		});
	});

}

function archiveReports(callback) {

	console.log("Archiving...");

	var hasExited = false;
	var archiver = spawn('/var/www/piwik/console', ["core:archive", "--force-all-websites", "--force-all-periods=315576000", "--force-date-last-n=7", "--url='http://service.lakemedelsboken.se/piwik/'"]);

	archiver.stdout.on('data', function (data) {
		console.log('stdout: ' + data);
	});

	archiver.stderr.on('data', function (data) {
		console.log('stderr: ' + data);
	});

	archiver.on('close', function (code) {
		if (code !== 0) {
			console.log('Child process exited with code ' + code);
		}

		if (!hasExited) {
			hasExited = true;
			callback();
		}
	});

	archiver.on('error', function (err) {

		console.log('Child process exited with err ', err);

		if (!hasExited) {
			hasExited = true;
			callback(err);
		}
	});

}

function importRegularLogFile(filePath, callback) {

	console.log("Importing " + filePath);

	var hasExited = false;
	var importer = spawn('python', ["/var/www/html/piwik/misc/log-analytics/import_logs.py", "--url=http://service.lakemedelsboken.se/piwik/", "--exclude-path='/fonts'", "--idsite=3", filePath]);

	importer.stdout.on('data', function (data) {
		console.log('stdout: ' + data);
	});

	importer.stderr.on('data', function (data) {
		console.log('stderr: ' + data);
	});

	importer.on('close', function (code) {
		if (code !== 0) {
			console.log('Child process exited with code ' + code);
		}

		if (!hasExited) {
			hasExited = true;
			callback();
		}
	});

	importer.on('error', function (err) {

		console.log('Child process exited with err ', err);

		if (!hasExited) {
			hasExited = true;
			callback(err);
		}
	});
ls
}

function importApiLogFile(filePath, callback) {

	console.log("Importing " + filePath);

	var hasExited = false;
	var importer = spawn('python', ["/var/www/html/piwik/misc/log-analytics/import_logs.py", "--url=http://service.lakemedelsboken.se/piwik/", "--idsite=4", filePath]);

	importer.stdout.on('data', function (data) {
		console.log('stdout: ' + data);
	});

	importer.stderr.on('data', function (data) {
		console.log('stderr: ' + data);
	});

	importer.on('close', function (code) {
		if (code !== 0) {
			console.log('Child process exited with code ' + code);
		}

		if (!hasExited) {
			hasExited = true;
			callback();
		}
	});

	importer.on('error', function (err) {

		console.log('Child process exited with err ', err);

		if (!hasExited) {
			hasExited = true;
			callback(err);
		}
	});

}

function findLogs(callback) {

	var logsDirPath = "/var/log/nginx/incoming/";

	if (!fs.existsSync(logsDirPath)) {
		return callback(new Error("Dir: " + logsDirPath + " does not exist."));
	}

	fs.readdir(logsDirPath, function(err, logFiles) {
		if (err) {
			return callback(err);
		}

		logFiles = logFiles.filter(function(item) {
			return (item.indexOf("access.log") === 0);
		});

		var zippedLogs = logFiles.filter(function(item) {
			return (path.extname(item) === ".gz");
		});

		zippedLogs = zippedLogs.map(function(item) {
			return path.join(logsDirPath, item);
		});

		logFiles = logFiles.map(function(item) {
			return path.join(logsDirPath, path.basename(item, ".gz"));
		});

		if (zippedLogs.length > 0) {

			unzipFiles(zippedLogs, function(err) {
				if (err) {
					return callback(err);
				}

				return callback(null, logFiles);
			});
		} else {
			return callback(null, logFiles)
		}

	});

}

function unzipFiles(filePaths, callback) {

	if (filePaths.length === 0) {
		return callback();
	}

	async.eachSeries(filePaths, unzipFile, callback);
}

function unzipFile(filePath, callback) {

	var hasExited = false;
	var gunzip = spawn('gunzip', [filePath]);

	gunzip.stdout.on('data', function (data) {
		console.log('stdout: ' + data);
	});

	gunzip.stderr.on('data', function (data) {
		console.log('stderr: ' + data);
	});

	gunzip.on('close', function (code) {
		if (code !== 0) {
			console.log('Child process exited with code ' + code);
		}

		if (!hasExited) {
			hasExited = true;
			callback();
		}
	});

	gunzip.on('error', function (err) {

		console.log('Child process exited with err ', err);

		if (!hasExited) {
			hasExited = true;
			callback(err);
		}
	});

}

function splitLogs(logPaths, callback) {
	async.mapSeries(logPaths, splitLog, callback);
}

function splitLog(logPath, callback) {

	console.log("Splitting " + logPath + "...");

	var regular = 0;
	var api = 0;
	var undef = 0;
	var total = 0;

	var outputLogsDir = path.join(__dirname, "logs");

	fs.ensureDirSync(outputLogsDir);

	var baseName = path.basename(logPath)

	var apiLogFilePath = path.join(outputLogsDir, "api-" + baseName + ".log");
	var regularLogFilePath = path.join(outputLogsDir, "regular-" + baseName + ".log");

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
			console.log("");

			callback(null, {regular: regularLogFilePath, api: apiLogFilePath});
		}
	});
}
