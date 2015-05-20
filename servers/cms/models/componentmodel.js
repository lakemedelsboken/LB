var fs = require("fs");
var path = require("path");
var dateFormat = require("dateformat");
var wrench = require("wrench");
var historyModel = require("./historymodel");
//var createSearchIndex = require(__dirname + "/../search/createSearchIndex.js");
var filesize = require("filesize");
var readChunk = require('read-chunk');
var fileType = require('file-type');
var contentModel = require("./contentmodel.js");

var ComponentModel = {
	baseDir: path.normalize(path.join(__dirname, "..", "content")),
	_componentTypes: undefined,
	contentModel: undefined,
	getComponentTypes: function() {
		if (!ComponentModel._componentTypes) {
			ComponentModel._componentTypes = {};
			var componentTypesPath = path.join(__dirname, "..", "componenttypes")
			var folders = fs.readdirSync(componentTypesPath);
			for (var i = 0; i < folders.length; i++) {
				var templateFilePath = path.join(componentTypesPath, folders[i], "template.json")
				ComponentModel._componentTypes[folders[i]] = JSON.parse(fs.readFileSync(templateFilePath, "utf8"));
			}
		}
		
		return ComponentModel._componentTypes;
	},
	getContent: function(contentPath, callback) {

		contentPath = unescape(contentPath);

		console.log("ComponentModel.getContent: " + contentPath);
		
		ComponentModel.existsContent(contentPath, function(err, contentExists) {
			
			if (err) {
				return callback(err, false);
			}

			if (!contentExists) {
				return callback(new Error("Content at: " + contentPath + " does not exist."))
			}

			var fullPath = path.join(ComponentModel.baseDir, contentPath);
			
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
							relativePath: filePath.replace(ComponentModel.baseDir, "")
						};
						
						if (item.name.indexOf(".json") > 0) {
							item.type = "component";
						}
					
						//Exclude hidden files and dirs
						if (fileName.substr(0, 1) !== "." && fileName !== "metadata" && !(fileName.indexOf(".index") > 1)) {
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
					var baseDir = path.join(ComponentModel.baseDir, contentPath);

					var allFiles = wrench.readdirSyncRecursive(baseDir);
		
					var foundComponents = allFiles.filter(function(element) {
						return (
							element.indexOf(".json") > -1 && 
							fs.statSync(path.join(baseDir, element)).isFile() && 
							element.indexOf(".snapshot") === -1 && 
							element.indexOf(".published") === -1
						);
					});

					var draftComponents = [];
					
					for (var i = 0; i < foundComponents.length; i++) {

						var localComponentPath = foundComponents[i];
						var globalComponentPath = path.join(baseDir, localComponentPath);

						//Check if a published version exists
						var componentFileName = path.basename(globalComponentPath);
						var componentDirPath = path.dirname(globalComponentPath);
						
						var possiblePublishedDirectory = path.join(componentDirPath, ".published." + componentFileName);
						
						var lastVersionIsPublished = false;
						
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
								var mostRecentDraftContent = JSON.parse(fs.readFileSync(globalComponentPath, "utf8"));

								//These values always differ between the two
								mostRecentPublishedContent.type = mostRecentDraftContent.type;
								mostRecentPublishedContent.path = mostRecentDraftContent.path;
								
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
							var lastDraftDate = fs.statSync(globalComponentPath).mtime.getTime();
							//console.log(lastDraftDate);
							draftComponents.push({path: path.join(contentPath, localComponentPath), date: lastDraftDate, niceDate: dateFormat(new Date(lastDraftDate), "yyyy-mm-dd HH:MM:ss")});
						}
						
					}

					draftComponents.sort(function(a, b) {
						return b.date - a.date;
					});

					var result = {type: "dir", list: list, metadata: metadata, drafts: draftComponents};
				
					callback(null, result);
				
				});
			} else if (stat.isFile()) {

				var baseName = path.basename(fullPath);
				
				if (baseName.indexOf(".json") > -1) {
					fs.readFile(fullPath, "utf8", function(err, data) {
					
						if (err) {
							return callback(err);
						} else {

							try {
								var result = JSON.parse(data);
								result.type = "component";
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

		console.log("ComponentModel.setContent: " + contentPath);

		ComponentModel.existsContent(contentPath, function(err, contentExists) {

			if (err) {
				return callback(err, false);
			}

			if (!contentExists) {
				return callback(new Error("Content at: " + contentPath + " does not exist."))
			}
			
			var fullPath = path.join(ComponentModel.baseDir, contentPath);
			
			var stat = fs.statSync(fullPath);
			
			if (stat.isFile() && contentPath.indexOf(".json" > -1)) {

				var oldData = fs.readFileSync(fullPath, "utf8");
				
				var newData = JSON.stringify(jsonData, null, "\t");
				
				if (oldData !== newData) {

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
									ComponentModel.renderComponentPublished(contentPath, true, callback);
								} else {
									ComponentModel.renderComponentDraft(contentPath, true, callback);
								}
							});
						}
					});
					
				} else {
					//Render the component draft even if this component has not changed its content,
					//it could have dependent components that have changed their content
					if (publishNow) {
						ComponentModel.renderComponentPublished(contentPath, true, callback);
					} else {
						ComponentModel.renderComponentDraft(contentPath, true, callback);
					}
				}

			} else {
				return callback(new Error("There is no json file at " + contentPath));
			}
		});
	},
	renderComponentDraft: function(contentPath, renderDependencies, callback) {

		console.log("ComponentModel.renderComponentDraft: " + contentPath);

		if (ComponentModel.contentModel === undefined) {
			ComponentModel.contentModel = require("./contentmodel.js");
		}

		//console.log(contentModel);

		ComponentModel.getContent(contentPath, function(err, data) {
			if (err) {
				if (callback !== undefined) {
					return callback(err);
				} else {
					console.log("Error:", err);
				}
			}
			
			//Find pages that are dependent on other components and re-render them
			if (renderDependencies) {
				var allFiles = wrench.readdirSyncRecursive(ComponentModel.baseDir);
				var foundPages = allFiles.filter(function(element) {
					return (
						element.indexOf(".json") > -1 && 
						element.indexOf(".snapshot") === -1 && 
						element.indexOf(".published") === -1 && 
						element.indexOf("components/") === -1 &&
						fs.statSync(ComponentModel.baseDir + "/" + element).isFile()
					);
				});

				var dependentPages = [];

				for (var i = 0; i < foundPages.length; i++) {
					var pagePath = foundPages[i];
					//console.log("Checking: " + pagePath);
					var page = JSON.parse(fs.readFileSync(path.join(ComponentModel.baseDir, pagePath), "utf8"));
					var pageContent = page.content;
					var pageComponents = page.components;
				
					var pageIsDependent = false;

					//TODO: If a page has an instance of this component it is considered dependent
					if (!pageIsDependent && pageComponents !== undefined) {
						for (var name in pageComponents) {
							if (pageComponents[name].content !== "" && pageComponents[name].content !== undefined && pageComponents[name].content !== null &&pageComponents[name].content.length > 0) {
								//Read component
								var componentFullPath = path.join(ComponentModel.baseDir, pageComponents[name].content);
								//console.log("Checking for " + componentFullPath);
								if (fs.existsSync(componentFullPath)) {
									var componentJSON = fs.readFileSync(componentFullPath, "utf8");
									if (componentJSON) {
										var component = JSON.parse(componentJSON);
										if (component.id === data.id) {
											pageIsDependent = true;
											break;
										}
									}
								}
							}
						}
					}
				
					if (pageIsDependent) {
						
						dependentPages.push(pagePath);

					}
				
				}
				
				if (dependentPages.length > 0) {
					ComponentModel.contentModel.renderPages(dependentPages, function(err) {
						if (err) {
							console.log(err);
						}
					});

					if (callback !== undefined) {
						return callback(err);
					}

				} else {
					if (callback !== undefined) {
						return callback(null);
					}
				}
				
			} else {
				if (callback !== undefined) {
					return callback(null);
				}
			}
		
			
		});
	},
	renderComponentPublished: function(contentPath, renderDependencies, callback) {

		console.log("ComponentModel.renderComponentPublished: " + contentPath);

		if (ComponentModel.contentModel === undefined) {
			ComponentModel.contentModel = require("./contentmodel.js");
		}

		ComponentModel.getContent(contentPath, function(err, data) {
			
			if (err) {
				return callback(err);
			}
			
			if (!renderDependencies) {
				//Only the first call has renderDependencies set to true, otherwise use the last published version of dependent page
				var publishedVersionsOfComponent = historyModel.getPublished(path.join(ComponentModel.baseDir, contentPath));
				if (publishedVersionsOfComponent.length > 0) {

					var lastPublishedVersionOfComponent = publishedVersionsOfComponent[0];
					data = JSON.parse(fs.readFileSync(lastPublishedVersionOfComponent.path, "utf8"));

				} else {
					data = null;
				}
			}

			if (data === null) {
				return callback(null);
			}
			
			if (renderDependencies) {
				var allFiles = wrench.readdirSyncRecursive(ComponentModel.baseDir);
				var foundPages = allFiles.filter(function(element) {
					return (
						element !== contentPath && 
						element.indexOf(".json") > -1 && 
						element.indexOf(".snapshot") === -1 && 
						element.indexOf(".published") === -1 && 
						element.indexOf("components/") === -1 &&
						fs.statSync(ComponentModel.baseDir + "/" + element).isFile()
					);
				});

				var dependentPages = [];

				for (var i = 0; i < foundPages.length; i++) {
					var pagePath = foundPages[i];
					var page = JSON.parse(fs.readFileSync(path.join(ComponentModel.baseDir, pagePath), "utf8"));
					if (page.isPublished === true) {

						//Find most recent published version
						var publishedVersions = historyModel.getPublished(path.join(ComponentModel.baseDir, pagePath));
						
						if (publishedVersions.length > 0) {
							var lastPublished = publishedVersions[0];
							
							//console.log("Reading: " + lastPublished.path);
							lastPublished = JSON.parse(fs.readFileSync(lastPublished.path, "utf8"));
						
							var pageContent = lastPublished.content;
							var pageComponents = lastPublished.components;
				
							var pageIsDependent = false;

							//If a page has an instance of this component it is considered dependent
							if (!pageIsDependent && pageComponents) {
								for (var name in pageComponents) {
									if (pageComponents[name].content !== "" && pageComponents[name].content !== undefined && pageComponents[name].content !== null &&pageComponents[name].content.length > 0) {
										//Read component
										var componentFullPath = path.join(ComponentModel.baseDir, pageComponents[name].content);
										if (fs.existsSync(componentFullPath)) {
											var componentJSON = fs.readFileSync(componentFullPath, "utf8");
											if (componentJSON) {
												var component = JSON.parse(componentJSON);
												if (component.id === data.id) {
													pageIsDependent = true;
													break;
												}
											}
										}
									}
								}
							}
				
							if (pageIsDependent) {

								dependentPages.push(pagePath)

							}
						}
					}
				}
						

				if (dependentPages.length > 0) {
					ComponentModel.contentModel.renderPages(dependentPages, function(err) {
						if (err) {
							console.log(err);
						}
					});

					if (callback !== undefined) {
						return callback(err);
					}

				} else {
					if (callback !== undefined) {
						return callback(null);
					}
				}
		
			} else {
				if (callback !== undefined) {
					return callback(null);
				}
			}
		
			
		});
	},
	existsDir: function(contentPath, callback) {

		var dirPath = path.join(ComponentModel.baseDir, contentPath);

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

		var fullPath = path.join(ComponentModel.baseDir, contentPath);

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
		
		var baseDirPath = path.join(ComponentModel.baseDir, baseDir);
		
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
	createComponent: function(componentName, componentType, baseDir, callback) {
		if (typeof componentName !== "string") {
			return callback(new Error("Name: " + componentName + " is not a string."));
		}
		
		componentName = componentName.replace(".json", "");
		
		//Remove unwanted characters from component name
		componentName = componentName.replace(/([^a-z0-9]+)/gi, '-');
		if (componentName.length > 200) {
			componentName = componentName.substr(0, 200);
		}
		
		componentName = componentName + ".json";
		
		if (typeof baseDir !== "string") {
			return callback(new Error("Base dir: " + baseDir + " is not a string."));
		}
		
		var baseDirPath = path.join(ComponentModel.baseDir, baseDir);
		
		if (!fs.existsSync(baseDirPath)) {
			return callback(new Error(baseDir + " does not exist."));
		}
		
		if (!fs.statSync(baseDirPath).isDirectory()) {
			return callback(new Error(baseDir + " is not a directory"));
		}
		
		var newComponentPath = path.join(baseDirPath, componentName);
		
		if (fs.existsSync(newComponentPath)) {
			return callback(new Error("A file already exists at: " + newComponentPath));
		}
		
		//Fetch the right template
		var componentTemplate = JSON.parse(fs.readFileSync(__dirname + "/../componenttypes/" + componentType + "/template.json", "utf8"));
		
		//var now = new Date();
		//componentTemplate.created = dateFormat(now, "yyyy-mm-dd HH:MM:ss");

		//Fix any required unique id:s
		var componentTemplate = JSON.stringify(componentTemplate, null, "\t");

		while (componentTemplate.indexOf("{GUID}") > -1) {
			componentTemplate = componentTemplate.replace("{GUID}", ComponentModel.getGUID());
		}
		
		fs.writeFile(newComponentPath, componentTemplate, "utf8", function(err) {
			if (err) {
				return callback(err);
			} else {
				callback(null);
			}
		});
	},
	publishComponent: function(componentPath, callback) {
		ComponentModel.getContent(componentPath, function(err, data) {
			if (err) {
				return callback(err);
			}
			
			data.isPublished = true;

			var now = new Date();
			if (data.published === "") {
				data.published = dateFormat(now, "yyyy-mm-dd HH:MM");
			}

			ComponentModel.setContent(componentPath, data, true, function(err) {
				if (err) {
					return callback(err);
				}
				historyModel.publishPage(componentPath, function(err) {
					if (err) {
						return callback(err);
					}

					ComponentModel.setContent(componentPath, data, true, callback);
				});
			});
		});
	},
	unpublishComponent: function(componentPath, callback) {
		ComponentModel.getContent(componentPath, function(err, data) {
			if (err) {
				return callback(err);
			}
			
			data.isPublished = false;
			ComponentModel.setContent(componentPath, data, false, callback);
		});
	},
	removeComponent: function(componentPath, callback) {
		if (typeof componentPath !== "string") {
			return callback(new Error("Component path: " + componentPath + " is not a string."));
		}
		
		var fullPath = path.join(ComponentModel.baseDir, componentPath);
		
		if (!fs.existsSync(fullPath)) {
			return callback(new Error(componentPath + " does not exist."));
		}
		
		if (!fs.statSync(fullPath).isFile()) {
			return callback(new Error(componentPath + " is not a file"));
		}
		
		fs.unlinkSync(fullPath);
		
		//Render dependent pages
		var allFiles = wrench.readdirSyncRecursive(ComponentModel.baseDir);
		var foundPages = allFiles.filter(function(element) {
			return (
				element.indexOf(".json") > -1 && 
				element.indexOf(".snapshot") === -1 && 
				element.indexOf(".published") === -1 && 
				element.indexOf("components/") === -1 &&
				fs.statSync(ComponentModel.baseDir + "/" + element).isFile()
			);
		});

		var dependentPages = [];

		for (var i = 0; i < foundPages.length; i++) {
			var pagePath = foundPages[i];
			var page = JSON.parse(fs.readFileSync(path.join(ComponentModel.baseDir, pagePath), "utf8"));
			var pageContent = page.content;
			var pageComponents = page.components;
		
			var pageIsDependent = false;

			//TODO: If a page has an instance of this component it is considered dependent
			if (!pageIsDependent && pageComponents) {
				for (var name in pageComponents) {
					if (pageComponents[name].content !== "" && pageComponents[name].content !== undefined && pageComponents[name].content !== null &&pageComponents[name].content.length > 0) {
						//Read component
						var componentFullPath = path.join(ComponentModel.baseDir, pageComponents[name].content);
						if (fs.existsSync(componentFullPath)) {
							var componentJSON = fs.readFileSync(componentFullPath, "utf8");
							if (componentJSON) {
								var component = JSON.parse(componentJSON);
								if (component.id === data.id) {
									pageIsDependent = true;
									break;
								}
							}
						}
					}
				}
			}
		
			if (pageIsDependent) {
				dependentPages.push(pagePath);
				//console.log(pagePath + " is dependent");
				//contentModel.renderPageDraft(pagePath, false);
				//contentModel.renderPagePublished(pagePath, false);
			}
		
		}
		
		if (dependentPages.length > 0) {

			if (ComponentModel.contentModel === undefined) {
				ComponentModel.contentModel = require("./contentmodel.js");
			}

			ComponentModel.contentModel.renderPages(dependentPages, function(err) {
				if (err) {
					console.log(err);
				}
			});

			if (callback !== undefined) {
				return callback(err);
			}

		} else {
			if (callback !== undefined) {
				return callback(null);
			}
		}
		
	},
	rmdir: function(dirName, callback) {
		if (typeof dirName !== "string") {
			return callback(new Error("Dir name: " + dirName + " is not a string."));
		}
		
		var baseDirPath = path.join(ComponentModel.baseDir, dirName);
		
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
		var outPath = path.join(ComponentModel.baseDir, "..", "output", "draft", dirName);
		
		if (fs.existsSync(outPath)) {
			wrench.rmdirSyncRecursive(outPath, true);
		}
		
		//Check if published version exists
		outPath = path.join(ComponentModel.baseDir, "..", "output", "published", dirName);

		if (fs.existsSync(outPath)) {
			wrench.rmdirSyncRecursive(outPath, true);
		}
		
		callback(null);

	},
	modifyMetadata: function(dirName, key, value, callback) {
		if (typeof dirName !== "string") {
			return callback(new Error("Dir name: " + dirName + " is not a string."));
		}
		
		var baseDirPath = path.join(ComponentModel.baseDir, dirName);
		
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
		
		var baseDirPath = path.join(ComponentModel.baseDir, dirName);
		
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
		
		var beforePath = path.join(ComponentModel.baseDir, before);
		
		if (!fs.existsSync(beforePath)) {
			return callback(new Error(beforePath + " does not exist."));
		}

		var afterPath = path.join(ComponentModel.baseDir, after);
		
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
	moveContentItemUp: function(contentItemName, componentId, callback) {
		//Check if component exists and is a file
		var fullPath = path.join(ComponentModel.baseDir, componentId);
		if (!fs.existsSync(fullPath)) {
			return callback(new Error("Path: " + componentId + " does not exist."));
		}
		
		if (!fs.statSync(fullPath).isFile()) {
			return callback(new Error("Path: " + componentId + " is not a file."));
		}

		if (componentId.indexOf(".json") < 0) {
			return callback(new Error("Path: " + componentId + " is not a json file."));
		}

		ComponentModel.getContent(componentId, function(err, data) {
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
					ComponentModel.setContent(componentId, data, false, function(err) {
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
	moveContentItemDown: function(contentItemName, componentId, callback) {
		//Check if component exists and is a file
		var fullPath = path.join(ComponentModel.baseDir, componentId);
		if (!fs.existsSync(fullPath)) {
			return callback(new Error("Path: " + componentId + " does not exist."));
		}
		
		if (!fs.statSync(fullPath).isFile()) {
			return callback(new Error("Path: " + componentId + " is not a file."));
		}

		if (componentId.indexOf(".json") < 0) {
			return callback(new Error("Path: " + componentId + " is not a json file."));
		}

		ComponentModel.getContent(componentId, function(err, data) {
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
					ComponentModel.setContent(componentId, data, false, function(err) {
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
	removeContentItemFromComponent: function(contentItemName, componentId, callback) {

		//Check if component exists and is a file
		var fullPath = path.join(ComponentModel.baseDir, componentId);
		if (!fs.existsSync(fullPath)) {
			return callback(new Error("Path: " + componentId + " does not exist."));
		}
		
		if (!fs.statSync(fullPath).isFile()) {
			return callback(new Error("Path: " + componentId + " is not a file."));
		}

		if (componentId.indexOf(".json") < 0) {
			return callback(new Error("Path: " + componentId + " is not a json file."));
		}

		ComponentModel.getContent(componentId, function(err, data) {
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
				ComponentModel.setContent(componentId, data, false, function(err) {
					if (err) {
						return callback(err);
					}
					return callback();
				});
			}
		});
	},
	addContentItemToComponent: function(contentTypeName, componentId, insertAfterId, callback) {

		contentModel = require("./contentmodel.js");

		//Check if component exists and is a file
		var fullPath = path.join(ComponentModel.baseDir, componentId);
		if (!fs.existsSync(fullPath)) {
			return callback(new Error("Path: " + componentId + " does not exist."));
		}
		
		if (!fs.statSync(fullPath).isFile()) {
			return callback(new Error("Path: " + componentId + " is not a file."));
		}

		if (componentId.indexOf(".json") < 0) {
			return callback(new Error("Path: " + componentId + " is not a json file."));
		}
		
		//Create a new unique id for this content
		var id = ComponentModel.getGUID();
		
		//Load template for type
		var contentTypes = contentModel.getContentTypes();
		var contentType = contentTypes[contentTypeName].getDefaultType();

		if (contentType === undefined) {
			return callback(new Error("Content type: " + contentTypeName + " does not exist."));
		}

		contentType.id = id;
		contentType.name = id;

		//Load component
		ComponentModel.getContent(componentId, function(err, data) {
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
			
			ComponentModel.setContent(componentId, data, false, function(err) {
				if (err) {
					return callback(err);
				}
				return callback();
			});
			
		});
		
	},
	getAllComponents: function() {
		var componentsPath = path.join(ComponentModel.baseDir, "components");
		
		var components = wrench.readdirSyncRecursive(componentsPath);
		
		components = components.filter(function(element) { 
			return (
				element.indexOf(".json") > -1 &&
				element.indexOf(".snapshot") === -1 && 
				element.indexOf(".published") === -1 && 
				fs.statSync(path.join(componentsPath, element)).isFile()
			);
		});


		components = components.map(function(componentPath) { return "/components/" + componentPath});
		
		return components;
		
	}
};

module.exports = ComponentModel;