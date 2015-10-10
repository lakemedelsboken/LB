var fs = require("fs");
var path = require("path");
var fileModel = require("../models/filemodel");

var FileController = {
	baseDir: fileModel.baseDir,
	removeFile: function(filePath, callback) {
		fileModel.removeFile(filePath, callback);
	},
	publishFile: function(filePath, callback) {
		fileModel.publishFile(filePath, callback);
	},
	unpublishFile: function(filePath, callback) {
		fileModel.unpublishFile(filePath, callback);
	}
};

module.exports = FileController;