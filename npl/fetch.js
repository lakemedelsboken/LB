var fs = require("fs");
var exec = require("child_process").execFile;


module.exports.fetch = fetch = function() {
	console.log("Downloading and unpacking npl database...");
	child = exec('./_fetch.sh', function (err, stdout, stderr) {
		//console.log('stdout: ' + stdout);
		//console.log('stderr: ' + stderr);
		if (err) {
			console.log('Exec error: ' + err);
		} else {
			console.log("Finished");
		}
	});
}

fetch();