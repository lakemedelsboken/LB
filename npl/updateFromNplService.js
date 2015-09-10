var cronJob = require('cron').CronJob;
var spawn = require('child_process').spawn;
var async = require("async");

var contentProviders = require("./content-providers/contentProviders.js");

var job = new cronJob({
	cronTime: '00 00 04 * * *',
	onTick: function() {
		// Runs every day at 04:00:00 AM.
		updateFromNpl();
	},
	start: true
});

//var aplJob = new cronJob({
//	cronTime: '00 00 01 * * 6',
//	onTick: function() {
//		// Runs every saturday at 01:00:00 AM.
//		updateFromAPL();
//	},
//	start: true
//});

//Initial run,
updateFromNpl();

function run(cmd, callback) {
	console.log("* Running " + cmd);

	var handle = spawn("node", [cmd]);

	handle.stdout.on('data', function (data) {
		console.log("\t" + data.toString().replace("\n", ""));
	});

	handle.stderr.on('data', function (data) {
		if (/^execvp\(\)/.test(data)) {
			console.log('Failed to start child process.');
		}
		console.log('stderr: ' + data);
	});

	handle.on('close', function (code) {
		console.log("* " + cmd + ' finished with code: ' + code);
		if (code !== 0) {
			callback(new Error("Something went wrong."));
		} else {
			callback();
		}
	});
}

function updateFromNpl(callback) {
	console.log("Updating data from NPL");
	async.series([
		//fetch
		function(callback){

			console.log("* Fetching npl database...")
			var handle = spawn("./_fetch.sh", [], {cwd: __dirname});

			handle.stdout.on('data', function (data) {
				//console.log("\t" + data.toString().replace("\n", ""));
			});

			handle.stderr.on('data', function (data) {
				if (/^execvp\(\)/.test(data)) {
					console.log('Failed to start child process.');
				}
				//console.log('stderr: ' + data);
			});

			handle.on('close', function (code) {
				console.log("* Finished fetching xml");
				callback(null);
			});

		},
		//buildATCTree
		function(callback){
			run(__dirname + "/buildATCTree.js", function(err) {
				callback(err);
			});
		},
		//parseDocumentLinks
		function(callback){
			run(__dirname + "/parseDocumentLinks.js", function(err) {
				callback(err);
			});
		},
		//parseProducts
		function(callback){
			run(__dirname + "/parseProducts.js", function(err) {
				callback(err);
			});
		},
		//Wait, check queue of foundUpdates.json
		function(callback){
			//TODO: Implement wait for fetchUpdates to finish
			console.log("Waiting 10 seconds...")
			setTimeout(function() {
				callback(null);
			}, 10000)
		},
		//addProductsToATCTree
		function(callback){
			run(__dirname + "/addProductsToATCTree.js", function(err) {
				callback(err);
			});
		},
		//replaceATCTree
		function(callback){
			run(__dirname + "/replaceATCTree.js", function(err) {
				callback(err);
			});
		},
		//Fetch data from all content providers except FASS.
		function(callback){
			contentProviders.fetch(callback);
		},
		//TODO: Wait, check queue of foundUpdates.json
		function(callback){
			console.log("Waiting 20 seconds...");
			setTimeout(function() {
				callback(null);
			}, 20000)
		},
		//Create search terms
		function(callback){
			run(__dirname + "/../fass/createSearchTerms.js", function(err) {
				callback(err);
			});
		},
		//Create populated searches
		function(callback){
			run(__dirname + "/../fass/createPopulatedSearches.js", function(err) {
				callback(err);
			});
		},

	],
	//Last
	function(err, results){
		if (err) {
			console.log(err);

		} else {
			console.log("Done with updating from NPL.")
		}

		//Optional callback
		if (callback !== undefined) {
			return callback(err);
		}
	});
}
