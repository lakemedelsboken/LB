var express = require('express');
var router = express.Router();
var imageController = require("../controllers/imagecontroller");
var path = require("path");
var fs = require("fs");

/* GET home page. */
router.get('/images', function(req, res) {

	var output = {id: req.path, title: 'Bilder'};

	imageController.getContent(req.path, function(err, content) {
		if (err) {
			res.status(err.status || 500);
			res.render('error', {
				message: err.message,
				error: err
			});
		} else {
			output.content = content.list;
			res.render('images', output);
		}
	});

});

/*
router.post("/images/savepage", function(req, res) {

	var body = req.body;
	if (body["pageId"] !== undefined) {

		var pageId = body["pageId"];

		//Load page
		imageController.getContent(pageId, function(err, data) {
			if (err) {
				res.status(err.status || 500);
				res.render('error', {
					message: err.message,
					error: err
				});
			} else {

				for (var key in body) {
					if (key !== "pageId") {
						if (key.indexOf("edit:") === 0) {
							//Page content
							var itemName = key.replace("edit:", "");
							
							var subContentName = null;
							
							if (itemName.indexOf(":") > -1) {
								itemName = itemName.split(":");
								subContentName = itemName[1];
								itemName = itemName[0];
							}
							
							//Find item in list
							var item = imageController.findEditableItemByName(itemName, data.content);
							if (item) {
								if (subContentName) {
									item.content[subContentName] = body[key];
								} else {
									item.content = body[key];
								}
							}
							
						} else {
							//Metadata
							data[key] = body[key];
						}
					}
				}

				imageController.setContent(pageId, data, function(err) {
					if (err) {
						res.status(err.status || 500);
						res.render('error', {
							message: err.message,
							error: err
						});
					} else {
						res.redirect("back");
					}
				});
				
			}
		});
	}
});
*/
router.post("/images/upload", function(req, res) {

	req.connection.setTimeout(1000 * 60 * 30); //30 minutes
	
	var dir = req.body["basedir"];

	//Move image files to correct path
	if (req.files && req.files.image) {
		var image = req.files.image;

		//console.log(image)

		if (image.originalname !== "" && image.mimetype === "image/png") {
			var safeImageName = image.originalname.toLowerCase().replace(/[^a-z0-9\.]/gi, '_');
			var newImagePath = path.join(imageController.baseDir, dir, safeImageName);
			
			fs.renameSync(image.path, newImagePath);
			var outputDir = path.join(imageController.baseDir, "..", "output", "static", dir, safeImageName);
			var forceImageResizing = true;
			imageController.createImageSizes(newImagePath, outputDir, forceImageResizing, function(err, results) {
				if (err) {
					res.status(err.status || 500);
					res.render('error', {
						message: err.message,
						error: err
					});
				} else {
					res.redirect("back");
				}
			});
		} else {
			res.redirect("back");
		}
	} else {
		res.redirect("back");
	}

	/*
	var pageName = req.query["pagename"];
	var baseDir = req.query["basedir"];
	
	if (pageName !== undefined && baseDir !== undefined && pageName !== "" && baseDir !== "") {
		imageController.createPage(pageName, baseDir, function(err) {
			if (err) {
				res.status(err.status || 500);
				res.render('error', {
					message: err.message,
					error: err
				});
			} else {
				res.redirect("back");
			}
		});
	} else {
		res.redirect("back");
	}
*/
});

router.get("/images/removeimage", function(req, res) {

	var imagePath = req.query["imagepath"];

	var returnPath = req.get("Referrer");
	returnPath = returnPath.split("/");

	var testDir = returnPath.pop();
	if (testDir === "") {
		returnPath.pop();
	}
	returnPath = returnPath.join("/");
	
	if (imagePath !== undefined && imagePath !== "") {
		imageController.removeImage(imagePath, function(err) {
			if (err) {
				res.status(err.status || 500);
				res.render('error', {
					message: err.message,
					error: err
				});
			} else {
				res.redirect(returnPath);
			}
		});
	} else {
		res.redirect("back");
	}

});

router.get("/images/all", function(req, res) {
	imageController.getAllImages(function(err, images) {

		if (err) {
			res.status(err.status || 500);
			res.render('error', {
				message: err.message,
				error: err
			});
			
		} else {
			res.json(images);
		}
		
	});
});

router.get("/images/mkdir", function(req, res) {

	var dirName = req.query["dirname"];
	var baseDir = req.query["basedir"];
	
	if (dirName !== undefined && baseDir !== undefined && dirName !== "" && baseDir !== "") {
		imageController.mkdir(dirName, baseDir, function(err) {
			if (err) {
				res.status(err.status || 500);
				res.render('error', {
					message: err.message,
					error: err
				});
			} else {
				res.redirect("back");
			}
		});
	} else {
		res.redirect("back");
	}

});

router.get("/images/rmdir", function(req, res) {

	var dirName = req.query["dirname"];

	var returnPath = req.get("Referrer");
	returnPath = returnPath.split("/");

	var testDir = returnPath.pop();
	if (testDir === "") {
		returnPath.pop();
	}
	returnPath = returnPath.join("/");
	
	if (dirName !== undefined && dirName !== "") {
		imageController.rmdir(dirName, function(err) {
			if (err) {
				res.status(err.status || 500);
				res.render('error', {
					message: err.message,
					error: err
				});
			} else {
				res.redirect(returnPath);
			}
		});
	} else {
		res.redirect("back");
	}

});

router.get("/images/rename", function(req, res) {

	var before = req.query["before"];
	var after = req.query["after"];
		
	if (before !== undefined && before !== "" && after !== undefined && after !== "") {
		imageController.rename(before, after, function(err) {
			if (err) {
				res.status(err.status || 500);
				res.render('error', {
					message: err.message,
					error: err
				});
			} else {
				res.redirect(after);
			}
		});
	} else {
		res.redirect("back");
	}
});

//Find correct view for each type of content
router.get('/images/*', function(req, res) {

	var baseUrl = req.path;
	
	imageController.getContent(baseUrl, function(err, data) {
		if (err) {
			res.status(err.status || 500);
			res.render('error', {
				message: err.message,
				error: err
			});
		} else {

			var output = {id: baseUrl, title: baseUrl};
			
			if (data.type === "dir") {
				output.content = data.list;
				res.render('images', output);
			} else if (data.type === "image") {
				output.data = data;
				
				res.render('image', output);
			} else {
				res.render('error', {
					message: baseUrl + " is of unknown type",
					error: new Error()
				});
			}
		}
	});
});

module.exports = router;
