var fs = require("fs");
var path = require("path");
var dateFormat = require("dateformat");
var wrench = require("wrench");
var historyModel = require("./historymodel");
var componentController = require(__dirname +"/../controllers/componentcontroller");
var createSearchIndex = require(__dirname + "/../search/createSearchIndex.js");
var filesize = require("filesize");
var readChunk = require('read-chunk');
var fileType = require('file-type');
var async = require("async");

var ContentModel = {
	baseDir: path.normalize(path.join(__dirname, "..", "content")),
	_contentTypes: undefined,
	_pageTypes: undefined,
	_hooks: {},
	getPageTypes: function() {
		if (!ContentModel._pageTypes) {
			ContentModel._pageTypes = {};
			var folders = fs.readdirSync(__dirname + "/../pagetypes/");
			for (var i = 0; i < folders.length; i++) {
				ContentModel._pageTypes[folders[i]] = JSON.parse(fs.readFileSync(__dirname + "/../pagetypes/" + folders[i] + "/template.json", "utf8"));
			}
		}
		
		return ContentModel._pageTypes;
	},
	getContentTypes: function() {
		if (!ContentModel._contentTypes) {
			ContentModel._contentTypes = {};
			var folders = fs.readdirSync(__dirname + "/../contenttypes/");
			for (var i = 0; i < folders.length; i++) {
				ContentModel._contentTypes[folders[i]] = require(__dirname + "/../contenttypes/" + folders[i] + "/views");
			}
		}
		
		return ContentModel._contentTypes;
	},
	regExpQuote: function(str) {
		return str.replace(/([.?*+^$[\]\\(){}-])/g, "\\$1");
	},
	getContent: function(contentPath, callback) {

		contentPath = unescape(contentPath);

		console.log("ContentModel.getContent: " + contentPath);
		
		ContentModel.existsContent(contentPath, function(err, contentExists) {

			if (err) {
				return callback(err, false);
			}

			if (!contentExists) {
				return callback(new Error("Content at: " + contentPath + " does not exist."))
			}
			
			var fullPath = path.join(ContentModel.baseDir, contentPath);
			
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
							relativePath: filePath.replace(ContentModel.baseDir, "")
						};
						
						if (item.name.indexOf(".json") > 0) {
							item.type = "page";
						}
					
						//Exclude hidden files and dirs
						if (fileName.charAt(0) !== '.' && fileName !== "metadata" && !(fileName.indexOf(".index") > 1)) {
							list.push(item);
						}
					
					}

					
					if (contentPath === "/") {
						var item = {
							name: "processors",
							type: "dir",
							path: null,
							relativePath: "/processors"
						};
						
						list.push(item);
						
					}
				
					if (list.length > 0) {
						//Sort alphabetically
						list.sort(function(a, b){
							if(a.name < b.name) return -1;
							if(a.name > b.name) return 1;
							return 0;
						});


						//Place dirs first in the list
						var dirs = [];

						for (var i = list.length - 1; i >= 0; i--) {

							var item = list[i];
							
							
							if (item.type === "dir") {
								dirs.unshift(list.splice(i, 1)[0]);
							}
							
						}

						if (dirs.length > 0) {
							list = dirs.concat(list);
						}
					
						//Place special dirs before all other items
						var specialDirs = [];
						
						for (var i = list.length - 1; i >= 0; i--) {
							var item = list[i];

							if (item.relativePath === "/images" || item.relativePath === "/components" || item.relativePath === "/processors") {
								specialDirs.push(list.splice(i, 1)[0]);
							}
						}
						
						if (specialDirs.length > 0) {
							list = specialDirs.concat(list);
						}

					}
				
					//Read metadata if it exists
					var metadata = false;
					var possibleMetadataPath = path.join(fullPath, "metadata");
					if (fs.existsSync(possibleMetadataPath)) {
						metadata = JSON.parse(fs.readFileSync(possibleMetadataPath, "utf8"));
						if (Object.keys(metadata).length === 0) {
							metadata = false;
						} 
					}

					//Get drafts that are descendants of this directory
					var baseDir = path.join(ContentModel.baseDir, contentPath);

					var allFiles = wrench.readdirSyncRecursive(baseDir);
		
					var foundPages = allFiles.filter(function(element) {
						return (
							element.indexOf(".json") > -1 
							&& fs.statSync(path.join(baseDir, element)).isFile() 
							&& element.indexOf(".snapshot") === -1 
							&& element.indexOf(".published") === -1
							&& element.indexOf("components/") !== 0
						);
					});

					var draftPages = [];
					
					for (var i = 0; i < foundPages.length; i++) {

						var localPagePath = foundPages[i];
						var globalPagePath = path.join(baseDir, localPagePath);

						//Check if a published version exists
						var pageFileName = path.basename(globalPagePath);
						var pageDirPath = path.dirname(globalPagePath);
						
						var possiblePublishedDirectory = path.join(pageDirPath, ".published." + pageFileName);
						
						var lastVersionIsPublished = false;
						var canBeRevertedToLastPublishedVersion = false;
						
						if (fs.existsSync(possiblePublishedDirectory)) {
							//Find the most recent published version
							var publishedFileNames = fs.readdirSync(possiblePublishedDirectory);

							//Sort descending
							publishedFileNames.sort(function(a, b) {
								return parseInt(b.replace(".published", "")) - parseInt(a.replace(".published", ""));
							});
							
							if (publishedFileNames.length > 0) {
								canBeRevertedToLastPublishedVersion = true;
								var mostRecent = publishedFileNames[0];
								var mostRecentPath = path.join(possiblePublishedDirectory, mostRecent);
								
								var mostRecentPublishedContent = JSON.parse(fs.readFileSync(mostRecentPath, "utf8"));
								var mostRecentDraftContent = JSON.parse(fs.readFileSync(globalPagePath, "utf8"));

								//These values always differ between the two, make sure they are the same
								mostRecentPublishedContent.type = mostRecentDraftContent.type;
								mostRecentPublishedContent.path = mostRecentDraftContent.path;
								mostRecentPublishedContent.modified = mostRecentDraftContent.modified;
								
								//Prepare for comparison
								mostRecentDraftContent = JSON.stringify(mostRecentDraftContent, null, "");
								mostRecentPublishedContent = JSON.stringify(mostRecentPublishedContent, null, "");

								//Grand finale
								if (mostRecentPublishedContent === mostRecentDraftContent) {
									lastVersionIsPublished = true;
								}
							}
							
						}
						
						if (!lastVersionIsPublished) {
							var lastDraftDate = fs.statSync(globalPagePath).mtime.getTime();
							//console.log(lastDraftDate);
							draftPages.push({path: path.join(contentPath, localPagePath), canBeRevertedToLastPublishedVersion: canBeRevertedToLastPublishedVersion, date: lastDraftDate, niceDate: dateFormat(new Date(lastDraftDate), "yyyy-mm-dd HH:MM")});
						}
						
					}

					draftPages.sort(function(a, b) {
						return b.date - a.date;
					});

					var result = {type: "dir", list: list, metadata: metadata, drafts: draftPages};
				
					callback(null, result);
				
				});
				
			} else if (stat.isFile()) {

				var baseName = path.basename(fullPath);
				
				if (path.extname(baseName) === ".json") {
					fs.readFile(fullPath, "utf8", function(err, data) {
					
						if (err) {
							return callback(err);
						} else {
						
							try {
								var result = JSON.parse(data);
								result.type = "file";
								result.path = fullPath;
								callback(null, result);
							} catch (err) {
								return callback(err);
							}
						
						}
					
					});
				} else if (baseName.indexOf(".snapshot") > -1) {
					fs.readFile(fullPath, "utf8", function(err, data) {
					
						if (err) {
							return callback(err);
						} else {
						
							try {
								var result = JSON.parse(data);
								result.type = "snapshot";
								result.path = fullPath;
								callback(null, result);
							} catch (err) {
								return callback(err);
							}
						
						}
					
					});
				} else if (baseName.indexOf(".published") > -1) {
					fs.readFile(fullPath, "utf8", function(err, data) {
					
						if (err) {
							return callback(err);
						} else {
						
							try {
								var result = JSON.parse(data);
								result.type = "published";
								result.path = fullPath;
								callback(null, result);
							} catch (err) {
								return callback(err);
							}
						
						}
					
					});
				} else {

					var buffer = readChunk.sync(fullPath, 0, 262);
 
					var type = fileType(buffer);
					//=> {ext: 'png', mime: 'image/png'} || null
					
					if (type === null) {
						type = "Unknown";
					} else {
						type = type.mime;
					}
					
					var result = {
						type: "unknown",
						path: fullPath,
						size: stat.size,
						niceSize: filesize(stat.size, {round: 1}),
						fileType: type
					};
					callback(null, result);
					//return callback(new Error("Could not handle file: " + fullPath));
				}
				
			} else {
				return callback(new Error(fullPath + " is neither a file nor a directory."))
			}
			
		});

	},
	setContent: function(contentPath, jsonData, publishNow, callback) {

		console.log("ContentModel.setContent: " + contentPath);

		ContentModel.existsContent(contentPath, function(err, contentExists) {

			if (err) {
				return callback(err, false);
			}

			if (!contentExists) {
				return callback(new Error("Content at: " + contentPath + " does not exist."))
			}
			
			var fullPath = path.join(ContentModel.baseDir, contentPath);
			
			var stat = fs.statSync(fullPath);
			
			if (stat.isFile() && contentPath.indexOf(".json" > -1)) {

				var oldData = fs.readFileSync(fullPath, "utf8");
				
				var newData = JSON.stringify(jsonData, null, "\t");
				
				if (oldData !== newData) {

					var now = new Date();
					jsonData.modified = dateFormat(now, "yyyy-mm-dd HH:MM");

					newData = JSON.stringify(jsonData, null, "\t");

					//Save the content
					fs.writeFile(fullPath, newData, "utf8", function(err) {
						if (err) {
							return callback(err);
						} else {
							//Save historic snapshot of the new file
							historyModel.createSnapshot(fullPath, function(err) {
								if (err) {
									//An error is not fatal in this case
									console.log("Error creating snapshot:", err);
								}

								if (publishNow) {
									ContentModel.renderPageDraft(contentPath, true);
									ContentModel.renderPagePublished(contentPath, true, callback);
								} else {
									ContentModel.renderPageDraft(contentPath, true, callback);
								}
							});
						}
					});
					
				} else {
					//Render the page draft even if this page has not changed its content,
					//it could have dependent pages that have changed their content
					if (publishNow) {
						ContentModel.renderPageDraft(contentPath, true);
						ContentModel.renderPagePublished(contentPath, true, callback);
					} else {
						ContentModel.renderPageDraft(contentPath, true, callback);
					}
				}

			} else {
				return callback(new Error("There is no json file at " + contentPath));
			}
		});
	},
	renderPageDraft: function(contentPath, renderDependencies, callback) {

		console.log("ContentModel.renderPageDraft: " + contentPath);

		ContentModel.getContent(contentPath, function(err, data) {
			if (err) {
				if (callback !== undefined) {
					return callback(err);
				} else {
					console.log("Error:", err);
				}
			}
			
			var outPath = path.join(ContentModel.baseDir, "..", "output", "draft", contentPath.replace(".json", ".html"));

			var outDir = outPath.split(path.sep);
			outDir.pop();
			outDir = outDir.join(path.sep);

			wrench.mkdirSyncRecursive(outDir, 0777);

			var pageTemplateName = data.templateName;
			
			if (pageTemplateName === undefined) {
				pageTemplateName = "default";
			}
			
			var pageTemplateLocation = path.join(__dirname, "..", "pagetypes", pageTemplateName);
			
			if (!fs.existsSync(pageTemplateLocation)) {
				if (pageTemplateName === "default") {
					if (callback !== undefined) {
						return callback(new Error("The default template does not exist."));
					} else {
						console.log("Error:", err);
					}
				} else {
					if (callback !== undefined) {
						return callback(new Error("The template named \"" + pageTemplateName + "\" does not exist."));
					} else {
						console.log("Error:", err);
					}
				}
			}

			var headerPath = path.join(pageTemplateLocation, "header.html");
			var footerPath = path.join(pageTemplateLocation, "footer.html");
			
			var header = fs.readFileSync(headerPath, "utf8");
			var footer = fs.readFileSync(footerPath, "utf8");
						
			//Fill in the rest of the meta data
			header = header.replace(/\{title\}/g, data.title);
			header = header.replace(/\{description\}/g, data.description);
			header = header.replace(/\{author\}/g, data.author);
			header = header.replace(/\{subject\}/g, data.subject);
			header = header.replace(/\{keywords\}/g, data.keywords);
			header = header.replace(/\{created\}/g, data.created);
			header = header.replace(/\{modified\}/g, data.modified);
			header = header.replace(/\{published\}/g, data.published);
			header = header.replace(/\{informationType\}/g, data.informationType);

			footer = footer.replace(/\{title\}/g, data.title);
			footer = footer.replace(/\{description\}/g, data.description);
			footer = footer.replace(/\{author\}/g, data.author);
			footer = footer.replace(/\{subject\}/g, data.subject);
			footer = footer.replace(/\{keywords\}/g, data.keywords);
			footer = footer.replace(/\{created\}/g, data.created);
			footer = footer.replace(/\{modified\}/g, data.modified);
			footer = footer.replace(/\{published\}/g, data.published);
			footer = footer.replace(/\{informationType\}/g, data.informationType);
			
			//Render components
			if (data.components && data.components !== undefined) {
				for (var name in data.components) {
					var component = data.components[name];
					if (component.content !== "" && component.content !== undefined && component.content !== "undefined") {
						
						var componentOutput = componentController.getDraftOutput(component.content);

						var re = new RegExp(ContentModel.regExpQuote("{" + name + "}"), "g"); 

						header = header.replace(re, componentOutput);
						footer = footer.replace(re, componentOutput);

					} else {
						var re = new RegExp(ContentModel.regExpQuote("{" + name + "}"), "g"); 

						header = header.replace(re, "");
						footer = footer.replace(re, "");
					}
				}
			} 

			//Fetch hooks from the page template
			var hooks = undefined;
			var hooksPath = path.join(pageTemplateLocation, "hooks.js");
			
			if (ContentModel._hooks[hooksPath] === undefined) {
				hooks = require(hooksPath);
				ContentModel._hooks[hooksPath] = hooks;
			} else {
				hooks = ContentModel._hooks[hooksPath];
			}
			
			//Build pre render output
			var preRender = header + "{MAIN_CONTENT}" + footer;
			
			//Run through pre render template hook from pagetypes
			preRender = hooks.preRender(preRender, data);

			var outContent = [];

			//Setup possible feed
			var feedItems = [];
			
			//Build content from each content type in the page
			for (var i = 0; i < data.content.length; i++) {
				var item = data.content[i];
				item.pagePath = data.path;

				
				var contentViews = ContentModel.getContentTypes()[item.type];
				if (contentViews !== undefined) {
					outContent.push(contentViews.getOutput(item, "draft"));

					if (typeof contentViews.getFeedItems === "function") {
						feedItems = feedItems.concat(contentViews.getFeedItems(item, "draft"));
					}
				} else {
					console.log("No views exist for content type: " + item.type);
				}
				
			}

			//Add the rendered content items to the pre rendered page
			var output = preRender.replace("{MAIN_CONTENT}", outContent.join("\n"));

			//Add specific header and footer for this page
			var headerContent = (data.headerContent || "");
			var footerContent = (data.footerContent || "");

			if (feedItems.length > 0) {
				//A feed is to be linked
				var feedUrlPath = data.path.replace(ContentModel.baseDir, "").replace(/\\/g, "/").replace(".json", ".xml").replace(/\/\//g, "/");
				
				headerContent = "<link rel=\"alternate\" type=\"application/atom+xml\" title=\"" + data.title + "\" href=\"{pre}" + feedUrlPath + "\">\n" + headerContent;
				
				var feedOutPath = outPath.replace(".html", ".xml");
				
				var feedOutput = ContentModel.getFeedOutput(feedItems, data.title, feedUrlPath, data.author);
				
				//TODO: Handle {pre} in links better, read from settings
				feedOutput = feedOutput.replace(/\{pre\}/g, "http://www.lakemedelsboken.se");
				
				//Write feed to disk
				fs.writeFileSync(feedOutPath, feedOutput, "utf8");
				
			}
			
			output = output.replace("{headerContent}", headerContent);
			output = output.replace("{footerContent}", footerContent);

			var relativePath = data.path.replace(ContentModel.baseDir, "").replace(/\\/g, "/").replace(".json", ".html").replace(/\/\//g, "/");

			//Build search index
			//Check if this page is supposed to be indexed
			if (data.indexed !== "false") {
				var chapterName = data.replacesUrl.replace(/\//g, "");
				var searchIndex = createSearchIndex(output, chapterName, relativePath);

				if (searchIndex.length > 1) {

					//Save search index to disk
					var indexPath = data.path.replace(".json", ".index");
					fs.writeFileSync(indexPath, JSON.stringify(searchIndex, null, "\t"), "utf8");

					//Save search index to draft output
					indexPath = outPath.replace(".html", ".index");
					fs.writeFileSync(indexPath, JSON.stringify(searchIndex, null, "\t"), "utf8");

				}

			} else {
				//Check if an old index exists and remove
				var indexPath = data.path.replace(".json", ".index");
				if (fs.existsSync(indexPath)) {
					fs.unlinkSync(indexPath);
				}

				//Also check in draft output
				indexPath = outPath.replace(".html", ".index");
				if (fs.existsSync(indexPath)) {
					fs.unlinkSync(indexPath);
				}
			}

			//Run through post render template hook from pagetypes
			var postRender = hooks.postRender(output, data);
			
			//Determine level of dirs
			var levels = contentPath.replace(/\/\//g, "/").split("/");

			//Remove empty items
			levels = levels.filter(function(item) {
				return item !== "";
			});

			levels = levels.length;
			levels = levels - 1;
			
			var pre = [];
			
			for (var i = 0; i < levels; i++) {
				pre.push("..");
			}
			
			pre = pre.join("/");

			if (levels === 0) {
				pre = ".";
			}



			postRender = postRender.replace(/\{pre\}/g, pre);

			//postRender = postRender.replace(/\{pre\}/g, "/cms/draft");

			//Write the new content of the file
			fs.writeFile(outPath, postRender, "utf8", function(err) {
				if (err) {
					if (callback !== undefined) {
						return callback(err);
					} else {
						console.log("Error:", err);
					}
				} else {
					//Find pages that are dependent on other pages and re-render them
					if (renderDependencies) {

						var dependentPages = ContentModel.getDependentPages(contentPath);
						
						if (dependentPages.length > 0) {
							ContentModel.renderPages(dependentPages, function(err) {
								if (callback !== undefined) {
									return callback(err, postRender);
								}
							});
						} else {
							if (callback !== undefined) {
								return callback(null, postRender);
							}
						}
						
					} else {
						if (callback !== undefined) {
							return callback(null, postRender);
						}
					}
				
				}
			});
			
		});
	},
	renderPages: function(pages, callback) {

		console.log("ContentModel.renderPages \n" + pages.join("\n"));

		var q = async.queue(function (pagePath, callback) {

			//console.log('Render draft: ' + pagePath);
			ContentModel.renderPageDraft(pagePath, false, function(err) {
				
				ContentModel.oneTaskIsDone();
				
				if (err) {
					console.log(err);
					console.log(err.stack);
					return callback(err);
				}
				
				//console.log('Render published: ' + pagePath);
				ContentModel.renderPagePublished(pagePath, false, function(err) {

					ContentModel.oneTaskIsDone();

					if (err) {
						console.log(err);
						console.log(err.stack);
						return callback(err);
					}
					
					callback(null, pagePath);

				});
			});

		}, 1);
		
		// assign a callback
		q.drain = function() {
			//console.log('All items have been rendered');
			return callback(null);
		}
		
		
		if (pages.length === 0) {
			return callback();
		} else {

			//Sort with the deepest in the hierarchy first
			pages.sort(function(a, b) {
				var aLength = a.split("/").length;
				var bLength = b.split("/").length;
			
				return bLength - aLength;
			});
			
			//Now, sort pages with collections last
			var pagesWithCollections = [];
			
			for (var i = pages.length - 1; i >= 0; i--) {
				var page = JSON.parse(fs.readFileSync(path.join(ContentModel.baseDir, pages[i])));
				
				var hasCollection = false;
				
				for (var j = 0; j < page.content.length; j++) {
					if (page.content[j].type === "collection") {
						hasCollection = true;
						break;
					}
				}
				
				if (hasCollection) {
					pagesWithCollections.push(pages.splice(i, 1).join(""));
				}
				
			}
			
			//Sort with the deepest in the hierarchy first
			pagesWithCollections.sort(function(a, b) {
				var aLength = a.split("/").length;
				var bLength = b.split("/").length;
			
				return bLength - aLength;
			});
			
			pages = pages.concat(pagesWithCollections);
			
			for (var i = 0; i < pages.length; i++) {
				q.push(pages[i], function (err, pagePath) {
					//console.log('Finished rendering: ' + pagePath);
				});
			}
		}

		
	},
	getFeedOutput: function(items, title, url, author) {

		var feed = ['<?xml version="1.0" encoding="UTF-8"?>'];
		feed.push('<feed xmlns="http://www.w3.org/2005/Atom">');
		feed.push('  <title>' + title + '</title>');
		feed.push('  <id>{pre}' + url + '</id>');

		if (items.length > 0) {
			var updatedDate = items[0].modified,
			updatedDateStr = updatedDate.toISOString();

			feed.push('  <updated>' + updatedDateStr + '</updated>');

			if (author && author !== "") {
				feed.push('  <author>');
				feed.push('    <name>' + author + '</name>');
				feed.push('  </author>');
			}

			items.forEach(function (article) {

				feed.push('  <entry>');
				feed.push('    <title>' + article.title + '</title>');
				feed.push('    <link rel="alternate" href="' + article.url + '"/>');
				feed.push('    <id>' + article.url + '</id>');
				feed.push('    <published>' + article.published.toISOString() + '</published>');
				feed.push('    <updated>' + article.modified.toISOString() + '</updated>');
				if (article.author && article.author !== "") {
					feed.push('    <author>');
					feed.push('      <name>' + article.author + '</name>');
					feed.push('    </author>');
				}
				feed.push('    <summary type="html">' + article.summary + '</summary>');
				feed.push('    <content type="html">' + article.content + '</content>');
				feed.push('  </entry>');

			});

		}

		feed.push('</feed>');
		
		return feed.join("\n");
	},
	renderPagePublished: function(contentPath, renderDependencies, callback) {

		console.log("ContentModel.renderPagePublished: " + contentPath);

		ContentModel.getContent(contentPath, function(err, data) {
			
			if (err) {
				if (callback !== undefined) {
					//console.log(err);
					throw err;
				} else {
					return callback(err);
				}
			}

			if (data === null || !data.isPublished) {
				return callback(null);
			}
			
			if (!renderDependencies) {
				//Only the first call has renderDependencies set to true, otherwise use published version of dependent page
				var publishedVersionsOfPage = historyModel.getPublished(path.join(ContentModel.baseDir, contentPath));
				if (publishedVersionsOfPage.length > 0) {

					var lastPublishedVersionOfPage = publishedVersionsOfPage[0];
					data = JSON.parse(fs.readFileSync(lastPublishedVersionOfPage.path, "utf8"));

				} else {
					data = null;
				}
			}

			if (data === null) {
				return callback(null);
			}
			
			var outPath = path.join(ContentModel.baseDir, "..", "output", "published", contentPath.replace(".json", ".html"));

			var outDir = outPath.split(path.sep);
			outDir.pop();
			outDir = outDir.join(path.sep);

			wrench.mkdirSyncRecursive(outDir, 0777);

			var pageTemplateName = data.templateName;
			
			if (pageTemplateName === undefined) {
				pageTemplateName = "default";
			}
			
			var pageTemplateLocation = path.join(__dirname, "..", "pagetypes", pageTemplateName);
			
			if (!fs.existsSync(pageTemplateLocation)) {
				if (pageTemplateName === "default") {
					if (callback !== undefined) {
						return callback(new Error("The default template does not exist."));
					} else {
						console.log("Error:", err);
					}
				} else {
					if (callback !== undefined) {
						return callback(new Error("The template named \"" + pageTemplateName + "\" does not exist."));
					} else {
						console.log("Error:", err);
					}
				}
			}

			var headerPath = path.join(pageTemplateLocation, "header.html");
			var footerPath = path.join(pageTemplateLocation, "footer.html");
			
			var header = fs.readFileSync(headerPath, "utf8");
			var footer = fs.readFileSync(footerPath, "utf8");
						
			//Fill in the rest of the meta data
			header = header.replace(/\{title\}/g, data.title);
			header = header.replace(/\{description\}/g, data.description);
			header = header.replace(/\{author\}/g, data.createdBy);
			header = header.replace(/\{subject\}/g, data.subject);
			header = header.replace(/\{keywords\}/g, data.keywords);
			header = header.replace(/\{created\}/g, data.created);
			header = header.replace(/\{modified\}/g, data.modified);
			header = header.replace(/\{published\}/g, data.published);
			header = header.replace(/\{informationType\}/g, data.informationType);

			footer = footer.replace(/\{title\}/g, data.title);
			footer = footer.replace(/\{description\}/g, data.description);
			footer = footer.replace(/\{author\}/g, data.createdBy);
			footer = footer.replace(/\{subject\}/g, data.subject);
			footer = footer.replace(/\{keywords\}/g, data.keywords);
			footer = footer.replace(/\{created\}/g, data.created);
			footer = footer.replace(/\{modified\}/g, data.modified);
			footer = footer.replace(/\{published\}/g, data.published);
			footer = footer.replace(/\{informationType\}/g, data.informationType);

			//Render components
			if (data.components && data.components !== undefined) {
				for (var name in data.components) {
					var component = data.components[name];
					if (component.content !== "" && component.content !== undefined && component.content !== "undefined") {
						
						var componentOutput = componentController.getPublishedOutput(component.content);

						var re = new RegExp(ContentModel.regExpQuote("{" + name + "}"), "g"); 

						header = header.replace(re, componentOutput);
						footer = footer.replace(re, componentOutput);

					} else {
						var re = new RegExp(ContentModel.regExpQuote("{" + name + "}"), "g"); 

						header = header.replace(re, "");
						footer = footer.replace(re, "");
					}
				}
			} 

			//Fetch hooks from the page template
			var hooks = undefined;
			var hooksPath = path.join(pageTemplateLocation, "hooks.js");
			
			if (ContentModel._hooks[hooksPath] === undefined) {
				hooks = require(hooksPath);
				ContentModel._hooks[hooksPath] = hooks;
			} else {
				hooks = ContentModel._hooks[hooksPath];
			}
			
			//Build pre render output
			var preRender = header + "{MAIN_CONTENT}" + footer;
			
			//Run through pre render template hook from pagetypes
			preRender = hooks.preRender(preRender, data);

			var outContent = [];
			
			var feedItems = [];
			
			//Build content from each content type in the page
			for (var i = 0; i < data.content.length; i++) {
				var item = data.content[i];
				item.pagePath = data.path;

				var contentViews = ContentModel.getContentTypes()[item.type];
				if (contentViews !== undefined) {
					outContent.push(contentViews.getOutput(item, "published"));
					
					if (typeof contentViews.getFeedItems === "function") {
						feedItems = feedItems.concat(contentViews.getFeedItems(item, "published"));
					}
					
				} else {
					console.log("No views exist for content type: " + item.type);
				}
				
			}

			//Add the rendered content items to the pre rendered page
			var output = preRender.replace("{MAIN_CONTENT}", outContent.join("\n"));

			//Add header and footer specific for this page
			var headerContent = data.headerContent || "";
			var footerContent = data.footerContent || "";

			if (feedItems.length > 0) {
				//A feed is to be linked
				var feedUrlPath = data.path.replace(ContentModel.baseDir, "").replace(/\\/g, "/").replace(".json", ".xml").replace(/\/\//g, "/");
				
				headerContent = "<link rel=\"alternate\" type=\"application/atom+xml\" title=\"" + data.title + "\" href=\"{pre}" + feedUrlPath + "\">\n" + headerContent;
				
				var feedOutPath = outPath.replace(".html", ".xml");
				
				var feedOutput = ContentModel.getFeedOutput(feedItems, data.title, feedUrlPath, data.author);
				
				//TODO: Handle {pre} in links
				feedOutput = feedOutput.replace(/\{pre\}/g, "http://www.lakemedelsboken.se");
				
				//Write feed to disk
				fs.writeFileSync(feedOutPath, feedOutput, "utf8");
				
			}
			
			output = output.replace("{headerContent}", headerContent);
			output = output.replace("{footerContent}", footerContent);

			var relativePath = data.path.replace(ContentModel.baseDir, "").replace(/\\/g, "/").replace(".json", ".html").replace(/\/\//g, "/");

			//Build search index
			//Check if this page is supposed to be indexed
			if (data.indexed !== "false") {
				var chapterName = data.replacesUrl.replace(/\//g, "");
				var searchIndex = createSearchIndex(output, chapterName, relativePath);

				if (searchIndex.length > 1) {

					//Save search index to disk
					var indexPath = data.path.replace(".json", ".index");
					fs.writeFileSync(indexPath, JSON.stringify(searchIndex, null, "\t"), "utf8");

					//Save search index to published output
					indexPath = outPath.replace(".html", ".index");
					fs.writeFileSync(indexPath, JSON.stringify(searchIndex, null, "\t"), "utf8");
					
				}
				
			} else {
				//Check if an old index exists and remove
				var indexPath = data.path.replace(".json", ".index");
				if (fs.existsSync(indexPath)) {
					fs.unlinkSync(indexPath);
				}

				//Also check in published output
				indexPath = outPath.replace(".html", ".index");
				if (fs.existsSync(indexPath)) {
					fs.unlinkSync(indexPath);
				}
			}
			
			//Run through post render template hook from pagetypes
			var postRender = hooks.postRender(output, data);
			
			//Add current path preset to the page
			//postRender = postRender.replace(/\{pre\}/g, "/cms/published");

			//Determine level of dirs
			var levels = contentPath.replace(/\/\//g, "/").split("/");

			//Remove empty items
			levels = levels.filter(function(item) {
				return item !== "";
			});

			levels = levels.length;
			levels = levels - 1;
			
			var pre = [];
			
			for (var i = 0; i < levels; i++) {
				pre.push("..");
			}
			
			pre = pre.join("/");

			if (levels === 0) {
				pre = ".";
			}

			postRender = postRender.replace(/\{pre\}/g, pre);

			//Write the new content of the file
			fs.writeFile(outPath, postRender, "utf8", function(err) {
				if (err) {
					if (callback !== undefined) {
						return callback(err);
					} else {
						console.log("Error:", err);
					}
				} else {
					//Find pages that are dependent on other pages and re-render them
					if (renderDependencies) {

						var dependentPages = ContentModel.getDependentPages(contentPath);

						if (dependentPages.length > 0) {
							ContentModel.renderPages(dependentPages, function(err) {
								if (callback !== undefined) {
									return callback(err);
								}
							});
						} else {
							if (callback !== undefined) {
								return callback(null);
							}
						}
						
					} else {
						if (callback !== undefined) {
							callback(null);
						}
					}
				}
			});
		});
	},
	existsDir: function(contentPath, callback) {

		var dirPath = path.join(ContentModel.baseDir, contentPath);

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

		var fullPath = path.join(ContentModel.baseDir, contentPath);

		fs.exists(fullPath, function(exists) {
			if (exists) {
				fs.stat(fullPath, function(err, stats) {
					if (err) {
						return callback(err);
					} else {
						if (stats.isFile() || stats.isDirectory()) {
							return callback(null, true);
						} else {
							console.log(stats);
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
		
		var baseDirPath = path.join(ContentModel.baseDir, baseDir);
		
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
	createPage: function(pageName, pageType, baseDir, callback) {
		if (typeof pageName !== "string") {
			return callback(new Error("Name: " + pageName + " is not a string."));
		}
		
		pageName = pageName.replace(".json", "");
		
		//Remove unwanted characters from page name
		pageName = pageName.replace(/([^a-z0-9_]+)/gi, '-');
		if (pageName.length > 200) {
			pageName = pageName.substr(0, 200);
		}
		
		pageName = pageName + ".json";
		
		if (typeof baseDir !== "string") {
			return callback(new Error("Base dir: " + baseDir + " is not a string."));
		}
		
		var baseDirPath = path.join(ContentModel.baseDir, baseDir);
		
		if (!fs.existsSync(baseDirPath)) {
			return callback(new Error(baseDir + " does not exist."));
		}
		
		if (!fs.statSync(baseDirPath).isDirectory()) {
			return callback(new Error(baseDir + " is not a directory"));
		}
		
		var newPagePath = path.join(baseDirPath, pageName);
		
		if (fs.existsSync(newPagePath)) {
			return callback(new Error("A file already exists at: " + newPagePath));
		}
		
		//Fetch the right template
		var pageTemplate = JSON.parse(fs.readFileSync(__dirname + "/../pagetypes/" + pageType + "/template.json", "utf8"));
		
		var now = new Date();
		pageTemplate.created = dateFormat(now, "yyyy-mm-dd HH:MM");

		//Fix any empty unique id:s
		var pageTemplate = JSON.stringify(pageTemplate, null, "\t");

		while (pageTemplate.indexOf("{GUID}") > -1) {
			pageTemplate = pageTemplate.replace("{GUID}", ContentModel.getGUID());
		}
		
		fs.writeFile(newPagePath, pageTemplate, "utf8", function(err) {
			if (err) {
				return callback(err);
			} else {
				callback(null);
			}
		});
	},
	publishPage: function(pagePath, callback) {
		ContentModel.getContent(pagePath, function(err, data) {
			if (err) {
				return callback(err);
			}
			
			data.isPublished = true;
			var now = new Date();
			if (data.published === "") {
				data.published = dateFormat(now, "yyyy-mm-dd HH:MM");
			}

			ContentModel.setContent(pagePath, data, true, function(err) {
				if (err) {
					return callback(err);
				}
				historyModel.publishPage(pagePath, function(err) {
					if (err) {
						return callback(err);
					}

					ContentModel.setContent(pagePath, data, true, callback);
				});
			});
		});
	},
	unpublishPage: function(pagePath, callback) {
		ContentModel.getContent(pagePath, function(err, data) {
			if (err) {
				return callback(err);
			}
			
			data.isPublished = false;
			data.published = "";

			//Remove page from published directory
			var outPath = path.join(ContentModel.baseDir, "..", "output", "published", pagePath.replace(".json", ".html"));

			if (fs.existsSync(outPath)) {
				fs.unlinkSync(outPath);
			}
			
			//Check if feed exists and remove
			outPath = path.join(ContentModel.baseDir, "..", "output", "published", pagePath.replace(".json", ".xml"));

			if (fs.existsSync(outPath)) {
				fs.unlinkSync(outPath);
			}

			//Check if index exists and remove
			outPath = path.join(ContentModel.baseDir, "..", "output", "published", pagePath.replace(".json", ".index"));

			if (fs.existsSync(outPath)) {
				fs.unlinkSync(outPath);
			}
			
			ContentModel.setContent(pagePath, data, false, callback);
		});
	},
	removePage: function(pagePath, callback) {
		if (typeof pagePath !== "string") {
			return callback(new Error("Page path: " + pagePath + " is not a string."));
		}
		
		var fullPath = path.join(ContentModel.baseDir, pagePath);
		
		if (!fs.existsSync(fullPath)) {
			return callback(new Error(pagePath + " does not exist."));
		}
		
		if (!fs.statSync(fullPath).isFile()) {
			return callback(new Error(pagePath + " is not a file"));
		}

		//Get dependent pages
		var dependentPages = ContentModel.getDependentPages(pagePath);
		
		//Remove the index
		var indexPath = fullPath.replace(".json", ".index");

		if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
			fs.unlinkSync(indexPath);
		}

		//Remove any published versions
		//Check if draft version exists
		var outPath = path.join(ContentModel.baseDir, "..", "output", "draft", pagePath.replace(".json", ".html"));
		
		if (fs.existsSync(outPath)) {
			fs.unlinkSync(outPath);
		}

		//Feed
		outPath = path.join(ContentModel.baseDir, "..", "output", "draft", pagePath.replace(".json", ".xml"));
		
		if (fs.existsSync(outPath)) {
			fs.unlinkSync(outPath);
		}

		//Index
		outPath = path.join(ContentModel.baseDir, "..", "output", "draft", pagePath.replace(".json", ".index"));
		
		if (fs.existsSync(outPath)) {
			fs.unlinkSync(outPath);
		}

		//Check if published version exists
		outPath = path.join(ContentModel.baseDir, "..", "output", "published", pagePath.replace(".json", ".html"));

		if (fs.existsSync(outPath)) {
			fs.unlinkSync(outPath);
		}

		//Feed
		outPath = path.join(ContentModel.baseDir, "..", "output", "published", pagePath.replace(".json", ".xml"));

		if (fs.existsSync(outPath)) {
			fs.unlinkSync(outPath);
		}

		//Index
		outPath = path.join(ContentModel.baseDir, "..", "output", "published", pagePath.replace(".json", ".index"));

		if (fs.existsSync(outPath)) {
			fs.unlinkSync(outPath);
		}
		
		//The container
		fs.unlinkSync(fullPath);
		
		//TODO: Remove snapshot history
		
		//TODO: Remove published history
		
		//Render dependent pages
		if (dependentPages.length > 0) {
			ContentModel.renderPages(dependentPages, function(err) {
				if (callback !== undefined) {
					return callback(err);
				}
			});
		} else {
			if (callback !== undefined) {
				return callback(null);
			}
		}
		
	},
	getDependentPages: function(pagePath) {

		var dependentPages = [];

		//Render dependent pages
		var allFiles = wrench.readdirSyncRecursive(ContentModel.baseDir);
		var foundPages = allFiles.filter(function(element) {
			return (
				element.indexOf(".json") > -1 && 
				element.indexOf(".snapshot") === -1 && 
				element.indexOf(".published") === -1 && 
				element.indexOf("components/") === -1 && 
				fs.statSync(ContentModel.baseDir + "/" + element).isFile()
			);
		});


		for (var i = 0; i < foundPages.length; i++) {
			var foundPagePath = foundPages[i];
			var page = JSON.parse(fs.readFileSync(path.join(ContentModel.baseDir, foundPagePath), "utf8"));
			var pageContent = page.content;

			//Add content from published version to list of pageContent
			if (page.isPublished === true) {

				//Find most recent published version
				var publishedVersions = historyModel.getPublished(path.join(ContentModel.baseDir, foundPagePath));
				
				if (publishedVersions.length > 0) {
					var lastPublished = publishedVersions[0];
					
					lastPublished = JSON.parse(fs.readFileSync(lastPublished.path, "utf8"));
				
					var publishedPageContent = lastPublished.content;
		
					pageContent = pageContent.concat(publishedPageContent);
				}
			}

		
			var pageIsDependent = false;
		
			//If a page has a collection, check if this page is part of that collection
			for (var j = 0; j < pageContent.length; j++) {
				if (pageContent[j].type === "collection") {

					var views = ContentModel.getContentTypes()["collection"];

					//Get matching pages from collection
					pageContent[j].pagePath = path.join(ContentModel.baseDir, foundPagePath);
					var draftPages = views.getSortedPages(pageContent[j], "draft");
					var publishedPages = views.getSortedPages(pageContent[j], "published");

					var allPages = draftPages.concat(publishedPages);

					for (var k = 0; k < allPages.length; k++) {
						//console.log("Comparing: " + allPages[k].contentPath + " with: " + pagePath.replace(".json", ".html"));
						if (allPages[k].contentPath === pagePath.replace(".json", ".html")) {
							//console.log("Matched: " + allPages[k].contentPath + " with: " + pagePath.replace(".json", ".html"));
							pageIsDependent = true;
							break;
						}
					}
					
					if (pageIsDependent) {
						break;
					}

				}
			}
		
			if (pageIsDependent) {
				dependentPages.push(foundPagePath);
			}
		
		}
		
		//console.log(dependentPages);
		
		return dependentPages;
		
	},
	rmdir: function(dirName, callback) {
		if (typeof dirName !== "string") {
			return callback(new Error("Dir name: " + dirName + " is not a string."));
		}
		
		var baseDirPath = path.join(ContentModel.baseDir, dirName);
		
		if (!fs.existsSync(baseDirPath)) {
			return callback(new Error(baseDirPath + " does not exist."));
		}
		
		if (!fs.statSync(baseDirPath).isDirectory()) {
			return callback(new Error(baseDirPath + " is not a directory"));
		}
		
		var possibleMetadataPath = path.join(baseDirPath, "metadata");
		
		if (fs.existsSync(possibleMetadataPath)) {
			fs.unlinkSync(possibleMetadataPath);
		}
		
		wrench.rmdirSyncRecursive(baseDirPath);

		//Remove any published versions
		//Check if draft version exists
		var outPath = path.join(ContentModel.baseDir, "..", "output", "draft", dirName);
		
		if (fs.existsSync(outPath)) {
			wrench.rmdirSyncRecursive(outPath, true);
		}
		
		//Check if published version exists
		outPath = path.join(ContentModel.baseDir, "..", "output", "published", dirName);

		if (fs.existsSync(outPath)) {
			wrench.rmdirSyncRecursive(outPath, true);
		}
		
		callback(null);

	},
	modifyMetadata: function(dirName, key, value, callback) {
		if (typeof dirName !== "string") {
			return callback(new Error("Dir name: " + dirName + " is not a string."));
		}
		
		var baseDirPath = path.join(ContentModel.baseDir, dirName);
		
		if (!fs.existsSync(baseDirPath)) {
			return callback(new Error(baseDirPath + " does not exist."));
		}
		
		if (!fs.statSync(baseDirPath).isDirectory()) {
			return callback(new Error(baseDirPath + " is not a directory"));
		}
		
		var possibleMetadataPath = path.join(baseDirPath, "metadata");
		
		var metadata = {};
		
		if (fs.existsSync(possibleMetadataPath)) {
			metadata = JSON.parse(fs.readFileSync(possibleMetadataPath, "utf8"));
		}
		
		metadata[key] = value;
		
		fs.writeFile(possibleMetadataPath, JSON.stringify(metadata, null, "\t"), "utf8", callback);

	},
	removeMetadata: function(dirName, key, callback) {
		if (typeof dirName !== "string") {
			return callback(new Error("Dir name: " + dirName + " is not a string."));
		}
		
		var baseDirPath = path.join(ContentModel.baseDir, dirName);
		
		if (!fs.existsSync(baseDirPath)) {
			return callback(new Error(baseDirPath + " does not exist."));
		}
		
		if (!fs.statSync(baseDirPath).isDirectory()) {
			return callback(new Error(baseDirPath + " is not a directory"));
		}
		
		var possibleMetadataPath = path.join(baseDirPath, "metadata");
		
		var metadata = {};
		
		if (fs.existsSync(possibleMetadataPath)) {
			metadata = JSON.parse(fs.readFileSync(possibleMetadataPath, "utf8"));
		}

		if (metadata.hasOwnProperty(key)) {
			delete metadata[key];
		
			fs.writeFile(possibleMetadataPath, JSON.stringify(metadata, null, "\t"), "utf8", callback);
			
		} else {
			return callback(null);
		}

	},
	rename: function(before, after, callback) {
		if (typeof before !== "string") {
			return callback(new Error("Before: " + before + " is not a string."));
		}

		if (typeof after !== "string") {
			return callback(new Error("After: " + after + " is not a string."));
		}
		
		//Remove unwanted characters from after
		after = after.replace(/([^a-z0-9\/]+)/gi, '-');
		if (after.length > 200) {
			after = after.substr(0, 200);
		}

		if (after === "") {
			return callback(new Error("After was empty."));
		}
		
		var beforePath = path.join(ContentModel.baseDir, before);
		
		if (!fs.existsSync(beforePath)) {
			return callback(new Error(beforePath + " does not exist."));
		}

		var afterPath = path.join(ContentModel.baseDir, after);
		
		if (fs.existsSync(afterPath)) {
			return callback(new Error("A file or directory already exists at: " + afterPath));
		}
		
		if (before === "/") {
			return callback(new Error("Cannot rename root directory."));
		}
		
		fs.rename(beforePath, afterPath, callback);
	},
	getGUID: function() {
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
			var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
			return v.toString(16);
		});
	},
	moveContentItemUp: function(contentItemName, pageId, callback) {
		//Check if page exists and is a file
		var fullPath = path.join(ContentModel.baseDir, pageId);
		if (!fs.existsSync(fullPath)) {
			return callback(new Error("Path: " + pageId + " does not exist."));
		}
		
		if (!fs.statSync(fullPath).isFile()) {
			return callback(new Error("Path: " + pageId + " is not a file."));
		}

		if (pageId.indexOf(".json") < 0) {
			return callback(new Error("Path: " + pageId + " is not a json file."));
		}

		ContentModel.getContent(pageId, function(err, data) {
			if (err) {
				return callback(err);
			} else {
				
				var contentToMove = null;
				var oldIndex = null;
				
				for (var i = data.content.length - 1; i >= 0; i--) {
					if (data.content[i].name === contentItemName) {
						oldIndex = i;
						contentToMove = data.content.splice(i, 1);
						break;
					}
				}
				
				if (contentToMove && contentToMove.length === 1) {
					
					contentToMove = contentToMove[0];

					var newIndex = oldIndex - 1;
					if (newIndex < 0) {
						newIndex = 0;
					}
					
					data.content.splice(newIndex, 0, contentToMove);

					//Save
					ContentModel.setContent(pageId, data, false, function(err) {
						if (err) {
							return callback(err);
						}
						return callback();
					});
				} else {
					return callback(new Error("Item with name: " + contentItemName + " does not exist."));
				}
			}
		});
		
	},
	moveContentItemDown: function(contentItemName, pageId, callback) {
		//Check if page exists and is a file
		var fullPath = path.join(ContentModel.baseDir, pageId);
		if (!fs.existsSync(fullPath)) {
			return callback(new Error("Path: " + pageId + " does not exist."));
		}
		
		if (!fs.statSync(fullPath).isFile()) {
			return callback(new Error("Path: " + pageId + " is not a file."));
		}

		if (pageId.indexOf(".json") < 0) {
			return callback(new Error("Path: " + pageId + " is not a json file."));
		}

		ContentModel.getContent(pageId, function(err, data) {
			if (err) {
				return callback(err);
			} else {
				
				var contentToMove = null;
				var oldIndex = null;
				
				for (var i = data.content.length - 1; i >= 0; i--) {
					if (data.content[i].name === contentItemName) {
						oldIndex = i;
						contentToMove = data.content.splice(i, 1);
						break;
					}
				}
				
				if (contentToMove && contentToMove.length === 1) {
					
					contentToMove = contentToMove[0];

					var newIndex = oldIndex + 1;
					
					data.content.splice(newIndex, 0, contentToMove);

					//Save
					ContentModel.setContent(pageId, data, false, function(err) {
						if (err) {
							return callback(err);
						}
						return callback();
					});
				} else {
					return callback(new Error("Item with name: " + contentItemName + " does not exist."));
				}
			}
		});
		
	},
	removeContentItemFromPage: function(contentItemName, pageId, callback) {

		//Check if page exists and is a file
		var fullPath = path.join(ContentModel.baseDir, pageId);
		if (!fs.existsSync(fullPath)) {
			return callback(new Error("Path: " + pageId + " does not exist."));
		}
		
		if (!fs.statSync(fullPath).isFile()) {
			return callback(new Error("Path: " + pageId + " is not a file."));
		}

		if (pageId.indexOf(".json") < 0) {
			return callback(new Error("Path: " + pageId + " is not a json file."));
		}

		ContentModel.getContent(pageId, function(err, data) {
			if (err) {
				return callback(err);
			} else {
				for (var i = data.content.length - 1; i >= 0; i--) {
					if (data.content[i].name === contentItemName) {
						data.content.splice(i, 1);
						break;
					}
				}
				
				//Save
				ContentModel.setContent(pageId, data, false, function(err) {
					if (err) {
						return callback(err);
					}
					return callback();
				});
			}
		});
	},
	addContentItemToPage: function(contentTypeName, pageId, insertAfterId, callback) {
		//Check if page exists and is a file
		var fullPath = path.join(ContentModel.baseDir, pageId);
		if (!fs.existsSync(fullPath)) {
			return callback(new Error("Path: " + pageId + " does not exist."));
		}
		
		if (!fs.statSync(fullPath).isFile()) {
			return callback(new Error("Path: " + pageId + " is not a file."));
		}

		if (pageId.indexOf(".json") < 0) {
			return callback(new Error("Path: " + pageId + " is not a json file."));
		}
		
		//Create a new unique id for this content
		var id = ContentModel.getGUID();
		
		//Load template for type
		var contentTypes = ContentModel.getContentTypes();
		var contentType = contentTypes[contentTypeName].getDefaultType();

		if (contentType === undefined) {
			return callback(new Error("Content type: " + contentTypeName + " does not exist."));
		}

		contentType.id = id;
		contentType.name = id;

		//Load page
		ContentModel.getContent(pageId, function(err, data) {
			if (err) {
				return callback(err);
			}
			
			//Default to insert as a normal push
			var insertAfterIndex = data.content.length - 1;

			if (insertAfterIndex < 0) {
				insertAfterIndex = 0;
			}
			
			//Find id of possible item to insert after
			if (insertAfterId !== undefined && insertAfterId !== "") {
				for (var i = 0; i < data.content.length; i++) {
					if (data.content[i].name === insertAfterId) {
						insertAfterIndex = i;
						break;
					}
				}
			}
			
			data.content.splice(insertAfterIndex + 1, 0, contentType);
			
			ContentModel.setContent(pageId, data, false, function(err) {
				if (err) {
					return callback(err);
				}
				return callback();
			});
			
		});
		
	},
	resetTasks: function() {
		var tasks = {toBeProcessed: 0, finished: 0};
		ContentModel.saveTasks(tasks);
	},
	addTasks: function(number) {
		var tasks = JSON.parse(fs.readFileSync(path.join(__dirname, "temp", "tasks.json"), "utf8"));
		tasks.toBeProcessed += number;
		ContentModel.saveTasks(tasks);
	},
	oneTaskIsDone: function() {
		var tasks = JSON.parse(fs.readFileSync(path.join(__dirname, "temp", "tasks.json"), "utf8"));
		tasks.finished += 1;
		ContentModel.saveTasks(tasks);
	},
	getTasksStatus: function() {
		var tasks = JSON.parse(fs.readFileSync(path.join(__dirname, "temp", "tasks.json"), "utf8"));
		return tasks;
	},
	saveTasks: function(tasks) {
		fs.writeFileSync(path.join(__dirname, "temp", "tasks.json"), JSON.stringify(tasks, null, ""), "utf8");
	}
};

module.exports = ContentModel;