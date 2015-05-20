var path = require("path");
var fs = require("fs-extra");
var dateFormat = require("dateformat");
var crypto = require("crypto");

var HistoryModel = {
	baseDir: path.normalize(path.join(__dirname, "..", "content")),
	getPublished: function(filePath) {

		console.log("HistoryModel.getPublished: " + filePath);

		filePath = path.resolve(filePath);
		
		if (!fs.existsSync(filePath)) {
			throw new Error("File does not exist at: " + filePath + ", could not get published versions");
			//return callback(new Error("File does not exist at: " + filePath + ", could not get published versions"));
		}
		
		var fileStat = fs.statSync(filePath);
		
		if (!fileStat.isFile()) {
			return callback(new Error(filePath + " is not a file, could not get published versions"));
		}
		
		var pathParts = filePath.split(path.sep);
		
		var fileName = pathParts[pathParts.length - 1];
		var basePath = path.dirname(filePath);
		var publishedDirPath = path.join(basePath, ".published." + fileName);
		
		if (!fs.existsSync(publishedDirPath)) {
			//No previous published versions
			return [];
		}
		
		var files = fs.readdirSync(publishedDirPath);
		var publishedVersions = [];
		
		for (var i = 0; i < files.length; i++) {
			if (files[i].indexOf(".published") > -1) {
				var timeStamp = parseInt(files[i].replace(".published", ""));
				var fullPath = path.join(publishedDirPath, files[i]);
				var contentHash = HistoryModel.getContentHash(fullPath);
				var id = fullPath.replace(HistoryModel.baseDir, "");
				if (contentHash !== null) {
					publishedVersions.push({id: id, path: fullPath, contentHash: contentHash, name: files[i], time: timeStamp, niceTime: dateFormat(new Date(timeStamp), "yyyy-mm-dd HH:MM:ss")});
				}
			}
		}
		
		//Sort snapshots descending
		publishedVersions.sort(function(a, b) {
			return b.time - a.time;
		});
		
		return publishedVersions;
		
	},
	getSnapshots: function(filePath, callback) {

		console.log("HistoryModel.getSnapshots: " + filePath);

		filePath = path.resolve(filePath);
		
		if (!fs.existsSync(filePath)) {
			return callback(new Error("File does not exist at: " + filePath + ", could not get snapshots"));
		}
		
		var fileStat = fs.statSync(filePath);
		
		if (!fileStat.isFile()) {
			return callback(new Error(filePath + " is not a file, could not get snapshots"));
		}
		
		var pathParts = filePath.split(path.sep);
		
		var fileName = pathParts[pathParts.length - 1];
		var basePath = path.dirname(filePath);
		var snapshotsDirPath = path.join(basePath, ".snapshots." + fileName);
		
		if (!fs.existsSync(snapshotsDirPath)) {
			return callback(new Error(filePath + " has no previous snapshots"));
		}
		
		fs.readdir(snapshotsDirPath, function(err, files) {
			if (err) {
				return callback(err);
			}
			
			var snapshots = [];
			
			for (var i = 0; i < files.length; i++) {
				if (files[i].indexOf(".snapshot") > -1) {
					var timeStamp = parseInt(files[i].replace(".snapshot", ""));
					var fullPath = path.join(snapshotsDirPath, files[i]);
					var contentHash = HistoryModel.getContentHash(fullPath);
					var id = fullPath.replace(HistoryModel.baseDir, "");
					snapshots.push({id: id, path: fullPath, contentHash: contentHash, name: files[i], time: timeStamp, niceTime: dateFormat(new Date(timeStamp), "yyyy-mm-dd HH:MM:ss")});
				}
			}
			
			//Sort snapshots descending
			snapshots.sort(function(a, b) {
				return b.time - a.time;
			});
			
			//console.log(snapshots);
			callback(null, snapshots);
		});
		
	},
	createSnapshot: function(filePath, callback) {

		filePath = path.resolve(filePath);
		
		console.log("HistoryModel.createSnapshot: " + filePath);
		
		if (!fs.existsSync(filePath)) {
			return callback(new Error("File does not exist at: " + filePath + ", could not create snapshot"));
		}
		
		var fileStat = fs.statSync(filePath);
		
		if (!fileStat.isFile()) {
			return callback(new Error(filePath + " is not a file, could not create snapshot"));
		}
		
		var pathParts = filePath.split(path.sep);
		
		var fileName = pathParts[pathParts.length - 1];
		var basePath = path.dirname(filePath);
		var snapshotsDirPath = path.join(basePath, ".snapshots." + fileName);
		
		if (!fs.existsSync(snapshotsDirPath)) {
			console.log("Create dir: " + snapshotsDirPath);
			fs.mkdirSync(snapshotsDirPath);
		} else {
			//console.log(snapshotsDirPath + " already exists.");
		}

		var snapshotName = new Date().getTime().toString() + ".snapshot";
		var snapshotPath = path.join(snapshotsDirPath, snapshotName);

		//Copy the old file into the snapshot
		HistoryModel.copyFile(filePath, snapshotPath, callback);

	},
	publishPage: function(pagePath, callback) {

		console.log("HistoryModel.publishPage: " + pagePath);

		filePath = path.resolve(path.join(HistoryModel.baseDir, pagePath));
		
		//console.log("Trying to publish: " + filePath);
		
		if (!fs.existsSync(filePath)) {
			return callback(new Error("File does not exist at: " + filePath + ", could not create published version"));
		}
		
		var fileStat = fs.statSync(filePath);
		
		if (!fileStat.isFile()) {
			return callback(new Error(filePath + " is not a file, could not create published version"));
		}
		
		var pathParts = filePath.split(path.sep);
		
		var fileName = path.basename(filePath)
		var basePath = path.dirname(filePath);
		var publishedDirPath = path.join(basePath, ".published." + fileName);
		
		if (!fs.existsSync(publishedDirPath)) {
			console.log("Create dir: " + publishedDirPath);
			fs.mkdirSync(publishedDirPath);
		} else {
			//console.log(publishedDirPath + " already exists.");
		}

		var publishedName = new Date().getTime().toString() + ".published";
		var publishedPath = path.join(publishedDirPath, publishedName);

		//Copy the old file to the published 
		HistoryModel.copyFile(filePath, publishedPath, callback);
	},
	unpublishPage: function(pagePath, callback) {

		filePath = path.resolve(path.join(HistoryModel.baseDir, pagePath));
		
		console.log("HistoryModel.unpublishPage: " + filePath);
		
		if (!fs.existsSync(filePath)) {
			return callback(new Error("File does not exist at: " + filePath + ", could not unpublish"));
		}
		
		var fileStat = fs.statSync(filePath);
		
		if (!fileStat.isFile()) {
			return callback(new Error(filePath + " is not a file, could not unpublish"));
		}
		
		var pathParts = filePath.split(path.sep);
		
		var fileName = path.basename(filePath)
		var basePath = path.dirname(filePath);
		var publishedDirPath = path.join(basePath, ".published." + fileName);
		
		if (fs.existsSync(publishedDirPath)) {
			//console.log("Create dir: " + publishedDirPath);
			//fs.mkdirSync(publishedDirPath);
		} else {
			//console.log(publishedDirPath + " already exists.");
		}

		//var publishedName = new Date().getTime().toString() + ".published";
		//var publishedPath = path.join(publishedDirPath, publishedName);

		//Copy the old file to the published 
		//HistoryModel.copyFile(filePath, publishedPath, callback);
		
		callback();
		
	},
	copyFile: function(source, target, callback) {

		console.log("HistoryModel.copyFile source:" + source + ", target: " + target);

		fs.copy(source, target, callback);

	},
	contentHashes: {},
	getContentHash: function(filePath) {

		if (HistoryModel.contentHashes[filePath] !== undefined) {
			return HistoryModel.contentHashes[filePath];
		} else {

			console.log("HistoryModel.getContentHash: " + filePath);
			
			var content = fs.readFileSync(filePath, "utf8");

			if (content.length === 0) {
				fs.unlinkSync(filePath);
				return null;
			}

			try {
				content = JSON.parse(content);
			} catch (err) {
				//Corrupt info, destroy
				fs.unlinkSync(filePath);
				return null;
			}
			
			//Remove isPublished from equation
			if (content.hasOwnProperty("isPublished")) {
				delete content.isPublished;
			}
			content = JSON.stringify(content, null, "");
			
			var contentHash = HistoryModel.getChecksum(content);
			
			HistoryModel.contentHashes[filePath] = contentHash;
			return contentHash;
		}
		
	},
	getChecksum: function(str, algorithm, encoding) {
		return crypto
			.createHash(algorithm || 'md5')
			.update(str, 'utf8')
			.digest(encoding || 'hex');
	}
	
};

module.exports = HistoryModel;
