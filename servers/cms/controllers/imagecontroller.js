var fs = require("fs");
var path = require("path");
var imageModel = require("../models/imagemodel");
var wrench = require("wrench");
var im = require("imagemagick");
var async = require("async");
var exec = require('child_process').exec;

var ImageController = {
	baseDir: imageModel.baseDir,
	getContentTypes: function() {
		return imageModel.getContentTypes();
	},
	getContent: function(contentPath, callback) {

		imageModel.getContent(contentPath, callback);

	},
	setContent: function(contentPath, data, callback) {

		imageModel.setContent(contentPath, data, callback);

	},
	addContentItemToPage: function(contentType, pageId, callback) {
		imageModel.addContentItemToPage(contentType, pageId, callback);
	},
	removeContentItemFromPage: function(contentItemName, pageId, callback) {
		imageModel.removeContentItemFromPage(contentItemName, pageId, callback);
	},
	existsDir: function(contentPath, callback) {

		imageModel.existsDir(contentPath, callback);

	},
	existsContent: function(contentPath, callback) {

		imageModel.existsContent(contentPath, callback);

	},
	createImageSizes: function(originalImagePath, outputDir, forceOverwrite, callback) {

		if (!fs.existsSync(outputDir)) {
			//console.log("Create dir " + outputDir);
			wrench.mkdirSyncRecursive(outputDir);
		}

		function resizeImage(imagePath, maxWidth, extension, forceResize, callback) {

			var fileName = imagePath.split(path.sep);
			fileName = fileName[fileName.length - 1];
			
			var fileEnding = fileName.split(".");
			fileEnding = fileEnding[fileEnding.length - 1];
			
			var newDestination = path.join(outputDir, extension + "." + fileEnding); //imagePath.replace(".png", extension + ".png");

			if (fs.existsSync(newDestination) && !forceResize) {
				callback(null, "Skipped resize of " + newDestination);
			} else {
				im.identify(imagePath, function(err, features) {
					if (err) { return callback(err); }

					if (maxWidth > features.width) {
						maxWidth = features.width;
					}
					var newWidth = maxWidth;
					var newHeight = parseInt(features.height * (newWidth/features.width), 10);

					//Make sure image is not bigger than 1024*1024*3 for compatibility with iPod Touch 4 and iPhone 3GS
					var maxPixels = 1024*1024*3;

					if (extension.indexOf("_x2") > -1) {
						//Make sure image is not bigger than 1024*1024*5 for compatibility with retina devices
						var maxPixels = 1024*1024*5;
					}

					while((newWidth * newHeight) > maxPixels) {
						var ratio = newWidth / newHeight;
						var oldWidth = newWidth;
						newWidth = newWidth - 5;
						newHeight = parseInt(newHeight * (newWidth/oldWidth), 10);
					}

					im.convert([imagePath, '-resize', newWidth + 'x' + newHeight, 'PNG:' + newDestination], function(err, stdout) { //, "-colors", "256"
						if (err) { 
							return callback(err); 
						}

						var optImageDir = newDestination.split(path.sep);
						var newFileName = optImageDir.pop();
						optImageDir = path.join(optImageDir.join(path.sep), "opt");

						wrench.mkdirSyncRecursive(optImageDir);
				
						exec("pngnq -e .png -f -s 1 -d " + optImageDir + " " + newDestination, function (error, stdout, stderr) {
							//console.error('stdout: ' + stdout);
							//console.error('stderr: ' + stderr);
							if (error !== null) {

								console.error('exec error: ' + error);

							} else {
								
								exec("pngout -s2 -y " + optImageDir + "/" + newFileName, function (error, stdout, stderr) {

									if (error !== null) {
										console.error('exec error: ' + error);
									}

									callback(null, "Resized: " + imagePath + " to " + newWidth + "x" + newHeight + " at " + newDestination);
								});
							}
						});
					});
				});
			}
		};

		var forcedImageResizing = forceOverwrite;

		var newImagePath = originalImagePath;

		async.series([
			function(callback) {
				resizeImage(newImagePath, 300, "small", forcedImageResizing, function(err, result) {
					callback(err, result);
				});
			},
			function(callback) {
				resizeImage(newImagePath, 600, "small_x2", forcedImageResizing, function(err, result) {
					callback(err, result);
				});
			},
			function(callback) {
				resizeImage(newImagePath, 524, "medium", forcedImageResizing, function(err, result) {
					callback(err, result);
				});
			},
			function(callback) {
				resizeImage(newImagePath, 1048, "medium_x2", forcedImageResizing, function(err, result) {
					callback(err, result);
				});
			},
			function(callback) {
				resizeImage(newImagePath, 740, "large", forcedImageResizing, function(err, result) {
					callback(err, result);
				});
			},
			function(callback) {
				resizeImage(newImagePath, 1480, "large_x2", forcedImageResizing, function(err, result) {
					callback(err, result);
				});
			},
			function(callback) {
				resizeImage(newImagePath, 970, "huge", forcedImageResizing, function(err, result) {
					callback(err, result);
				});
			},
			function(callback) {
				resizeImage(newImagePath, 1940, "huge_x2", forcedImageResizing, function(err, result) {
					callback(err, result);
				});
			}
		], function(err, results) {
			callback(err, results)
		});
		
	},
	getEditors: function(content) {
		
		var contentEditors = [];
		
		if (content && content.length > 0) {
			for (var i = 0; i < content.length; i++) {
				var item = content[i];
				var contentViews = imageModel.getContentTypes()[item.type];
				if (contentViews !== undefined) {
					contentEditors.push(contentViews.getEditor(item));
				} else {
					console.log("No views exist for content type: " + item.type);
				}
			
			}
		} 
		
		return contentEditors;
	},
	getPreviews: function(content) {
		
		var contentPreviews = [];
		
		if (content && content.length > 0) {
			for (var i = 0; i < content.length; i++) {
				var item = content[i];
				var contentViews = imageModel.getContentTypes()[item.type];
				if (contentViews !== undefined) {
					contentPreviews.push(contentViews.getOutput(item));
				} else {
					console.log("No views exist for content type: " + item.type);
				}
			
			}
		} 
		
		return contentPreviews;
	},
	findEditableItemByName: function(key, list) {
		for (var i = 0; i < list.length; i++) {
			if (list[i].name === key) {
				return list[i];
			}
		}
		return undefined;
	},
	mkdir: function(dirName, baseDir, callback) {
		imageModel.mkdir(dirName, baseDir, callback);
	},
	rmdir: function(dirName, callback) {
		imageModel.rmdir(dirName, callback);
	},
	createPage: function(pageName, baseDir, callback) {
		imageModel.createPage(pageName, baseDir, callback);
	},
	removeImage: function(imagePath, callback) {
		imageModel.removeImage(imagePath, callback);
	},
	rename: function(before, after, callback) {
		imageModel.rename(before, after, callback);
	},
	getAllImages: function(callback) {
		imageModel.getAllImages(callback);
	}
};

module.exports = ImageController;