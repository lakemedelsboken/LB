var $ = require("cheerio");
var wrench = require("wrench");
var fs = require("fs");
var async = require("async");

module.exports = {
	begin: function(tag, indentation, self) {

		var result = "";

		//End current format before rendering figure
		while (self.state.format.length > 0) {
			if (self.formatHandlers[self.state.format[self.state.format.length - 1]] !== undefined) {
				//TODO: Perhaps self.html.push instead
				result += self.formatHandlers[self.state.format[self.state.format.length - 1]].end(tag, indentation);
			} else {
				//console.error("Could not find ending formathandler for " + self.state.format[self.state.format.length - 1]);
			}
			self.state.format.pop();
		}

		self.state.figure = true;

		$tag = $(tag);
		//var number = $tag.children().filter(function(index, element) {return (element.name === "PgfNumString");}).attr("value").split(".")[0].replace("Figur ", "");

		var number = $tag.find("PgfNumString").attr("value").split(".")[0].replace("Figur ", "");
		
		var imagesDirName = self.sourceFilePath.toLowerCase().replace(/\+/g, "-");
		if (imagesDirName.indexOf("/") > -1) {
			imagesDirName = imagesDirName.split("/");
			imagesDirName = imagesDirName[imagesDirName.length - 1];
		}

		imagesDirName = imagesDirName.replace(".mif", "").replace(".mifml", "") + "_images";
		var optImagesDirName = imagesDirName;
		result += "<div id=\"figure_" + number + "\" class=\"well figure\">";

		result += "<img src=\"" + optImagesDirName + "/figur" + number + "_medium_x2.png\" class=\"figureImage\" alt=\"Figur " + number + "\"/>";

		/*

		result += "<div data-picture data-alt=\"Figur " + number + "\">";
		
		result += "<div data-src=\"" + optImagesDirName + "/figur" + number + "_small.png\"></div>";
		result += "<div data-src=\"" + optImagesDirName + "/figur" + number + "_small_x2.png\"         data-media=\"(min-device-pixel-ratio: 2.0)\"></div>";
		result += "<div data-src=\"" + optImagesDirName + "/figur" + number + "_medium.png\"        data-media=\"(min-width: 481px)\"></div>";
		result += "<div data-src=\"" + optImagesDirName + "/figur" + number + "_medium_x2.png\"     data-media=\"(min-width: 481px) and (min-device-pixel-ratio: 2.0)\"></div>";
		result += "<div data-src=\"" + optImagesDirName + "/figur" + number + "_large.png\"    data-media=\"(min-width: 980px)\"></div>";
		result += "<div data-src=\"" + optImagesDirName + "/figur" + number + "_large_x2.png\" data-media=\"(min-width: 980px) and (min-device-pixel-ratio: 2.0)\"></div>";
		result += "<div data-src=\"" + optImagesDirName + "/figur" + number + "_huge.png\"    data-media=\"(min-width: 1200px)\"></div>";
		result += "<div data-src=\"" + optImagesDirName + "/figur" + number + "_huge_x2.png\" data-media=\"(min-width: 1200px) and (min-device-pixel-ratio: 2.0)\"></div>";

		result += "<!--[if (lt IE 9) & (!IEMobile)]>";
		result += "<div data-src=\"" + optImagesDirName + "/figur" + number + "_large.png\"></div>";
		result += "<![endif]-->";
		
		result += "<noscript>";
		result += "<img src=\"" + optImagesDirName + "/figur" + number + "_large.png\" alt=\"Figur " + number + "\">";
		result += "</noscript>";
		*/
		
		//result += "</div>";
		
		/*
		var newImagePath = __dirname + "/../../../servers/site/chapters/" + imagesDirName + "/figur" + number + ".png";
		
		var optImagesDir = __dirname + "/../../../servers/site/chapters/" + imagesDirName + "/opt/";
		
		//console.error("Creating dir for optimized images: " + optImagesDir);
		wrench.mkdirSyncRecursive(optImagesDir);
		//console.error("Done.");
		
		if (!fs.existsSync(newImagePath)) {
			//Check if image exists
			var imageName = newImagePath;
			if (imageName.indexOf("/") > -1) {
				imageName = imageName.split("/");
				imageName = imageName[imageName.length - 1];
			}
			console.error("* Missing figure image: " + imageName);
		} else {

			//async.series(
			async.parallel(
				[
					function(callback) {
						self.resizeImage(newImagePath, 480, "_small", self.forcedImageResizing, function(err, result) {
							callback(err, result);
						});
					},
					function(callback) {
						self.resizeImage(newImagePath, 960, "_small_x2", self.forcedImageResizing, function(err, result) {
							callback(err, result);
						});
					},
					function(callback) {
						self.resizeImage(newImagePath, 724, "_medium", self.forcedImageResizing, function(err, result) {
							callback(err, result);
						});
					},
					function(callback) {
						self.resizeImage(newImagePath, 1448, "_medium_x2", self.forcedImageResizing, function(err, result) {
							callback(err, result);
						});
					},
					function(callback) {
						self.resizeImage(newImagePath, 940, "_large", self.forcedImageResizing, function(err, result) {
							callback(err, result);
						});
					},
					function(callback) {
						self.resizeImage(newImagePath, 1880, "_large_x2", self.forcedImageResizing, function(err, result) {
							callback(err, result);
						});
					},
					function(callback) {
						self.resizeImage(newImagePath, 1170, "_huge", self.forcedImageResizing, function(err, result) {
							callback(err, result);
						});
					},
					function(callback) {
						self.resizeImage(newImagePath, 2340, "_huge_x2", self.forcedImageResizing, function(err, result) {
							callback(err, result);
						});
					}
				], 
				function(err, results) {
					if (err) {
						console.error("* Error:", err);
					} else {
						//console.error("Resized images: \n\t" + results.join("\n\t"));
					}
				}
			);
			
		}
		*/
		return result;
	},
	end: function(tag, indentation, self) {
		self.state.figure = false;
		return "</p></div>";
	}
}