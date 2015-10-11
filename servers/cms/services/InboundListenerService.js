var chokidar = require("chokidar");
var path = require("path");
var fs = require("fs-extra");
var dateFormat = require("dateformat");
var crypto = require("crypto");

var inboundPath = path.join(__dirname, "..", "payloads", "inbound");
var payloadPath = path.join(inboundPath, "payload.json");

var chokidarOptions = {
	persistent: true,
	ignoreInitial: true
};

var deploymentHasOcurred = false;
var deploymentInProgress = false;

console.log("Watching for updates to: " + payloadPath);

chokidar.watch(payloadPath, chokidarOptions).on("all", function(event, path) {

	if (!deploymentHasOcurred) {
		if (event === "change" || event === "add") {
			//console.log(event, path);
			deploymentHasOcurred = true;
			//Wait 10 seconds before deploying
			setTimeout(deployLastPublish, 10000);
		}
	}

});

function deployLastPublish() {
	deploymentHasOcurred = false;

	if (deploymentInProgress) {
		return;
	}
	
	deploymentInProgress = true;
	
	console.log("Deploying");
	
	var payload = JSON.parse(fs.readFileSync(payloadPath, "utf8"));
	
	//Iterate files and add to new output target

	var allFilesOk = true;
	
	//Check if everything seems ok
	console.log("Checking integrity of payload files...");
	payload.forEach(function(item) {
		if (item.hash === undefined) {
			console.log("No hash for: " + item.relativePath);
			allFilesOk = false;
		} else {
			var inboundFilePath = path.join(inboundPath, item.relativePath);
			
			//Check if file exists
			if (fs.existsSync(inboundFilePath)) {
				var fileHash = createHashSync(inboundFilePath);
				if (fileHash !== item.hash) {
					console.log("Hash differs for: " + item.relativePath);
					allFilesOk = false;
				}
			} else {
				console.log("File does not exist: " + item.relativePath);
				allFilesOk = false;
			}
		}
	});
	
	if (allFilesOk) {
		console.log("Integrity seems fine.");
	} else {
		console.log("Something went wrong.");
	}
	
	var dateDirName = dateFormat(new Date(), "yyyy-mm-dd-HHMMss");

	//Copy files in the payload to new deployment
	if (allFilesOk) {
		
		var deploymentDirPath = path.join(__dirname, "deployments", dateDirName);

		console.log("Copy payload files to: " + deploymentDirPath);

		fs.mkdirsSync(deploymentDirPath);

		payload.forEach(function(item) {
			var inboundFilePath = path.join(inboundPath, item.relativePath);
			var outFilePath = path.join(deploymentDirPath, item.relativePath);
			var dirPath = path.dirname(outFilePath);
			if (allFilesOk) {
				try {
					fs.mkdirsSync(dirPath);
				} catch(err) {
					console.log(err);
					allFilesOk = false;
				}
			}

			if (allFilesOk) {
				try {
					fs.copySync(inboundFilePath, outFilePath);
				} catch(err) {
					console.log(err);
					allFilesOk = false;
				}
			}
			
		});

		if (allFilesOk) {
			console.log("Done with copying of deployment files.");
		} else {
			console.log("Something went wrong.");
		}
		
	}
	
	
	//Archive old output
	if (allFilesOk) {
		
		var archiveDirPath = path.join(__dirname, "archives", dateDirName);
		var outputDirPath = path.join(__dirname, "..", "output");

		console.log("Archiving old output to " + archiveDirPath);
		
		try {
			fs.copySync(outputDirPath, archiveDirPath);
		} catch(err) {
			console.log(err);
			allFilesOk = false;
		}
		
		if (allFilesOk) {
			console.log("Done with archiving.");
		} else {
			console.log("Something went wrong.");
		}
	}
	
	//Remove old output
	if (allFilesOk) {
		console.log("Remove old output...");

		var outputDirPath = path.join(__dirname, "..", "output");
		
		try {
			fs.emptyDirSync(outputDirPath);
		} catch(err) {
			console.log(err);
			allFilesOk = false;
		}
		
		if (!allFilesOk) {
			//Revert back to the archived version
			console.log("Something went wrong when trying to remove old output, reverting to last published version...");
			var archiveDirPath = path.join(__dirname, "archives", dateDirName);
			var outputDirPath = path.join(__dirname, "..", "output");
			try {
				fs.copySync(archiveDirPath, outputDirPath);
			} catch(err) {
				//TODO: Fatal error, email
				console.log(err);
				allFilesOk = false;
			}
			
		} else {
			console.log("Done.");
		}
		
		
	}
	
	//Replace with new output
	if (allFilesOk) {
		console.log("Deploying last paylod as live version...");
		var deploymentDirPath = path.join(__dirname, "deployments", dateDirName);
		var outputDirPath = path.join(__dirname, "..", "output");

		try {
			fs.copySync(deploymentDirPath, outputDirPath);
		} catch(err) {
			console.log(err);
			allFilesOk = false;

			console.log("Something went wrong when trying to deploy new version, reverting to last published version...");
			var archiveDirPath = path.join(__dirname, "archives", dateDirName);
			var outputDirPath = path.join(__dirname, "..", "output");
			try {
				fs.copySync(archiveDirPath, outputDirPath);
			} catch(err) {
				//TODO: Fatal error, email
				console.log(err);
				allFilesOk = false;
			}
			
		}
		
	}
	
	if (allFilesOk) {
		console.log("Deployment is complete.");
	} else {
		console.log("Something went wrong during deployment");
	}
	
	deploymentInProgress = false;
}

function createHashSync(path) {
	
	var hash = crypto.createHash("md5");

	try {
		hash.update(fs.readFileSync(path));
	} catch (err) {
		return undefined;
	}

	return hash.digest("hex");
	
}
