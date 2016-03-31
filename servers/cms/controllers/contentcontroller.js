var fs = require("fs-extra");
var path = require("path");
var contentModel = require("../models/contentmodel");
var escape = require("escape-html");
var wrench = require("wrench");
var historyModel = require("../models/historymodel");
var async = require("async");
var crypto = require("crypto")
var extend = require("node.extend");
var shell = require("shelljs");
var imageController = require("./imagecontroller");

function Publisher(options) {
	
	var self = this;
	
	//console.log("Init publisher...")
	//console.log(options);
	
	//TODO: Fix in settings
	var defaultOptions = {
		port: 22,
		username: "",
		host: "",
		privateKey: "",
		remoteDir: ""
	};
	
	self.options = extend(defaultOptions, options);
	
	if (self.options.privateKey.indexOf("BEGIN RSA PRIVATE KEY") === -1) {
		//Try to read from file
		var key = "";
		if (fs.existsSync(self.options.privateKey)) {
			key = fs.readFileSync(self.options.privateKey, "utf8");
		}
		
		if (key.indexOf("BEGIN RSA PRIVATE KEY") === -1) {
			throw new Error("Could not find private key at: " + self.options.privateKey);
		} else {
			self.options.privateKey = key
		}
	}
	
	//TODO: Check options
	var Client = require("scp2").Client;

	this.client = new Client(self.options);
	
};

Publisher.prototype.getLastPayload = function(callback) {

	console.log("Fetching last payload from server...");

	var self = this;
	var payloadRemotePath = path.join(self.options.remoteDir, "payload.json");
	self.client.download(payloadRemotePath, path.join(__dirname, "temp", "recentpayload.json"), function(err) {
		if (err) {
			return callback(err, []);
		} else {
			return callback(null, JSON.parse(fs.readFileSync(path.join(__dirname, "temp", "recentpayload.json"), "utf8")));
		}
	});
};

Publisher.prototype.publish = function(item, callback) {
	var self = this;

	var remoteFilePath = path.join(self.options.remoteDir, item.relativePath);
	
	self.client.upload(item.path, remoteFilePath, function(err){
		callback(err);
	});
	
	
};

Publisher.prototype.finished = function() {
	this.client.close();
};


var ContentController = {
	baseDir: contentModel.baseDir,
	getContentTypes: function() {
		return contentModel.getContentTypes();
	},
	getPageTypes: function() {
		return contentModel.getPageTypes();
	},
	renderPageDraft: function(contentPath, renderDependencies, callback) {
		contentModel.renderPageDraft(contentPath, renderDependencies, callback);
	},
	publishPage: function(pagePath, callback) {
		contentModel.publishPage(pagePath, callback);
	},
	unpublishPage: function(pagePath, callback) {
		contentModel.unpublishPage(pagePath, callback);
	},
	getContent: function(contentPath, callback) {
		contentModel.getContent(contentPath, callback);
	},
	setContent: function(contentPath, data, publishNow, callback) {
		contentModel.setContent(contentPath, data, publishNow, callback);
	},
	addContentItemToPage: function(contentType, pageId, insertAfterId, callback) {
		contentModel.addContentItemToPage(contentType, pageId, insertAfterId, callback);
	},
	removeContentItemFromPage: function(contentItemName, pageId, callback) {
		contentModel.removeContentItemFromPage(contentItemName, pageId, callback);
	},
	moveContentItemUp: function(contentItemName, pageId, callback) {
		contentModel.moveContentItemUp(contentItemName, pageId, callback);
	},
	moveContentItemDown: function(contentItemName, pageId, callback) {
		contentModel.moveContentItemDown(contentItemName, pageId, callback);
	},
	existsDir: function(contentPath, callback) {
		contentModel.existsDir(contentPath, callback);
	},
	existsContent: function(contentPath, callback) {
		contentModel.existsContent(contentPath, callback);
	},
	revertToLastPublishedPage: function(pagePath, comment, callback) {

		var globalPagePath = path.join(ContentController.baseDir, pagePath);

		//Check if a published version exists
		var pageFileName = path.basename(globalPagePath);
		var pageDirPath = path.dirname(globalPagePath);
		
		var possiblePublishedDirectory = path.join(pageDirPath, ".published." + pageFileName);
		
		//Can it be reverted?
		if (fs.existsSync(possiblePublishedDirectory)) {
			//Find the most recent published version
			var publishedFileNames = fs.readdirSync(possiblePublishedDirectory);

			//Sort descending
			publishedFileNames.sort(function(a, b) {
				return parseInt(b.replace(".published", "")) - parseInt(a.replace(".published", ""));
			});
			
			if (publishedFileNames.length > 0) {
				var mostRecent = publishedFileNames[0];
				var mostRecentPath = path.join(possiblePublishedDirectory, mostRecent);
				
				var mostRecentPublishedContent = JSON.parse(fs.readFileSync(mostRecentPath, "utf8"));
				var mostRecentDraftContent = JSON.parse(fs.readFileSync(globalPagePath, "utf8"));

				//These values always differ between the two, make sure they are the same
				mostRecentPublishedContent.type = mostRecentDraftContent.type;
				mostRecentPublishedContent.path = mostRecentDraftContent.path;
				
				var publishNowBool = false;
				
				contentModel.setContent(pagePath, mostRecentPublishedContent, publishNowBool, function(err) {
					if (err) {
						return callback(err);
					}
					
					//Exit OK
					return callback();
				}, comment);

			} else {
				console.log(pagePath + " has no published version, can not revert.");
				return callback();
			}
			
		} else {
			console.log(pagePath + " has no published version, can not revert.");
			return callback();
		}
		
	},


	revertToSnapshot: function(pagePath, snapshotPath, comment, callback) {

		var contentPagePath = path.join(ContentController.baseDir, pagePath);

		var snapshotPagePath = path.join(ContentController.baseDir, snapshotPath);

		console.log(contentPagePath);
		console.log(snapshotPagePath);

		try {

			var statsSnapshot = fs.statSync(snapshotPagePath);
			var statsGlobal = fs.statSync(contentPagePath);

			if (statsSnapshot.isFile() && statsGlobal.isFile()) {
				var snapshotPage = JSON.parse(fs.readFileSync(snapshotPagePath, "utf8"));
				var contentPage = JSON.parse(fs.readFileSync(contentPagePath, "utf8"));

				//These values always differ between the two, make sure they are the same
				snapshotPage.type = contentPage.type;
				snapshotPage.path = contentPage.path;

				var publishNowBool = false;

				contentModel.setContent(pagePath, snapshotPage, publishNowBool, function(err) {
					if (err) {
						return callback(err);
					}

					//Exit OK
					return callback();
				}, comment);

			}

		} catch (e){
			console.log(pagePath + " has no snapshot version, can not revert.");
			return callback(e);
		}
	},


	getEditors: function(page) {
		
		var contentEditors = [];
		
		var content = page.content;
		
		if (content && content.length > 0) {
			for (var i = 0; i < content.length; i++) {
				var item = content[i];
				item.pagePath = page.path;
				
				var contentViews = contentModel.getContentTypes()[item.type];
				if (contentViews !== undefined) {
					var editorContent = contentViews.getEditor(item);

					//Add interface for settings
					editorContent += ContentController.getSettingsEditor(item);
					
					contentEditors.push(editorContent);
				} else {
					console.log("No views exist for content type: " + item.type);
				}
			
			}
		} 
		
		return contentEditors;
	},
	getSettingsEditor: function(item) {

		var output = ["<div><button class=\"btn btn-default\" type=\"button\" data-toggle=\"collapse\" data-target=\"#processors_" + item.name + "\" aria-expanded=\"false\" aria-controls=\"processors_" + item.name + "\"><i class=\"fa fa-tasks\"></i> Processorer <i class=\"fa fa-caret-down\"></i></button><div class=\"collapse\" id=\"processors_" + item.name + "\">"];
		
		var preProcessorsDirPath = path.join(__dirname, "..", "preprocessors");
		var preProcessorFiles = fs.readdirSync(preProcessorsDirPath);
		
		
		var postProcessorsDirPath = path.join(__dirname, "..", "postprocessors");
		var postProcessorFiles = fs.readdirSync(postProcessorsDirPath);
		
		preProcessorFiles = preProcessorFiles.filter(function(element) {
			return fs.statSync(path.join(preProcessorsDirPath, element)).isFile() && element.charAt(0) !== ".";
		});

		postProcessorFiles = postProcessorFiles.filter(function(element) {
			return fs.statSync(path.join(postProcessorsDirPath, element)).isFile() && element.charAt(0) !== ".";
		});

		if (preProcessorFiles.length > 0) {
			output.push("<h5>Exkludera följande preprocessorer</h5>");
			
			for (var i = 0; i < preProcessorFiles.length; i++) {
				
				var checkedValue = "";
				if (item.settings.preprocessors && item.settings.preprocessors[preProcessorFiles[i]] === "true") {
					checkedValue = "checked";
				}

				output.push('<input type="hidden" name="settings:{name}:preprocessors:' + preProcessorFiles[i] + '" value="false">')
				output.push('<div class="checkbox col-sm-offset-1">');
				output.push('<label class="control-label">');
				output.push('<input type="checkbox" name="settings:{name}:preprocessors:' + preProcessorFiles[i] + '" ' + checkedValue + ' value="true">');
				output.push(preProcessorFiles[i]);
				output.push('</label>');
				output.push('</div>');
			}
			
		}

		if (postProcessorFiles.length > 0) {
			output.push("<h5>Exkludera följande postprocessorer</h5>");
			
			for (var i = 0; i < postProcessorFiles.length; i++) {

				var checkedValue = "";
				if (item.settings.postprocessors && item.settings.postprocessors[postProcessorFiles[i]] === "true") {
					checkedValue = "checked";
				}

				output.push('<input type="hidden" name="settings:{name}:postprocessors:' + postProcessorFiles[i] + '" value="false">')
				output.push('<div class="checkbox col-sm-offset-1">');
				output.push('<label class="control-label">');
				output.push('<input type="checkbox" name="settings:{name}:postprocessors:' + postProcessorFiles[i] + '" ' + checkedValue + ' value="true">');
				output.push(postProcessorFiles[i]);
				output.push('</label>');
				output.push('</div>');
			}
			
		}
		
		output.push("</div></div>");

		output = output.join("\n");

		output = output.replace(/\{name\}/g, item.name);

		return output;
	},
	getPreviews: function(page) {
		
		var contentPreviews = [];
		
		var content = page.content;
		
		if (content && content.length > 0) {
			for (var i = 0; i < content.length; i++) {
				var item = content[i];
				item.pagePath = page.path;
				
				var contentViews = contentModel.getContentTypes()[item.type];
				if (contentViews !== undefined) {
					if (item.type === "html") {
						contentPreviews.push(escape(contentViews.getOutput(item).replace(/\{pre\}/g, "/cms/draft")));
					} else {
						contentPreviews.push(contentViews.getOutput(item).replace(/\{pre\}/g, "/cms/draft"));
					}
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
		contentModel.mkdir(dirName, baseDir, callback);
	},
	rmdir: function(dirName, callback) {
		contentModel.rmdir(dirName, callback);
	},
	modifyMetadata: function(dirName, key, value, callback) {
		contentModel.modifyMetadata(dirName, key, value, callback);
	},
	removeMetadata: function(dirName, key, callback) {
		contentModel.removeMetadata(dirName, key, callback);
	},
	createPage: function(pageName, pageType, baseDir, callback) {
		contentModel.createPage(pageName, pageType, baseDir, callback);
	},
	removePage: function(pagePath, callback) {
		contentModel.removePage(pagePath, callback);
	},
	movePage: contentModel.movePage,
	rename: function(before, after, callback) {
		
		if (after.indexOf("/images/") === 0) {
			return callback(new Error("The path can not be a sub directory of /images/: " + after));
		}
		
		contentModel.rename(before, after, callback);
	},
	renderPages: function(pages, callback) {
		contentModel.renderPages(pages, callback);
	},
	getUnpublishedFiles: function(callback) {

		var outputDirPath = path.join(ContentController.baseDir, "..", "output");
		var publishedDirPath = path.join(outputDirPath, "published");

		//Add files to payload
		var allFiles = wrench.readdirSyncRecursive(publishedDirPath);
		
		var payload = [];
		for (var i = 0; i < allFiles.length; i++) {
			var fullPath = path.join(publishedDirPath, allFiles[i]);
			var stat = fs.statSync(fullPath);
			if (stat.isFile()) {
				payload.push({path: fullPath, relativePath: "published/" + allFiles[i], type: "file", hash: ContentController.createHashSync(fullPath)});
			} else if (stat.isDirectory()) {
				//No need to upload dirs, they will be created anyway
				//payload.push({path: fullPath, relativePath: allFiles[i], type: "dir"});
			} else {
				console.log("Could not handle: " + fullPath);
			}
			
		}
		
		var secretSettingsPath = path.join(__dirname, "..", "..", "..", "settings", "secretSettings.json");
		var secretSettings = null;

		if (fs.existsSync(secretSettingsPath)) {
			secretSettings = JSON.parse(fs.readFileSync(secretSettingsPath, "utf8"));
		}

		var publishServerOptions = {};
		
		if (secretSettings && secretSettings.cms.publishServerOptions) {
			publishServerOptions = secretSettings.cms.publishServerOptions;
		}

		var publisher = new Publisher(publishServerOptions);

		publisher.getLastPayload(function(err, lastPayload) {

			if (err) {
				return callback(err);
			}

			var cleanedPayload = JSON.parse(JSON.stringify(payload));

			//Remove files in payload that already seem to exist on server
			for (var i = cleanedPayload.length - 1; i >= 0; i--) {
				var item = cleanedPayload[i];
				for (var j = 0; j < lastPayload.length; j++) {
					var uploadedItem = lastPayload[j];
					if (item.relativePath === uploadedItem.relativePath && item.hash === uploadedItem.hash) {
						//Remove
						//console.log("Removing " + item.relativePath + " from cleanedPayload");
						cleanedPayload.splice(i, 1);
						break;
					}
				}
			}
			
			//Files that only exist in the last published payload are deleted
			var deletedFiles = JSON.parse(JSON.stringify(lastPayload));

			//Remove files in payload that are present in the new payload
			for (var i = deletedFiles.length - 1; i >= 0; i--) {
				var item = deletedFiles[i];
				for (var j = 0; j < payload.length; j++) {
					var newItem = payload[j];
					if (item.relativePath === newItem.relativePath) {
						//Remove
						deletedFiles.splice(i, 1);
						break;
					}
				}
			}
			
			
			//Fix relative path
			cleanedPayload.forEach(function(item) {
				item.relativePath = item.relativePath.replace("published/", "");
			});

			//Filter out index files
			for (var i = cleanedPayload.length - 1; i >= 0; i--) {
				var item = cleanedPayload[i];
				if (item.type === "file" && path.extname(item.relativePath) === ".index") {
					cleanedPayload.splice(i, 1);
				}
			}

			//Fix relative path
			deletedFiles.forEach(function(item) {
				item.relativePath = item.relativePath.replace("published/", "");
			});

			//Filter out index files and static files
			for (var i = deletedFiles.length - 1; i >= 0; i--) {
				var item = deletedFiles[i];
				if (item.type === "file" && (path.extname(item.relativePath) === ".index" || item.relativePath.indexOf("static/") === 0)) {
					deletedFiles.splice(i, 1);
				}
			}
			
			var affectedFiles = [];

			for (var i = 0; i < deletedFiles.length; i++) {
				affectedFiles.push("DELETED " + deletedFiles[i].relativePath);
			}
			
			for (var i = 0; i < cleanedPayload.length; i++) {
				affectedFiles.push(cleanedPayload[i].relativePath);
			}
			
			return callback(null, affectedFiles);
			
		});
		
	},
	publishExternal: function(uploadAllFiles, callback) {

		var outgoing = path.normalize(path.join(ContentController.baseDir, "..", "payloads", "outgoing"));

		//Clean outgoing, except .gitignore
		var gitIgnore = fs.readFileSync(path.join(outgoing, ".gitignore"), "utf8");
		fs.emptyDirSync(outgoing);
		fs.writeFileSync(path.join(outgoing, ".gitignore"), gitIgnore, "utf8");
		
		//Copy published and static dirs to outgoing
		var outputDirPath = path.join(ContentController.baseDir, "..", "output");
		var publishedDirPath = path.join(outputDirPath, "published");
		var staticDirPath = path.join(outputDirPath, "static");
		var staticOutgoingDirPath = path.join(outgoing, "static");
		var publishedOutgoingDirPath = path.join(outgoing, "published");
		
		wrench.copyDirSyncRecursive(publishedDirPath, publishedOutgoingDirPath, {
			forceDelete: true, // Whether to overwrite existing directory or not
			excludeHiddenUnix: true, // Whether to copy hidden Unix files or not (preceding .)
			preserveFiles: false, // If we're overwriting something and the file already exists, keep the existing
			preserveTimestamps: true, // Preserve the mtime and atime when copying files
			inflateSymlinks: true //, Whether to follow symlinks or not when copying files
//			filter: regexpOrFunction, // A filter to match files against; if matches, do nothing (exclude).
//			whitelist: bool, // if true every file or directory which doesn't match filter will be ignored
//			include: regexpOrFunction, // An include filter (either a regexp or a function)
//			exclude: regexpOrFunction // An exclude filter (either a regexp or a function)
		});

		wrench.copyDirSyncRecursive(staticDirPath, staticOutgoingDirPath, {
			forceDelete: true, // Whether to overwrite existing directory or not
			excludeHiddenUnix: true, // Whether to copy hidden Unix files or not (preceding .)
			preserveFiles: false, // If we're overwriting something and the file already exists, keep the existing
			preserveTimestamps: true, // Preserve the mtime and atime when copying files
			inflateSymlinks: true //, Whether to follow symlinks or not when copying files
//			filter: regexpOrFunction, // A filter to match files against; if matches, do nothing (exclude).
//			whitelist: bool, // if true every file or directory which doesn't match filter will be ignored
//			include: regexpOrFunction, // An include filter (either a regexp or a function)
//			exclude: regexpOrFunction // An exclude filter (either a regexp or a function)
		});

/*
		//Clear uncompressed css and js
		wrench.rmdirSyncRecursive(path.join(staticOutgoingDirPath, "css", "uncompressed"));
		wrench.rmdirSyncRecursive(path.join(staticOutgoingDirPath, "js", "uncompressed"));

		//Clear non optimized images
		var imagesPath = path.join(staticOutgoingDirPath, "images");
		var allImages = wrench.readdirSyncRecursive(imagesPath);
		
		allImages.forEach(function(image) {
			var imagePath = path.join(imagesPath, image);
			if (image.indexOf(".png") > -1 && image.indexOf("/opt/") === -1 && fs.statSync(imagePath).isFile()) {
				fs.unlinkSync(imagePath);
			}
		});
*/
		
		//Add files to payload
		var allFiles = wrench.readdirSyncRecursive(outgoing);
		
		var payload = [];
		for (var i = 0; i < allFiles.length; i++) {
			var fullPath = path.join(outgoing, allFiles[i]);
			var stat = fs.statSync(fullPath);
			if (stat.isFile()) {
				payload.push({path: fullPath, relativePath: allFiles[i], type: "file", hash: ContentController.createHashSync(fullPath)});
			} else if (stat.isDirectory()) {
				//No need to upload dirs, they will be created anyway
				//payload.push({path: fullPath, relativePath: allFiles[i], type: "dir"});
			} else {
				console.log("Could not handle: " + fullPath);
			}
			
		}

		//Write payload to disk
		var payloadPath = path.join(outgoing, "payload.json")
		fs.writeFileSync(payloadPath, JSON.stringify(payload, null, "\t"), "utf8");

		//console.log("Payload length: " + payload.length);

		var secretSettingsPath = path.join(__dirname, "..", "..", "..", "settings", "secretSettings.json");
		var secretSettings = null;

		if (fs.existsSync(secretSettingsPath)) {
			secretSettings = JSON.parse(fs.readFileSync(secretSettingsPath, "utf8"));
		}

		var publishServerOptions = {};
		
		if (secretSettings && secretSettings.cms.publishServerOptions) {
			publishServerOptions = secretSettings.cms.publishServerOptions;
		}

		var publisher = new Publisher(publishServerOptions);

		//Transfer
		var q = async.queue(function(item, callback) {

			if (item.type === "file") {
				console.log("Begin transfer of: " + item.relativePath);

				//Transfer with scp
				publisher.publish(item, function(err) {
					if (err) {
						return callback(err, item.relativePath);
					} else {
						return callback(null, item.relativePath);
					}
				});

			} else {
				//console.log("Skipping dir: " + item.relativePath);
				callback(null, item.relativePath);
			}

		}, 1);

		// assign a callback
		q.drain = function() {

			console.log('All items have been transferred');

			//Deliver the payload description
			var item = {path: payloadPath, relativePath: "payload.json", type: "file"};
			publisher.publish(item, function(err) {
				
				ContentController.oneTaskIsDone();
				
				if (err) {
					return callback(err, item.relativePath);
				} else {
					return callback(null, item.relativePath);
				}
				
			});


			publisher.finished();
			return callback();
		}
		
		
		if (payload.length === 0) {
			publisher.finished();
			ContentController.resetTasks();
			return callback();
		} else {

			//Fetch most recent payload
			publisher.getLastPayload(function(err, lastPayload) {

				var cleanedPayload = JSON.parse(JSON.stringify(payload));

				if (!uploadAllFiles) {
					//Remove files in payload that already seem to exist on server
					for (var i = cleanedPayload.length - 1; i >= 0; i--) {
						var item = cleanedPayload[i];
						for (var j = 0; j < lastPayload.length; j++) {
							var uploadedItem = lastPayload[j];
							if (item.relativePath === uploadedItem.relativePath && item.hash === uploadedItem.hash) {
								//Remove
								//console.log("Removing " + item.relativePath + " from cleanedPayload");
								cleanedPayload.splice(i, 1);
								break;
							}
						}
					}
				}

				ContentController.resetTasks();
				if (cleanedPayload.length > 0) {
					//+1 for upload of payload file
					ContentController.addTasks(cleanedPayload.length + 1);

					for (var i = 0; i < cleanedPayload.length; i++) {
						q.push(cleanedPayload[i], function (err, result) {

							ContentController.oneTaskIsDone();

							if (err) {
								console.log(err);
							} else {
								console.log('Finished transfer: ' + result);
							}
						});
					}
				} else {
					//+1 for upload of payload file
					ContentController.addTasks(1);
					//Force drain of queue
					q.drain();
				}
				
			});

		}
		
	},
	recreateAll: function(callback) {

		console.log("ContentController.recreateAll()");
		
		//TODO: Set a new version number
		//TODO: Make sure version is updated when uploading to master server
		
		//Remove all files of type index, xml and html in output/published and output/draft
		var draftDir = path.join(ContentController.baseDir, "..", "output", "draft");
		var draftFiles = wrench.readdirSyncRecursive(draftDir);

		draftFiles = draftFiles.filter(function(element) {

			var isFile = false;
			
			try {
				isFile = fs.statSync(path.join(draftDir, element)).isFile();
			} catch(err) {
				console.log("Error when statSync.isFile(): " + element);
				isFile = false;
			}

			return (
				(path.extname(element) === ".xml" || path.extname(element) === ".html" || path.extname(element) === ".index") &&
				isFile
			);
		});
		
		//Find old published pages
		for (var i = 0; i < draftFiles.length; i++) {
			var filePath = path.join(draftDir, draftFiles[i]);
			console.log("Deleting: " + filePath);
			fs.unlinkSync(filePath);
		}

		var publishedDir = path.join(ContentController.baseDir, "..", "output", "published");
		var publishedFiles = wrench.readdirSyncRecursive(publishedDir);

		publishedFiles = publishedFiles.filter(function(element) {
			var isFile = false;
			
			try {
				isFile = fs.statSync(path.join(publishedDir, element)).isFile();
			} catch(err) {
				console.log("Error when statSync.isFile(): " + element);
				isFile = false;
			}

			return (
				(path.extname(element) === ".xml" || path.extname(element) === ".html" || path.extname(element) === ".index") &&
				isFile
			);
		});

		//Delete old published pages
		for (var i = 0; i < publishedFiles.length; i++) {
			var filePath = path.join(publishedDir, publishedFiles[i]);
			console.log("Deleting: " + filePath);
			fs.unlinkSync(filePath);
			//ContentController.oneTaskIsDone();
		}
		
		//Get all content files, render
		var files = wrench.readdirSyncRecursive(ContentController.baseDir);
		var foundPages = files.filter(function(element) {
			return (
				element.indexOf(".json") > -1 && 
				element.indexOf(".snapshot") === -1 && 
				element.indexOf(".published") === -1 && 
				element.indexOf("components/") === -1 && 
				fs.statSync(ContentController.baseDir + "/" + element).isFile()
			);
		});

		//Setup tasks
		ContentController.resetTasks();
		//+2 for redirects and sitemap, each foundPage is rendered twice
		ContentController.addTasks((foundPages.length * 2) + 2);


		//TODO: Delete empty directories
		
		//Recreate images
		ContentController.recreateAllImages(function(err) {

			if (err) {
				console.log("Error: Could not recreate images in a correct manner");
			}

			if (foundPages.length > 0) {

				//Build sitemap
				var siteMapContent = ContentController.getSiteMap(foundPages);
				fs.writeFileSync(path.join(__dirname, "..", "output", "published", "sitemap.xml"), siteMapContent, "utf8");
				ContentController.oneTaskIsDone();
			
				//Build redirects
				var redirects = ContentController.getPublishedRedirects(foundPages);
				fs.writeFileSync(path.join(__dirname, "..", "output", "published", "redirects.json"), JSON.stringify(redirects, null, "\t"), "utf8");
				ContentController.oneTaskIsDone();

				//Render the pages
				ContentController.renderPages(foundPages, callback);
			} else {
				callback();
			}
			
		});


	},
	recreateAllImages: function(callback) {

		console.log("ContentController.recreateAllImages()");

		//Make sure images in /output/static/images/ are created

		//Find all images
		var imagesDir = path.join(ContentController.baseDir, "..", "content", "images");
		var imageFiles = wrench.readdirSyncRecursive(imagesDir);
		
		//Filter only png files
		imageFiles = imageFiles.filter(function(element) {
			return (
				path.extname(element) === ".png" &&
				fs.statSync(path.join(imagesDir, element)).isFile()
			);
		});
		
		if (imageFiles.length > 0) {
			ContentController.addTasks(imageFiles.length);
			
			//Setup queue task
			var q = async.queue(function(item, callback) {

				var originalImagePath = path.join(imagesDir, item);
				var outputDir = path.join(ContentController.baseDir, "..", "output", "static", "images", item);
				var forceOverwrite = false;

				imageController.createImageSizes(originalImagePath, outputDir, forceOverwrite, function(err, results) {
					
					if (err) {
						console.log("Error when trying to create image sizes for " + item);
					}

					ContentController.oneTaskIsDone();
					return callback(null, item);
					
				});

			}, 1);
		
			//Return when all images are done
			q.drain = function() {
				return callback();
			}
			
			//Add tasks to queue
			for (var i = 0; i < imageFiles.length; i++) {
				
				q.push(imageFiles[i], function (err, name) {
					//Done
				});

			}
			
		} else {
			return callback();
		}
		
	},
	getPublishedRedirects: function(pages) {

		var redirects = [];
		
		for (var i = 0; i < pages.length; i++) {

			//Find out if page is published 
			var page = JSON.parse(fs.readFileSync(path.join(ContentController.baseDir, pages[i]), "utf8"));
			if (page.isPublished) {
				
				//Now read the last published version of this page
				var versions = historyModel.getPublished(page.path);
				
				if (versions.length > 0) {

					page = JSON.parse(fs.readFileSync(versions[0].path, "utf8"));
					
					//Does the page have a redirect?
					if (page.replacesUrl && page.replacesUrl !== "" && (typeof page.replacesUrl === "string") && page.replacesUrl.length > 0) {
						//Make sure string begins with a slash
						if (page.replacesUrl.charAt(0) !== '/') {
							page.replacesUrl = "/" + page.replacesUrl;
						}
					
						redirects.push({path: page.replacesUrl, target: "/" + pages[i].replace(".json", ".html"), type: 301});
					}
					
				}
			}
		}
		
		return redirects;
		
	},
	getSiteMap: function(pages) {
		var header = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xsi:schemaLocation=\"http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd\" xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n";
		var footer = "\n</urlset>";
	
		var content = [];

		for (var i = 0; i < pages.length; i++) {

			//Find out if page is published 
			var page = JSON.parse(fs.readFileSync(path.join(ContentController.baseDir, pages[i]), "utf8"));
			if (page.isPublished) {
				content.push("\t<url>");
				content.push("\t\t<loc>http://www.lakemedelsboken.se/" + pages[i].replace(".json", ".html") + "</loc>");
				content.push("\t</url>");
			}
		}
	
		content = content.join("\n");
	
		var sitemap = header + content + footer;
		return sitemap;
	
	},
	resetTasks: function() {
		contentModel.resetTasks();
	},
	addTasks: function(number) {
		contentModel.addTasks(number);
	},
	oneTaskIsDone: function() {
		contentModel.oneTaskIsDone();
	},
	getTasksStatus: function() {
		return contentModel.getTasksStatus();
	},
	clearCaches: function(callback) {
		//Clear preparsed_genericas
		var preparsedGenericasDirPath = path.join(__dirname, "..", "postprocessors", "admininterfaces", "genericas", "preparsed_genericas");
		
		if (fs.existsSync(preparsedGenericasDirPath)) {

			//Remove all .txt files
			var files = fs.readdirSync(preparsedGenericasDirPath);
			files.forEach(function(fileName) {
				
				if (path.extname(fileName) === ".txt") {
					fs.unlinkSync(path.join(preparsedGenericasDirPath, fileName));
				}
				
			});

		}

		//Clear search indices
		var searchIndexCacheDirPath = path.join(__dirname, "..", "search", "cache");

		if (fs.existsSync(searchIndexCacheDirPath)) {
			//Remove .json files
			var files = fs.readdirSync(searchIndexCacheDirPath);
			files.forEach(function(fileName) {
				
				if (path.extname(fileName) === ".json") {
					fs.unlinkSync(path.join(searchIndexCacheDirPath, fileName));
				}
				
			});
		}

		//Clear preparsed synonyms
		var synonymsCacheDirPath = path.join(__dirname, "..", "search", "synonyms", "preparsed_synonyms");

		if (fs.existsSync(synonymsCacheDirPath)) {
			//Remove .txt files
			var files = fs.readdirSync(synonymsCacheDirPath);
			files.forEach(function(fileName) {
				
				if (path.extname(fileName) === ".txt") {
					fs.unlinkSync(path.join(synonymsCacheDirPath, fileName));
				}
				
			});
		}
		
		//TODO: Clear /payloads?
		
		//TODO: Clear /services/archives and /services/deployments?

		//Clear hashes in historymodel
		if (historyModel !== undefined && historyModel.contentHashes !== undefined) {
			historyModel.contentHashes = {};
		}

		callback(null)
		
	},
	saveToLog: function(message, pathToLog) {

		if (message !== undefined && pathToLog !== undefined) {

			var log = [];

			if (fs.existsSync(pathToLog) && fs.statSync(pathToLog).isFile()) {
				try {
					log = JSON.parse(fs.readFileSync(pathToLog, "utf8"));
				} catch(err) {
					log = [];
				}
			}
		
			var item = {date: new Date().getTime(), message: message};
		
			console.log("Log: " + message);
			log.unshift(item);
		
			if (log.length > 100) {
				log.length = 100;
			}
		
			fs.writeFileSync(pathToLog, JSON.stringify(log, null, "\t"), "utf8");
			
		} else {
			console.log("Could not save to log path: " + pathToLog + " with message: " + message);
		}
		
	},
	saveContentToGitHub: function(callback) {

		var gitStatusLogPath = path.join(__dirname, "..", "public", "status", "github.json");

		ContentController.saveToLog("Beginning upload to GitHub...", gitStatusLogPath);

		if (!shell.which("git")) {

			ContentController.saveToLog("Could not find git, could not upload content changes.", gitStatusLogPath);

			return callback();

		}
		
		var contentDirPath = path.join(__dirname, "..", "content").replace(/\s/g, "\\ ");
		var outputDirPath = path.join(__dirname, "..", "output").replace(/\s/g, "\\ ");
		var keywordsDirPath = path.join(__dirname, "..", "postprocessors", "admininterfaces", "genericas", "keywords.json").replace(/\s/g, "\\ ");
		
		ContentController.saveToLog("Checking content dir...", gitStatusLogPath);
		
		ContentController.checkAndUploadPathToGit(contentDirPath, function(err) {
			if (err) {
				return callback(err);
			}

			ContentController.saveToLog("Checking output dir...", gitStatusLogPath);

			ContentController.checkAndUploadPathToGit(outputDirPath, function(err) {
				if (err) {
					return callback(err);
				}

				ContentController.saveToLog("Checking keywords file...", gitStatusLogPath);

				ContentController.checkAndUploadPathToGit(keywordsDirPath, function(err) {
					if (err) {
						return callback(err);
					}
				
					return callback();
				});

			});
			
			
		});
		
	},
	checkAndUploadPathToGit: function(contentDirPath, callback) {

		var gitStatusLogPath = path.join(__dirname, "..", "public", "status", "github.json");

		var gitStatus = shell.exec("git status " + contentDirPath + "", {silent: true}).output;
		
		var nrOfLines = gitStatus.split("\n").length;

		if (nrOfLines <= 5) {
			//No changed files
			ContentController.saveToLog("There are no changes in the content tree for: " + contentDirPath, gitStatusLogPath);

			//ContentController.saveToLog("Finished without uploading.", gitStatusLogPath);

			return callback();

		} else {

			var upload = shell.exec("git add -A " + contentDirPath + " && git commit -m 'Auto commit' && git push", {async: true}, function(code, output) {

				if (code !== 0) {

					ContentController.saveToLog("Error: code: " + code + ", message: " + output, gitStatusLogPath);
					ContentController.saveToLog("Finished with error.", gitStatusLogPath);

					return callback();
				}

				ContentController.saveToLog("Finished upload to GitHub for: " + contentDirPath, gitStatusLogPath);

				return callback();

			});

			upload.stdout.on("data", function(data) {
				ContentController.saveToLog(data, gitStatusLogPath);
			});
			
			upload.stderr.on("data", function(data) {
				ContentController.saveToLog(data, gitStatusLogPath);
			});
			
		}
		
	},
	createHash: function(path, callback) {

		fs.exists(path, function(exists) {
			if (exists) {
				var fd = fs.createReadStream(path);
				var hash = crypto.createHash("md5");
				hash.setEncoding("hex");

				fd.on('error', function(err) {
					return callback(err);
				});

				fd.on('end', function() {
					hash.end();
					callback(null, hash.read());
				});

				fd.pipe(hash);
			} else {
				return callback(new Error("Path does not exist: " + path));
			}
		});
	},
	createHashSync: function(path) {
		
		var hash = crypto.createHash("md5");

		try {
			hash.update(fs.readFileSync(path));
		} catch (err) {
			return undefined;
		}

		return hash.digest("hex");
		
	},
	getGUID: contentModel.getGUID
	
};


module.exports = ContentController;