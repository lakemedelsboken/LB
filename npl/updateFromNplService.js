var cronJob = require('cron').CronJob;
var spawn = require('child_process').spawn;
var async = require("async");

var job = new cronJob({
	cronTime: '00 00 04 * * *',
	onTick: function() {
		// Runs every day at 04:00:00 AM.
		updateFromNpl();
	},
	start: true
});
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
		callback();
	});	
}

function updateFromNpl() {
	console.log("Updating data from NPL");
	async.series([
		//fetch
		function(callback){
			run(__dirname + "/fetch.js", function() {
				callback(null);
			});	
		},
		//buildATCTree
		function(callback){
			run(__dirname + "/buildATCTree.js", function() {
				callback(null);
			});	
		},
		//parseProducts
		function(callback){
			run(__dirname + "/parseProducts.js", function() {
				callback(null);
			});	
		},
		//Wait, check queue of foundUpdates.json
		function(callback){
			//TODO: Implement wait
			callback(null);
		},
		//addProductsToATCTree
		function(callback){
			run(__dirname + "/addProductsToATCTree.js", function() {
				callback(null);
			});	
		},
		//replaceATCTree
		function(callback){
			run(__dirname + "/replaceATCTree.js", function() {
				callback(null);
			});	
		},
		
		],
		// optional callback
		function(err, results){
			console.log("Done with updating from NPL.")
		});
}



