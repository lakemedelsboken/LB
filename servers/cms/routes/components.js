var express = require('express');
var router = express.Router();
var componentController = require("../controllers/componentcontroller");
var contentController = require("../controllers/contentcontroller");
var historyModel = require("../models/historymodel");
var path = require("path");
var fs = require("fs");

router.get("/components/createcomponent", function(req, res) {

	var componentName = req.query["componentname"];
	var componentType = req.query["componenttype"];
	var baseDir = req.query["basedir"];
	
	if (componentName !== undefined && componentType !== undefined && componentType !== "" && baseDir !== undefined && componentName !== "" && baseDir !== "") {
		componentController.createComponent(componentName, componentType, baseDir, function(err) {
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

router.get("/components/publishcomponent", function(req, res) {

	var componentPath = req.query["componentpath"];

	componentController.publishComponent(componentPath, function(err) {
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

});

router.get("/components/unpublishcomponent", function(req, res) {

	var componentPath = req.query["componentpath"];

	componentController.unpublishComponent(componentPath, function(err) {
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

});

router.get("/components/removecomponent", function(req, res) {

	var componentPath = req.query["componentpath"];

	var returnPath = req.get("Referrer");
	returnPath = returnPath.split("/");

	var testDir = returnPath.pop();
	if (testDir === "") {
		returnPath.pop();
	}
	returnPath = returnPath.join("/");
	
	if (componentPath !== undefined && componentPath !== "") {
		componentController.removeComponent(componentPath, function(err) {
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

router.post("/components/savecomponent", function(req, res) {

	var body = req.body;
	if (body["componentId"] !== undefined) {

		var componentId = body["componentId"];

		//Load component
		componentController.getContent(componentId, function(err, data) {
			//console.log("Got content")
			if (err) {
				res.status(err.status || 500);
				res.render('error', {
					message: err.message,
					error: err
				});
			} else {

				for (var key in body) {
					if (key !== "componentId") {
						if (key.indexOf("edit:") === 0) {
							//Component content
							var itemName = key.replace("edit:", "");
							
							var subContentName = null;
							
							if (itemName.indexOf(":") > -1) {
								itemName = itemName.split(":");
								subContentName = itemName[1];
								itemName = itemName[0];
							}
							
							//Find item in list
							var item = contentController.findEditableItemByName(itemName, data.content);

							if (item) {
								//If the item has several levels of content
								if (subContentName) {

									item.content[subContentName] = body[key];
									
									if (body[key] && Object.prototype.toString.call(body[key]) === '[object Array]') {
										//Pick the last item
										item.content[subContentName] = body[key][body[key].length - 1].replace(/\r/g, "");
									}
								} else {
									item.content = body[key].replace(/\r/g, "");
								}
								
								var contentViews = contentController.getContentTypes()[item.type];
								item = contentViews.preProcess(item);
								
							}
						} else if (key.indexOf("settings:") === 0) {
							var itemName = key.replace("settings:", "");
							var itemValue = body[key];

							var subSettingName = null;
							var subSubSettingName = null;
							
							if (itemName.indexOf(":") > -1) {
								itemName = itemName.split(":");
								subSettingName = itemName[1];
								if (itemName.length > 2) {
									subSubSettingName = itemName[2];
								}
								itemName = itemName[0];
							}
							
							//console.log(itemName + " : " + subSettingName + " : " + subSubSettingName + " = " + itemValue);
							
							var item = contentController.findEditableItemByName(itemName, data.content);
							
							if (item) {
								if (item.settings[subSettingName] === undefined) {
									item.settings[subSettingName] = {};
								}
								
								if (item.settings[subSettingName] instanceof Array) {
									item.settings[subSettingName] = {};
								}

								if (itemValue instanceof Array) {
									itemValue = itemValue[itemValue.length - 1];
								}

								item.settings[subSettingName][subSubSettingName] = itemValue;

							}
							
						} else {
							//Metadata
							data[key] = body[key];
						}
					}
				}

				componentController.setContent(componentId, data, false, function(err) {
					//console.log("content is set")
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


router.get("/components/removecomponent", function(req, res) {

	var componentPath = req.query["componentpath"];

	var returnPath = req.get("Referrer");
	returnPath = returnPath.split("/");

	var testDir = returnPath.pop();
	if (testDir === "") {
		returnPath.pop();
	}
	returnPath = returnPath.join("/");
	
	if (componentPath !== undefined && componentPath !== "") {
		componentController.removeComponent(componentPath, function(err) {
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

router.get("/components/all", function(req, res) {
	componentController.getAllComponents(function(err, components) {

		if (err) {
			res.status(err.status || 500);
			res.render('error', {
				message: err.message,
				error: err
			});
			
		} else {
			res.json(components);
		}
		
	});
});

router.get("/components/mkdir", function(req, res) {

	var dirName = req.query["dirname"];
	var baseDir = req.query["basedir"];
	
	if (dirName !== undefined && baseDir !== undefined && dirName !== "" && baseDir !== "") {
		componentController.mkdir(dirName, baseDir, function(err) {
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

router.get("/components/rmdir", function(req, res) {

	var dirName = req.query["dirname"];

	var returnPath = req.get("Referrer");
	returnPath = returnPath.split("/");

	var testDir = returnPath.pop();
	if (testDir === "") {
		returnPath.pop();
	}
	returnPath = returnPath.join("/");
	
	if (dirName !== undefined && dirName !== "") {
		componentController.rmdir(dirName, function(err) {
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

router.get("/components/rename", function(req, res) {

	var before = req.query["before"];
	var after = req.query["after"];
		
	if (before !== undefined && before !== "" && after !== undefined && after !== "") {
		componentController.rename(before, after, function(err) {
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

router.get("/components/removecontentitemfromcomponent", function(req, res) {

	var componentId = req.query["componentpath"];
	var contentName = req.query["contentname"];
	
	if (componentId !== undefined && componentId !== "" && contentName !== undefined && contentName !== "") {
		componentController.removeContentItemFromComponent(contentName, componentId, function(err) {
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


router.get("/components/addcontentitemtocomponent", function(req, res) {

	var componentId = req.query["component"];
	var contentType = req.query["contenttype"];
	var insertAfterId = req.query["insertafter"];
		
	if (componentId !== undefined && componentId !== "" && contentType !== undefined && contentType !== "") {
		componentController.addContentItemToComponent(contentType, componentId, insertAfterId, function(err) {
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

router.get("/components/movecontentitemup", function(req, res) {

	var componentId = req.query["componentpath"];
	var contentName = req.query["contentname"];
	
	if (componentId !== undefined && componentId !== "" && contentName !== undefined && contentName !== "") {
		componentController.moveContentItemUp(contentName, componentId, function(err) {
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

router.get("/components/movecontentitemdown", function(req, res) {

	var componentId = req.query["componentpath"];
	var contentName = req.query["contentname"];
	
	if (componentId !== undefined && componentId !== "" && contentName !== undefined && contentName !== "") {
		componentController.moveContentItemDown(contentName, componentId, function(err) {
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


//Find correct view for each type of component
router.get('/components*', function(req, res) {

	var baseUrl = req.path;
	
	componentController.getContent(baseUrl, function(err, data) {
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
				output.metadata = data.metadata;
				output.componentTypes = componentController.getComponentTypes();
				res.render('components', output);
			} else if (data.type === "component") {
				output.page = data;

				//Get content editors
				output.contentEditors = contentController.getEditors(output.page);

				//Get content previews
				output.contentPreviews = contentController.getPreviews(output.page);

				output.contentTypes = contentController.getContentTypes();
				
				//Get snapshots
				historyModel.getSnapshots(output.page.path, function(err, snapshots) {
					if (err) {
						output.snapshots = [];
					} else {
						output.snapshots = snapshots;
					}

					//Get published versions
					output.publishedVersions = historyModel.getPublished(output.page.path);
					
					output.canBePublished = false;
					output.canBeUnpublished = false;
				
					//Determine if page can be published or marked as unpublished
					if (output.snapshots.length > 0 && output.publishedVersions.length > 0) {
						var mostRecentPublished = output.publishedVersions[0];
						var mostRecentSnapshot = output.snapshots[0];
						
						if (mostRecentSnapshot.contentHash !== mostRecentPublished.contentHash) {
							console.log(mostRecentSnapshot.contentHash + " == " + mostRecentPublished.contentHash)
							output.canBePublished = true
						}
					}
					
					if (output.snapshots.length > 0 && output.publishedVersions.length === 0) {
						output.canBePublished = true;
					}
					
					if (output.page.isPublished === true) {
						output.canBeUnpublished = true;
					}
					
					if (output.page.isPublished !== true && output.snapshots.length > 0) {
						output.canBePublished = true;
					}
				
					res.render('component', output);
					
				});
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
