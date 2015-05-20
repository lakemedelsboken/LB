var fs = require("fs");
var path = require("path");
var dateFormat = require("dateformat");
var wrench = require("wrench");
var historyModel = require("./historymodel");

var FileModel = {
	baseDir: path.normalize(path.join(__dirname, "..", "content")),
	removeFile: function(filePath, callback) {

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