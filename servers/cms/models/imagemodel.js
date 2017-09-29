var fs = require("fs");
var path = require("path");
var dateFormat = require("dateformat");
var contentModel = require("./contentmodel");
var filesize = require("filesize");
var im = require("imagemagick");
var async = require("async");
var wrench = require("wrench");

var ImageModel = {
	baseDir: path.normalize(path.join(__dirname, "..", "content")),
	_contentTypes: undefined,
	getContentTypes: function() {
		if (!ImageModel._contentTypes) {
			ImageModel._contentTypes = {};
			var folders = fs.readdirSync(__dirname + "/../contenttypes/");
			for (var i = 0; i < folders.length; i++) {
				ImageModel._contentTypes[folders[i]] = require(__dirname + "/../contenttypes/" + folders[i] + "/views");
			}
		}
		
		return ImageModel._contentTypes;
	},
	getContent: function(contentPath, callback) {
		ImageModel.existsContent(contentPath, function(err, contentExists) {

			if (err) {
				return callback(err, false);
			}

			if (!contentExists) {
				return callback(new Error("Content at: " + contentPath + " does not exist."))
			}
			
			var fullPath = path.join(ImageModel.baseDir, contentPath);
			
			var stat = fs.statSync(fullPath);
			
			if (stat.isDirectory()) {
				//Iterate files and return descriptions
				fs.readdir(fullPath, function(err, data) {
					if (err) {
						return callback(err);
					}

					var list = [];
				
					for (var i = 0; i < data.length; i++) {
						var fileName = data[i];
						var filePath = path.join(fullPath, fileName);
						var fileStat = fs.statSync(filePath);

						//File or dir item
						var item = {
							name: fileName,
							type: (fileStat.isDirectory()) ? "dir" : "file",
							path: filePath,
							relativePath: filePath.replace(ImageModel.baseDir, "")
						};
						
						if (item.name.indexOf(".json") > 0) {
							item.type = "page";
						}

						if (item.name.indexOf(".png") > 0) {
							item.type = "image";
						}
					
						//Exclude hidden files
						if (item.name.charAt(0) !== '.') {
							list.push(item);
						}
					}
				
					if (list.length > 0) {
						//Sort alphabetically
						list.sort(function(a, b){
							if(a.name < b.name) return -1;
							if(a.name > b.name) return 1;
							return 0;
						});
					
						//Sort dirs first
						list.sort(function(a, b){
							if(a.type === "dir" && b.type !== "dir") return -1;
							if(a.type !== "dir" && b.type === "dir") return 1;
							return 0;
						});

					}
				
					var result = {type: "dir", list: list};
				
					return callback(null, result);
				
				});
			} else if (stat.isFile()) {
				var fileName = contentPath.split(path.sep);
				fileName = fileName[fileName.length - 1];
				
				var result = {name: fileName, path: contentPath, draftpath: path.join("/cms/static/", contentPath), type: "image"};

				var regImages = [];
				var optImages = [];
				
				var regularImagesPath = path.join(__dirname, "..", "output", "static", contentPath);
				var regularImages = fs.readdirSync(regularImagesPath);

				for (var i = 0; i < regularImages.length; i++) {
					var name = regularImages[i];
					var filePath = path.join(regularImagesPath, name);
					var fileStat = fs.statSync(filePath);
					if (fileStat.isFile() && name.indexOf(".png") > -1) {
						var imageDescription = {name: name, dir: regularImagesPath, size: filesize(fileStat.size, {round: 1}), modified: fileStat.mtime.getTime()}
						regImages.push(imageDescription);
					}
				}

				var optimizedImagesPath = path.join(regularImagesPath, "opt");
				var optimizedImages = fs.readdirSync(optimizedImagesPath);

				for (var i = 0; i < optimizedImages.length; i++) {
					var name = optimizedImages[i];
					var filePath = path.join(optimizedImagesPath, name);
					var fileStat = fs.statSync(filePath);
					if (fileStat.isFile() && name.indexOf(".png") > -1) {
						var imageDescription = {name: name, dir: optimizedImagesPath, size: filesize(fileStat.size, {round: 1}), modified: fileStat.mtime.getTime()}
						optImages.push(imageDescription);
					}
				}

				ImageModel.getFeaturesOfImages(regImages, function(err, regImages) {

					if (err) {
						return callback(err);
					}
					
					result.regImages = regImages;

					ImageModel.getFeaturesOfImages(optImages, function(err, optImages) {

						if (err) {
							return callback(err);
						}
					
						result.optImages = optImages;

						return callback(null, result);
					});
				});


			} else {
				return callback(new Error(fullPath + " is neither a file nor a directory."))
			}
			
		});

	},
	getAllImages: function(callback) {

		var imagesPath = path.join(ImageModel.baseDir, "images");
		
		var images = wrench.readdirSyncRecursive(imagesPath);
		
		images = images.filter(function(element) { return (element.indexOf(".png") > -1)});
		images = images.map(function(imagePath) { return "/images/" + imagePath});
		
		callback(null, images);
	},
	getFeaturesOfImages: function(images, callback) {

		var functions = [];
		var currentCheck = 0;
		
		for (var i = 0; i < images.length; i++) {
			functions.push(function(callback) {
				var image = images[currentCheck];
				currentCheck++;
				im.identify(path.join(image.dir, image.name), function(err, features) {
					if (err) {
						return callback(err);
					} else {
						callback(null, features);
					}
				});
			});
		}

		async.parallelLimit(functions,
			5,
			function(err, result) {
				if (err) {
					return callback(err);
				} else {
					
					//Match features with incoming list
					for (var i = 0; i < result.length; i++) {
						var features = result[i];
						var filePath = features.artifacts.filename;
						
						for (var j = 0; j < images.length; j++) {
							var image = images[j];
							var imagePath = path.join(image.dir, image.name);
							if (imagePath === filePath) {
								image.features = features;
								break;
							}
						}
					}
					
					return callback(null, images);
				}
			}
		);
	},
	setContent: function(contentPath, jsonData, callback) {
		ImageModel.existsContent(contentPath, function(err, contentExists) {

			if (err) {
				return callback(err, false);
			}

			if (!contentExists) {
				return callback(new Error("Content at: " + contentPath + " does not exist."))
			}
			
			var fullPath = path.join(ImageModel.baseDir, contentPath);
			
			var stat = fs.statSync(fullPath);
			
			if (stat.isFile() && contentPath.indexOf(".json" > -1)) {
				//Save the content
				fs.writeFile(fullPath, JSON.stringify(jsonData, null, "\t"), "utf8", function(err) {
					if (err) {
						return callback(err);
					} else {
						return callback(null);
					}
				});
			} else {
				return callback(new Error("There is no json file at " + contentPath));
			}
		});
	},
	existsDir: function(contentPath, callback) {

		var dirPath = path.join(ImageModel.baseDir, contentPath);

		fs.exists(dirPath, function(exists) {
			if (exists) {
				fs.stat(dirPath, function(err, stats) {
					if (err) {
						return callback(err);
					} else {
						if (stats.isDirectory()) {
							return callback(null, true);
						} else {
							return callback(null, false);
						}
					}
				});
			} else {
				return callback(null, exists);
			}
		});
	},
	existsContent: function(contentPath, callback) {

		var fullPath = path.join(ImageModel.baseDir, contentPath);

		fs.exists(fullPath, function(exists) {
			if (exists) {
				fs.stat(fullPath, function(err, stats) {
					if (err) {
						return callback(err);
					} else {
						if (stats.isFile() || stats.isDirectory()) {
							return callback(null, true);
						} else {
							return callback(null, false);
						}
					}
				});
			} else {
				return callback(null, exists);
			}
		});
	},
	mkdir: function(dirName, baseDir, callback) {
		if (typeof dirName !== "string") {
			return callback(new Error("Dir name: " + dirName + " is not a string."));
		}
		
		//Remove unwanted characters from dirName
		dirName = dirName.replace(/([^a-z0-9]+)/gi, '-');
		if (dirName.length > 200) {
			dirName = dirName.substr(0, 200);
		}

		if (dirName === "") {
			return callback(new Error("Directory name was empty."));
		}
		
		if (typeof baseDir !== "string") {
			return callback(new Error("Base dir: " + baseDir + " is not a string."));
		}
		
		var baseDirPath = path.join(ImageModel.baseDir, baseDir);
		
		if (!fs.existsSync(baseDirPath)) {
			return callback(new Error(baseDir + " does not exist."));
		}
		
		if (!fs.statSync(baseDirPath).isDirectory()) {
			return callback(new Error(baseDir + " is not a directory"));
		}
		
		var newDirPath = path.join(baseDirPath, dirName);
		
		if (fs.existsSync(newDirPath)) {
			return callback(new Error("A file already exists at: " + newDirPath));
		}
		
		fs.mkdir(newDirPath, callback);
	},
	createPage: function(pageName, baseDir, callback) {
		if (typeof pageName !== "string") {
			return callback(new Error("Name: " + pageName + " is not a string."));
		}
		
		pageName = pageName.replace(".json", "");
		
		//Remove unwanted characters from page name
		pageName = pageName.replace(/([^a-z0-9]+)/gi, '-');
		if (pageName.length > 200) {
			pageName = pageName.substr(0, 200);
		}
		
		pageName = pageName + ".json";
		
		if (typeof baseDir !== "string") {
			return callback(new Error("Base dir: " + baseDir + " is not a string."));
		}
		
		var baseDirPath = path.join(ImageModel.baseDir, baseDir);
		
		if (!fs.existsSync(baseDirPath)) {
			return callback(new Error(baseDir + " does not exist."));
		}
		
		if (!fs.statSync(baseDirPath).isDirectory()) {
			return callback(new Error(baseDir + " is not a directory"));
		}
		
		var newPagePath = path.join(baseDirPath, pageName);
		
		if (fs.existsSync(newPagePath)) {
			return callback(new Error("A file already exists at: " + newDirPath));
		}
		
		//TODO: make customizable
		var pageTemplate = JSON.parse(fs.readFileSync(__dirname + "/../pagetypes/default/template.json", "utf8"));
		
		var now = new Date();
		pageTemplate.created = dateFormat(now, "yyyy-mm-dd HH:MM:ss");
		
		fs.writeFile(newPagePath, JSON.stringify(pageTemplate, null, "\t"), "utf8", callback);
	},
	removeImage: function(imagePath, callback) {
		if (typeof imagePath !== "string") {
			return callback(new Error("Image path: " + imagePath + " is not a string."));
		}
		
		var fullPath = path.join(ImageModel.baseDir, imagePath);
		
		if (!fs.existsSync(fullPath)) {
			return callback(new Error(imagePath + " does not exist."));
		}
		
		if (!fs.statSync(fullPath).isFile()) {
			return callback(new Error(imagePath + " is not a file"));
		}
		
		var imagesPath = path.join(__dirname, "..", "output", "static", imagePath);

		wrench.rmdirSyncRecursive(imagesPath, true);

		fs.unlink(fullPath, callback);
	},
	rmdir: function(dirName, callback) {
		if (typeof dirName !== "string") {
			return callback(new Error("Dir name: " + dirName + " is not a string."));
		}
		
		var baseDirPath = path.join(ImageModel.baseDir, dirName);
		
		if (!fs.existsSync(baseDirPath)) {
			return callback(new Error(baseDir + " does not exist."));
		}
		
		if (!fs.statSync(baseDirPath).isDirectory()) {
			return callback(new Error(baseDir + " is not a directory"));
		}
		
		fs.rmdir(baseDirPath, callback);
	},
	rename: function(before, after, callback) {

		if (after.indexOf("/images/") !== 0) {
			return callback(new Error("The path is not a sub directory of /images/: " + after));
		}

		if (before === "/images/") {
			return callback(new Error("Cannot move the /images/ directory"));
		}
		
		contentModel.rename(before, after, callback);

	}
};

module.exports = ImageModel;