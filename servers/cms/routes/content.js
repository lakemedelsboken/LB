var express = require('express');
var router = express.Router();
var contentController = require("../controllers/contentcontroller");
var fileController = require("../controllers/filecontroller");
var jsondiffpatch = require('jsondiffpatch');
var path = require("path");
var historyModel = require("../models/historymodel");
var fs = require("fs");
var wrench = require("wrench");

router.get("/createpage", function(req, res) {

	var pageName = req.query["pagename"];
	var pageType = req.query["pagetype"];
	var baseDir = req.query["basedir"];
	
	if (pageName !== undefined && pageType !== undefined && pageType !== "" && baseDir !== undefined && pageName !== "" && baseDir !== "") {
		contentController.createPage(pageName, pageType, baseDir, function(err) {
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

router.get("/publishpage", function(req, res) {

	var pagePath = req.query["pagepath"];

	contentController.publishPage(pagePath, function(err) {
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

router.get("/revertolastpublished", function(req, res) {

	var pagePath = req.query["pagepath"];

	contentController.revertToLastPublishedPage(pagePath, function(err) {
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

router.get("/unpublishpage", function(req, res) {

	var pagePath = req.query["pagepath"];

	contentController.unpublishPage(pagePath, function(err) {
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

router.get("/removepage", function(req, res) {

	var pagePath = req.query["pagepath"];

	var returnPath = req.get("Referrer");
	returnPath = returnPath.split("/");

	var testDir = returnPath.pop();
	if (testDir === "") {
		returnPath.pop();
	}
	returnPath = returnPath.join("/");
	
	if (pagePath !== undefined && pagePath !== "") {
		contentController.removePage(pagePath, function(err) {
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

router.post("/savepage", function(req, res) {

	var body = req.body;
	if (body["pageId"] !== undefined) {

		var pageId = body["pageId"];

		//Load page
		contentController.getContent(pageId, function(err, data) {
			if (err) {
				res.status(err.status || 500);
				res.render('error', {
					message: err.message,
					error: err
				});
			} else {

				for (var key in body) {
					if (key !== "pageId") {

						//Find editable content
						if (key.indexOf("edit:") === 0) {
							//Page content
							var itemName = key.replace("edit:", "");
							
							var subContentName = null;
							
							if (itemName.indexOf(":") > -1) {
								itemName = itemName.split(":");
								subContentName = itemName[1];
								itemName = itemName[0];
							}
							
							//Find item in list of editable items
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
							
						} else if (key.indexOf("component:") === 0) {
							
							var componentName = key.replace("component:", "");
							var componentValue = body[key];
							
							if (data.components === undefined) {
								data.components = {};
							}

							data.components[componentName] = {content: componentValue};

							//console.log(key + " = " + body[key]);
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
							if (Object.prototype.toString.call(body[key]) === '[object Array]') {
								//Pick the last item in the array
								body[key] = body[key][body[key].length - 1].replace(/\r/g, "");
							}
							data[key] = body[key].replace(/\r/g, "");
						}
					}
				}

				contentController.setContent(pageId, data, false, function(err) {
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


router.get("/mkdir", function(req, res) {

	var dirName = req.query["dirname"];
	var baseDir = req.query["basedir"];
	
	if (dirName !== undefined && baseDir !== undefined && dirName !== "" && baseDir !== "") {
		contentController.mkdir(dirName, baseDir, function(err) {
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

router.get("/rmdir", function(req, res) {

	var dirName = req.query["dirname"];

	var returnPath = req.get("Referrer");
	returnPath = returnPath.split("/");

	var testDir = returnPath.pop();
	if (testDir === "") {
		returnPath.pop();
	}
	returnPath = returnPath.join("/");
	
	if (dirName !== undefined && dirName !== "") {
		contentController.rmdir(dirName, function(err) {
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

router.get("/modifymetadata", function(req, res) {

	var baseDir = req.query["basedir"];
	var key = req.query["metakey"];
	var value = req.query["metavalue"];

	if (key !== undefined && key !== "") {
		contentController.modifyMetadata(baseDir, key, value, function(err) {
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

router.get("/removemetadata", function(req, res) {

	var baseDir = req.query["basedir"];
	var key = req.query["metakey"];

	if (key !== undefined && key !== "") {
		contentController.removeMetadata(baseDir, key, function(err) {
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

router.get("/rename", function(req, res) {

	var before = req.query["before"];
	var after = req.query["after"];
		
	if (before !== undefined && before !== "" && after !== undefined && after !== "") {
		contentController.rename(before, after, function(err) {
			if (err) {
				res.status(err.status || 500);
				res.render('error', {
					message: err.message,
					error: err
				});
			} else {
				res.redirect(("/cms/" + after).replace(/\/\//g, "/"));
			}
		});
	} else {
		res.redirect("back");
	}
});

router.get("/removecontentitemfrompage", function(req, res) {

	var pageId = req.query["pagepath"];
	var contentName = req.query["contentname"];
	
	if (pageId !== undefined && pageId !== "" && contentName !== undefined && contentName !== "") {
		contentController.removeContentItemFromPage(contentName, pageId, function(err) {
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

router.get("/clearcaches", function(req, res) {

	contentController.clearCaches(function(err) {
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

router.get("/savecontenttogithub", function(req, res) {

	contentController.saveContentToGitHub(function(err) {
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



router.get("/addcontentitemtopage", function(req, res) {

	var pageId = req.query["page"];
	var contentType = req.query["contenttype"];
	var insertAfterId = req.query["insertafter"];
		
	if (pageId !== undefined && pageId !== "" && contentType !== undefined && contentType !== "") {
		contentController.addContentItemToPage(contentType, pageId, insertAfterId, function(err) {
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

router.get("/movecontentitemup", function(req, res) {

	var pageId = req.query["pagepath"];
	var contentName = req.query["contentname"];
	
	if (pageId !== undefined && pageId !== "" && contentName !== undefined && contentName !== "") {
		contentController.moveContentItemUp(contentName, pageId, function(err) {
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

router.get("/movecontentitemdown", function(req, res) {

	var pageId = req.query["pagepath"];
	var contentName = req.query["contentname"];
	
	if (pageId !== undefined && pageId !== "" && contentName !== undefined && contentName !== "") {
		contentController.moveContentItemDown(contentName, pageId, function(err) {
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

router.get("/diff", function(req, res) {

	var current = req.query["current"];
	var previous = req.query["previous"];
	
	var result = {html: ""};
	
	if (current !== undefined && current !== "" && previous !== undefined && previous !== "") {
		
		contentController.getContent(current, function(err, currentPage) {
			if (err) {
				res.json(result);
			}
			contentController.getContent(previous, function(err, previousPage) {


				if (err) {
					res.json(result);
				}

				previousPage.type = currentPage.type;
				previousPage.path = currentPage.path;
				
				var delta = jsondiffpatch.create().diff(previousPage, currentPage);
				
				result.html = jsondiffpatch.formatters.html.format(delta, currentPage);
				result.html = result.html.replace(/\\r/g, "").replace(/\\n/g, "<br>");
				
				res.json(result);
				
			});
		});
		
	} else {
		res.json(result);
	}
	
});

router.post("/files/upload", function(req, res) {

	req.connection.setTimeout(1000 * 60 * 30); //30 minutes
	
	var dir = req.body["basedir"];

	//Move file to correct path
	if (req.files && req.files.file) {
		var file = req.files.file;

		if (file.originalname !== "") {
			var safeFileName = file.originalname;
			var newFilePath = path.join(contentController.baseDir, dir, safeFileName);
			
			fs.renameSync(file.path, newFilePath);
			var draftOutputDirPath = path.join(contentController.baseDir, "..", "output", "draft", dir);
			var draftOutputFilePath = path.join(draftOutputDirPath, safeFileName);

			wrench.mkdirSyncRecursive(draftOutputDirPath, 0777);

			historyModel.copyFile(newFilePath, draftOutputFilePath, function(err) {
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

});

router.get("/files/removefile", function(req, res) {

	var filePath = req.query["filepath"];

	var returnPath = req.get("Referrer");
	returnPath = returnPath.split("/");

	var testDir = returnPath.pop();
	if (testDir === "") {
		returnPath.pop();
	}
	returnPath = returnPath.join("/");
	
	if (filePath !== undefined && filePath !== "") {
		fileController.removeFile(filePath, function(err) {
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

router.get("/recreateall", function(req, res) {

	contentController.recreateAll(function(err) {

		if (err) {

			console.log(err);
			console.log(err.status);
			console.log(err.stack);

		} else {
//			res.sendStatus(200);
		}
	});
	
//	res.redirect("/cms/content/tasksstatus");
	res.status(200).end();

});

router.get("/publishexternal", function(req, res) {

	var sentStatus = false;

	//Get parameter from request
	var sendAllFiles = req.query["sendallfiles"];

	if (sendAllFiles === "true") {
		sendAllFiles = true;
	} else {
		sendAllFiles = false;
	}

	contentController.publishExternal(sendAllFiles, function(err) {
		if (err) {

			console.log(err);
			console.log(err.status);
			console.log(err.stack);

			if (!sentStatus) {
				sentStatus = true;
				res.status(500).end();
			}

		} else {
			if (!sentStatus) {
				sentStatus = true;
				res.status(200).end();
			}
		}
	});
	
	setTimeout(function() {
		if (!sentStatus) {
			sentStatus = true;
			res.status(200).end();
		}
	}, 5000);

});

router.get("/tasksstatus", function(req, res) {

	res.json(contentController.getTasksStatus());

});

module.exports = router;
