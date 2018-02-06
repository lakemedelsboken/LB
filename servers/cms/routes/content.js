var express = require('express');
var router = express.Router();
var contentController = require("../controllers/contentcontroller");
var fileController = require("../controllers/filecontroller");
var jsondiffpatch = require('jsondiffpatch');
var path = require("path");
var historyModel = require("../models/historymodel");
var fs = require("fs-extra");
var spawn = require("child_process").spawn;
var dateFormat = require("dateformat");
var cheerio = require("cheerio");
var updatedPages = require('../helpers/updatedPages');
var wrench = require("wrench");
var urlObject = require("url");
var request = require("request");
var htmlDocxJs = require('html-docx-js');
var base64Img = require('base64-img');

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
		console.log(pagePath);
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
	var comment = req.query["comment"];

	contentController.revertToLastPublishedPage(pagePath, comment, function(err) {
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

router.get("/revertosnapshot", function(req, res) {

	var pagePath = req.query["pagepath"];
	var version = req.query["version"];
	var comment = req.query["comment"];

	contentController.revertToSnapshot(pagePath, version, comment, function(err) {
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

router.get("/movepage", function(req, res) {

	var fromPath = req.query["frompath"];
	var pageName = req.query["pageName"];
	var pageDir = req.query["pageDir"];

	if (pageName !== undefined && pageName !== "" && pageDir !== undefined && pageDir !== "" && fromPath !== undefined && fromPath !== "") {
		contentController.movePage(fromPath, pageDir, pageName, function(err) {
			if (err) {
				res.status(err.status || 500);
				res.render('error', {
					message: err.message,
					error: err
				});
			} else {
				res.redirect(path.join("/cms", pageDir, pageName + ".json"));
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
								item = contentViews.preProcess(item, pageId);

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

				//Check for author content types and modify metadata attribute accordingly
				var authors = [];

				for (var i = 0; i < data.content.length; i++) {
					if (data.content[i].type === "author") {
						var author = data.content[i];
						authors.push(author.content.firstname + " " + author.content.surname);
					}
				}

				if (authors.length > 0) {
					data.createdBy = authors.join(", ");
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
		contentController.addContentItemToPage(contentType, pageId, insertAfterId, function(err, createdId) {
			if (err) {
				res.status(err.status || 500);
				res.render('error', {
					message: err.message,
					error: err
				});
			} else {
				var referrer = req.get("Referrer");
				if (createdId !== undefined) {
					res.redirect(referrer + "#" + createdId);
				} else {
					res.redirect("back");
				}
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
		contentController.moveContentItemUp(contentName, pageId, function(err, itemId) {
			if (err) {
				res.status(err.status || 500);
				res.render('error', {
					message: err.message,
					error: err
				});
			} else {
				var referrer = req.get("Referrer");
				if (itemId !== undefined) {
					res.redirect(referrer + "#" + itemId);
				} else {
					res.redirect("back");
				}
			}
		});
	} else {
		res.redirect("back");
	}

});


router.get("/makealltextblack", function(req, res) {

	var pagePath = req.query["pagepath"];
	contentController.getContent(pagePath, function(err, currentPage) {
		if (err) {
		throw err;
		console.log("2er");
		}
		var newText='';
		console.log(currentPage.type);
		currentPage.content.forEach(function(item){
			if(item.content && item.content.length > 0) {
				item.content = item.content.replace(/#([a-f]|[A-F]|[0-9]){2}0000/g,"#000000").replace(/ class="updated"/g,"");
			}
			if(item.content.text && item.content.text.length > 0) {
				item.content.text = item.content.text.replace(/#([a-f]|[A-F]|[0-9]){2}0000/g,"#000000").replace(/ class="updated"/g,"");;
			}

		});
		console.log(currentPage);
		contentController.setContent(pagePath, currentPage, false, function(err) {
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
});




router.get("/movecontentitemdown", function(req, res) {

	var pageId = req.query["pagepath"];
	var contentName = req.query["contentname"];

	if (pageId !== undefined && pageId !== "" && contentName !== undefined && contentName !== "") {
		contentController.moveContentItemDown(contentName, pageId, function(err, itemId) {
			if (err) {
				res.status(err.status || 500);
				res.render('error', {
					message: err.message,
					error: err
				});
			} else {
				var referrer = req.get("Referrer");
				if (itemId !== undefined) {
					res.redirect(referrer + "#" + itemId);
				} else {
					res.redirect("back");
				}

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

			fs.ensureDirSync(draftOutputDirPath);

			fs.copy(newFilePath, draftOutputFilePath, function(err) {
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

router.get("/files/publishfile", function(req, res) {

	var filePath = req.query["filepath"];

	//var returnPath = req.get("Referrer");

	if (filePath !== undefined && filePath !== "") {
		fileController.publishFile(filePath, function(err) {
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

router.get("/files/unpublishfile", function(req, res) {

	var filePath = req.query["filepath"];

	//var returnPath = req.get("Referrer");

	if (filePath !== undefined && filePath !== "") {
		fileController.unpublishFile(filePath, function(err) {
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

/*router.get("/download/pdf", function(req, res) {
	console.log("download from content.js");
	var url = req.query["url"];
	if (url !== undefined && url !== "") {
		var outPath = path.join(require("os").tmpdir(), contentController.getGUID() + ".pdf");
		console.log("Building pdf for " + url + " to " + outPath);
		var date = new Date();
		var fileNameDate = dateFormat(date, "yyyy-mm-dd--HH-MM-ss");
		var newFileName = path.basename(url, ".html") + "-" + fileNameDate + ".pdf";
		var cookies = [];
		for (var cookie in req.cookies) {
			cookies.push("--cookie");
			cookies.push(encodeURIComponent(cookie));
			cookies.push(encodeURIComponent(req.cookies[cookie]));
		}
		var arguments = ["--print-media-type", "--disable-smart-shrinking", "--zoom", "0.7", "--dpi", "240", "-n"];
		//"--no-background",
		arguments = arguments.concat(cookies);
		arguments = arguments.concat(["--footer-font-size", 8]);
		arguments = arguments.concat(["--header-font-size", 8]);
		arguments = arguments.concat(["--footer-font-name", "Courier"]);
		arguments = arguments.concat(["--header-font-name", "Courier"]);
		arguments = arguments.concat(["--margin-left", "30mm"]);
		arguments = arguments.concat(["--margin-right", "30mm"]);
		arguments.push("http://localhost" + url)
		arguments.push(outPath);
		var hasExited = false;
		var converter = spawn('wkhtmltopdf', arguments);
		converter.stdout.on('data', function (data) {
			console.log('stdout: ' + data);
		});
		converter.stderr.on('data', function (data) {
			console.log('stderr: ' + data);
		});
		converter.on('close', function (code) {
			if (code !== 0) {
				console.log('Child process exited with code ' + code);
				hasExited = true;
				res.status(500);
				var err = new Error('Child process exited with code ' + code);
				res.render('error', {
					message: err.message,
					error: err
				});
			} else if (!hasExited) {
				hasExited = true;
				//Everything is ok
				res.download(outPath, newFileName);
			}
		});
		converter.on('error', function (err) {
			console.log('Child process exited with err ', err);
			if (!hasExited) {
				hasExited = true;
				res.status(500);
				res.render('error', {
					message: 'Child process exited with err: ' + err.message,
					error: err
				});
			}
		});
	} else {
		res.redirect("back");
	}
});*/

router.get("/docx/download", function(req, res) {

	var url = req.query["url"];

	if (url !== undefined && url !== "") {

		var fileOnDisk = path.join(__dirname, "..", "..", "..", "cms", "output");
		var printCssOldFile=path.join(fileOnDisk, "static","css","uncompressed","pandoc.css");


		var outFileName = contentController.getGUID() + ".docx";
		var outPath = path.join(require("os").tmpdir(), outFileName);

		console.log("Building docx for " + url + " to " + outPath);

		var date = new Date();
		var fileNameDate = dateFormat(date, "yyyy-mm-dd--HH-MM-ss");
		var printDate = dateFormat(date, "yyyy-mm-dd HH:MM:ss");

		var draftOrPublish = (url.indexOf("/cms/draft/") === 0) ? "draft" : "publish";
		var isDraft = (url.indexOf("/cms/draft/") === 0);

		var baseUrl = path.join(contentController.baseDir, "..", "output");

		if (isDraft) {
			baseUrl = path.join(baseUrl, "draft");
		} else {
			baseUrl = path.join(baseUrl, "published");
		}

		url = url.replace("/cms/draft", "");
		url = path.join(baseUrl, url);

		if (!fs.existsSync(url)) {
			console.log('Could not find path: ' + url);
			hasExited = true;

			res.status(500);
			var err = new Error('Child not find path: ' + url);
			res.render('error', {
				message: err.message,
				error: err
			});
			return;
		}

		var tempDir = require("os").tmpdir();
		var tempHtmlPath = path.join(tempDir, contentController.getGUID() + ".html");

		//Reformat the html for docx output
		var oldHtml = fs.readFileSync(url, "utf8");
		var $ = cheerio.load(oldHtml);

		//Remove left side container
		$("#sideContainer").remove();

		//Fix image links
		var currentVersion = JSON.parse(fs.readFileSync(path.join(contentController.baseDir, "..", "output", "static", "settings.json"))).version;
		$("img").each(function(index, item) {
			var $item = $(item);
			var relativeImagePath = $item.attr("src").replace("/" + currentVersion + "/", "/");
			relativeImagePath = relativeImagePath.replace(/\.\.\//g, "");
			var relativeBaseDir = path.join(contentController.baseDir, "..", "output", "static");
			var fromImagePath = path.join(relativeBaseDir, relativeImagePath);
			var toImagePath = path.join(tempDir, contentController.getGUID() + ".png");

			console.log("Copy from: " + fromImagePath);
			console.log("To: " + toImagePath);

			fs.copySync(fromImagePath, toImagePath, {clobber: true});
			var toImagePathBase64 = base64Img.base64Sync(toImagePath, 100, 100);
			$(item).attr("src", toImagePathBase64);
		});

		//Remove ATC-links
		$("a.inlineGenerica").each(function(index, item) {
			$(item).replaceWith($(item).text());
		});

		//Remove footer
		$("footer").remove();

		//Remove box collection
		$("#boxCollection").remove();

		//Remove search result
		$("#searchResults").remove();

		//Remove modalMed
		$("#modalMed").remove();

		//Remove the title, the metadata title will be used
	//	$("h1").first().remove();

		//Remove authors, metadata authors will be used
		var autorsFromPageString = $("p.authors").first().html();
		autorsFromPage = autorsFromPageString.split('<br>');
		$("p.authors").css("font-size", "13px");
		$("p.authors").css("text-align", "center");

		//Remove links concerning authors disclosure
	//	$(".authorsDisclosure").remove();

		//Unwrap links to fact boxes
		$("a.factsLink").each(function(index, item) {
			$(item).replaceWith($(item).text());
		});

		//Unwrap links to table boxes
		$("a.tableLink").each(function(index, item) {
			$(item).replaceWith($(item).text());
		});

		//Unwrap links to figure boxes
		$("a.figureLink").each(function(index, item) {
			$(item).replaceWith($(item).text());
		});

		//Fix references
		$("a.inlineReference").each(function(index, item) {
			$(item).replaceWith("<sup>(" + $(item).text() + ")</sup>");
		});

		//Remove from metadata title if it exists
		$("title").text($("title").text().replace(" | Läkemedelsboken", ""));

		//fix width of wide table
		//$("table.wide").before("<hr style='display : none;'>").after("<hr>");

		$("table").css("margin-top", "20px");
		$("table").css("margin-bottom", "20px");

		$("table").each(function(index, item) {
			var $item = $(item);
			$item.css("border-top", "1px solid black");
			$item.css("border-left", "1px solid black");
			//$(item).replaceWith($(item).text());
			//console.log($(item));
			/*if($item.attr("class") == "table table-bordered wide") {
				$item.removeClass("wide");
				$item.removeClass("table");
				$item.removeClass("table-bordered");
				$item.parent().removeClass("wide");
				console.log($(item));
			}*/
		});
		$("td").css("border-right", "1px solid black");
		$("td").css("border-bottom", "1px solid black");
		$("th").css("border-right", "1px solid black");
		$("th").css("border-bottom", "1px solid black");


		//Pandoc does not handle colspans, insert empty td:s
	/*	$("td").each(function(index, item) {
			var $item = $(item);
			if ($item.attr("colspan") !== undefined) {
				var nrOfMissingColumns = parseInt($item.attr("colspan")) - 1;
				if (nrOfMissingColumns > 0) {
					for (var i = 0; i < nrOfMissingColumns; i++) {
						if (i === (nrOfMissingColumns - 1)) {
							$item.after("<td style='border-right:1px solid black; border-bottom: 1px solid black;'>--</td>");
						} else {
							$item.after("<td style='border-right:1px solid black; border-bottom: 1px solid black;'></td>");
						}
					}
				}
			}
		});*/

		/*$("th").each(function(index, item) {
			var $item = $(item);
			if ($item.attr("colspan") !== undefined) {
				var nrOfMissingColumns = parseInt($item.attr("colspan")) - 1;
				if (nrOfMissingColumns > 0) {
					for (var i = 0; i < nrOfMissingColumns; i++) {
						if (i === (nrOfMissingColumns - 1)) {
							$item.after("<th style='border-right:1px solid black; border-bottom: 1px solid black;'>--</th>");
						} else {
							$item.after("<th style='border-right:1px solid black; border-bottom: 1px solid black;'></th>");
						}
					}
				}
			}
		});*/

		/*$("img").each(function(index, item) {
				var $item = $(item);
				convertImagesToBase64($item, $item.attr("src"));
				console.log($item.attr("src"));
		});*/

		//Insert lines before and after figures
		$("div.figure").before("<hr>").after("<hr>");

		$("table.facts").css("background-color", "#f5f5f5");

		$("div.therapy-recommendations").css("background-color", "#f5f5f5");

		$("h1").css("text-align", "center");

		//Write temp html file
		console.log("Writing temp html file: " + tempHtmlPath);
		fs.writeFileSync(tempHtmlPath, $.html(), "utf8");
		console.log();

		var newFileName = path.basename(url, ".html") + "-" + draftOrPublish + "-" + fileNameDate + ".docx";
		 var docx = htmlDocxJs.asBlob($.html());
		 fs.writeFileSync(outPath, docx);
		var arguments = ["-S", tempHtmlPath, "--css="+printCssOldFile, "-o", outPath, '-f', 'html', '-t','docx', '--metadata=author:'+autorsFromPage[0],'--metadata=author:'+autorsFromPage[1]];
		//pandoc.table(mtcars[1:2, ], style = "grid", caption = "Wide table to be split!");
		var hasExited = false;
		//var converter = spawn('pandoc', arguments);
		res.download(outPath, newFileName);


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

router.get("/getunpublishedfiles", function(req, res) {

	contentController.getUnpublishedFiles(function(err, data) {
		console.log(data);
		if (err) {
			res.status(500);
			res.render('error', {
				message: err.message,
				error: err
			});

		} else {
			res.json(data);
		}
	});

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
				updatedPages.clear();
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

router.get("/findoutgoinglinks", function(req, res) {

	var url = req.query["url"];

	var outgoingLinks = {internal: [], external: []};

	if (url !== undefined && url !== "") {

		var outputPath = path.join(contentController.baseDir, "..", "output", "draft");

		var $ = undefined;

		//Read possible rendered page for the current url to check for
		if (fs.existsSync(path.join(contentController.baseDir, "..", "output", "draft", url))) {

			var data = fs.readFileSync(path.join(contentController.baseDir, "..", "output", "draft", url), "utf8");
			$ = cheerio.load(data);

		}

		if ($ !== undefined) {
			//TODO: Better approach when removing components
			//Remove side container
			$("#sideContainer").remove();

			//Remove PDF link
			$("#download-pdf").remove();

			$("a[href]").each(function() {
				var $item = $(this);
				var rawHref = $item.attr("href");
				if (rawHref.length > 0
					&& rawHref.substr(0,1) !== "#"
					&& rawHref.indexOf("/atc/") !== 0
					&& rawHref.indexOf("mailto:") !== 0
					&& rawHref.indexOf("{PDF}") !== 0)
				{

					var fullLinkHtml = $("<div />").append($item.clone()).html();

					var closestId = getClosestId($, $item);
					var closestContentId = getClosestContentId($, $item);


					var $currentPage = undefined;

					var cleanedHref = $item.attr("href");

					var isLinkValid = false;

					if (rawHref.indexOf("http") !== 0) {

						//Internal links can be checked on the fly

						//Remove parameters
						if (cleanedHref.indexOf("?") > -1) {
							cleanedHref = cleanedHref.split("?")[0];
						}

						//Remove hash
						if (cleanedHref.indexOf("#") > -1) {
							cleanedHref = cleanedHref.split("#")[0];
						}

						//Resolve relative paths
						if (cleanedHref.indexOf("./") > -1) {
							cleanedHref = urlObject.resolve(url, cleanedHref);
						}

						var $currentPage = undefined;

						//Find draft of page that is linked
						if (fs.existsSync(path.join(contentController.baseDir, "..", "output", "published", cleanedHref))) {

							var data = fs.readFileSync(path.join(contentController.baseDir, "..", "output", "published", cleanedHref), "utf8");
							$currentPage = cheerio.load(data);

						}

						isLinkValid = checkIfInternalUrlIsValid(rawHref, $currentPage);
					} else {
						//External links need to be checked async
						isLinkValid = checkIfExternalUrlIsValid(rawHref);
					}

					if (closestId.length === 1) {
						closestId = closestId.attr("id");
					} else {
						closestId = "";
					}

					var htmlContext = $item.parent().html();
					var linkText = $item.text();

					if (linkText.trim() === "") {
						linkText = "LINK";
					}

					htmlContext = htmlContext.replace(fullLinkHtml, " __" + linkText + "__ ");

					var context = $("<div>" + htmlContext + "</div>").text();

					link = {path: url, html: fullLinkHtml, rawHref: rawHref, closestId: closestId, closestContentId: closestContentId, isLinkValid: isLinkValid, context: context};

					if (rawHref.indexOf("http") === 0) {
						outgoingLinks.external.push(link);
					} else {
						outgoingLinks.internal.push(link);
					}


				}
			});
		}

		//Check if internal links are valid

		res.json(outgoingLinks);

	} else {
		res.json([]);
	}

});


router.get("/findincominglinks", function(req, res) {

	//TODO: Widen search to include components, somehow

	var url = req.query["url"];

	if (url !== undefined && url !== "") {

		var outputPath = path.join(contentController.baseDir, "..", "output");

		var allFiles = wrench.readdirSyncRecursive(outputPath);

		//Only keep html files
		var foundPages = allFiles.filter(function(element) {
			return path.extname(element) === ".html";
		});

		var linkingPages = [];

		var $currentPublished = undefined;
		var $currentDraft = undefined;

		//Read possible rendered pages for the current url to check for
		if (fs.existsSync(path.join(contentController.baseDir, "..", "output", "draft", url))) {

			var data = fs.readFileSync(path.join(contentController.baseDir, "..", "output", "draft", url), "utf8");
			$currentDraft = cheerio.load(data);

		}

		if (fs.existsSync(path.join(contentController.baseDir, "..", "output", "published", url))) {

			var data = fs.readFileSync(path.join(contentController.baseDir, "..", "output", "published", url), "utf8");
			$currentPublished = cheerio.load(data);

		}


		foundPages.forEach(function(item) {

			//Remove draft/ and published/ from path
			var baseUrl = item.split(path.sep);
			baseUrl.shift();
			baseUrl = path.sep + baseUrl.join(path.sep);

			var $currentPage = undefined;

			if (item.indexOf("published/") > -1) {
				$currentPage = $currentPublished;
			} else if (item.indexOf("draft/") > -1) {
				$currentPage = $currentDraft;
			}

			var links = findLinksToUrl(path.join(outputPath, item), baseUrl, url, $currentPage);
			if (links.length > 0) {
				linkingPages.push({path: item, links: links});
			}
		});


		res.json(linkingPages);

	} else {
		res.json([]);
	}

});

function findLinksToUrl(filePath, baseUrl, url, $currentPage) {

	var tempDir = path.join(__dirname, "..", "tmp");
	var checksum = historyModel.getFileChecksumSync(filePath);

	var precalcResultPath = path.join(tempDir, checksum + ".links");

	if (fs.existsSync(precalcResultPath)) {
		//Already checked for links
		var result = fs.readJsonSync(precalcResultPath, {throws: false});
		if (result === null) {
			return [];
		} else {
			return result;
		}
	} else {
		//Find the links
		var html = fs.readFileSync(filePath, "utf8");
		var $ = cheerio.load(html);

		//Remove components
		//TODO: Add .component class to components for a better filter
		$("#sideContainer").remove();

		var foundLinks = [];

		$("a").each(function(index, item) {
			var $item = $(item);
			if ($item.attr("href") !== undefined) {

				var cleanedHref = $item.attr("href");

				//Remove parameters
				if (cleanedHref.indexOf("?") > -1) {
					cleanedHref = cleanedHref.split("?")[0];
				}

				//Remove hash
				if (cleanedHref.indexOf("#") > -1) {
					cleanedHref = cleanedHref.split("#")[0];
				}

				//Resolve relative paths
				if (cleanedHref.indexOf("./") > -1) {
					cleanedHref = urlObject.resolve(baseUrl, cleanedHref);
				}

				if (cleanedHref === url) {
					var fullLinkHtml = $("<div />").append($item.clone()).html();
					var rawHref = $item.attr("href");

					var closestId = getClosestId($, $item);
					var closestContentId = getClosestContentId($, $item);

					var isLinkValid = checkIfInternalUrlIsValid(rawHref, $currentPage);

					if (closestId.length === 1) {
						closestId = closestId.attr("id");
					} else {
						closestId = "";
					}

					var htmlContext = $item.parent().html();
					var linkText = $item.text();

					if (linkText.trim() === "") {
						linkText = "LINK";
					}

					htmlContext = htmlContext.replace(fullLinkHtml, " __" + linkText + "__ ");

					var context = $("<div>" + htmlContext + "</div>").text();

					foundLinks.push({html: fullLinkHtml, rawHref: rawHref, closestId: closestId, closestContentId: closestContentId, isLinkValid: isLinkValid, context: context});
				}
			}
		});

		return foundLinks;

	}
}

function checkIfInternalUrlIsValid(href, $currentPage) {

	var isValid = true;

	if ($currentPage !== undefined) {

		var currentUrl = urlObject.parse(href, true);

		//Check for ?id= or #hash
		var idInUrl = (currentUrl.hash) ? currentUrl.hash : currentUrl.query["id"];

		if (idInUrl && idInUrl !== "") {
			//Remove possible # from hash
			idInUrl = idInUrl.replace("#", "");

			//Check if that id exists in the current page
			if ($currentPage("#" + idInUrl).length === 0) {
				isValid = false;
			}
		}
	} else {
		isValid = false;
	}

	return isValid;

}

function checkIfExternalUrlIsValid(href) {

	var isValid = false;

	//Build a unique filename based on url and date
	var date = new Date();
	var day = dateFormat(date, "yyyy-mm-dd-hh");

	var stamp = day + href;
	var urlAndDateHash = historyModel.getChecksum(stamp);

	//Place in tmp dir
	var tmpDir = require("os").tmpdir();

	var outputPath = path.join(tmpDir, urlAndDateHash + ".json");

	//console.log(outputPath);

	var result = null;

	if (fs.existsSync(outputPath)) {
		result = fs.readJsonSync(outputPath, {throws: false});
		if (result === null) {
			fs.unlinkSync(outputPath);
		}
	}

	//Return immediately if a request to the same url was made within the last hour
	if (result !== null) {
		return result.result;
	}

	//Perform async request

	//Make sure fast subsequent requests are not triggered
	fs.writeJsonSync(outputPath, {result: "waiting"});

	request(href, function (error, response, body) {

		if (!error && response.statusCode == 200) {
			result = true;
		} else if (!error && response.statusCode !== 200) {
			console.log(response.statusCode + " for " + href);
			result = false;
		} else if (error) {
			result = false;
			console.log("Error with request:");
			console.log(error);
		}

		//Write result to disk
		fs.writeJson(outputPath, {result: result}, function(err) {
			if (err) {
				console.log(err);
			}
		});

	});

	//Return in sync the first time a request is made
	return "waiting";

}


function getClosestContentId($, $item) {
	var closestId = $item.parents(".cms-id").first();

	if (closestId.length === 1) {
		return closestId.attr("id");
	} else {
		return undefined;
	}
}

function getClosestId($, $item) {

	var selector = "[id]";

	var el = $item;

	var match = $();

	while (el.length && !match.length) {

		if (el.attr("id") !== undefined) {
			match = el;
			break;
		} else if (el.find(selector).length) {
			match = el.find(selector).last();
			break;
		}

		if (el.prev().length === 1) {
			el = el.prev();
		} else {

			var par = el.parent();

			if (par.length === 0) {
				break;
			} else {
				el = par;
			}

		}

	}

	return match;
}

router.get("/tasksstatus", function(req, res) {

	res.json(contentController.getTasksStatus());

});

module.exports = router;
