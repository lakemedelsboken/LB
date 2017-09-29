var fs = require("fs-extra");
var path = require("path");
var dateFormat = require("dateformat");
var wrench = require("wrench");

var FileModel = {
	baseDir: path.normalize(path.join(__dirname, "..", "content")),
	publishFile: function(filePath, callback) {

		console.log("FileModel.publishFile: " + filePath);

		var draftFilePath = path.join(FileModel.baseDir, "..", "output", "draft", filePath);

		if (!fs.existsSync(draftFilePath)) {
			return callback(new Error(draftFilePath + " does not exist."));
		}

		var publishedFilePath = path.join(FileModel.baseDir, "..", "output", "published", filePath);

		var publishedFileDirPath = path.dirname(publishedFilePath);

		console.log("Publish file from: " + draftFilePath + " to " + publishedFilePath)
		
		fs.ensureDirSync(publishedFileDirPath);
		
		//callback();
		fs.copySync(draftFilePath, publishedFilePath);
		
		callback();

	},
	unpublishFile: function(filePath, callback) {

		console.log("FileModel.unpublishFile: " + filePath);

		var publishedFilePath = path.join(FileModel.baseDir, "..", "output", "published", filePath);

		if (!fs.existsSync(publishedFilePath)) {
			return callback(new Error(publishedFilePath + " does not exist."));
		}
		
		fs.unlink(publishedFilePath, callback);
		
	},
	removeFile: function(filePath, callback) {

		console.log("FileModel.removeFile: " + filePath);

		filePath = unescape(filePath);

		if (typeof filePath !== "string") {
			return callback(new Error("File path: " + filePath + " is not a string."));
		}
		
		var fullPath = path.join(FileModel.baseDir, filePath);

		if (!fs.existsSync(fullPath)) {
			return callback(new Error(filePath + " does not exist."));
		}
		
		if (!fs.statSync(fullPath).isFile()) {
			return callback(new Error(filePath + " is not a file"));
		}
		
		//Remove from draft
		var draftPath = path.join(__dirname, "..", "output", "draft", filePath);
		if (fs.existsSync(draftPath)) {
			fs.unlinkSync(draftPath);
		}

		//Remove from published
		var publishedPath = path.join(__dirname, "..", "output", "published", filePath);
		if (fs.existsSync(publishedPath)) {
			fs.unlinkSync(publishedPath);
		}

		//Remove from content tree
		fs.unlink(fullPath, callback);

	}
}

module.exports = FileModel;