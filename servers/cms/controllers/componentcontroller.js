var fs = require("fs");
var path = require("path");
var componentModel = require("../models/componentmodel");
var wrench = require("wrench");
var historyModel = require("../models/historymodel");

var ComponentController = {
	baseDir: componentModel.baseDir,
	getComponentTypes: function() {
		return componentModel.getComponentTypes();
	},
	getContent: function(path, callback) {
		componentModel.getContent(path, callback);
	},
	setContent: function(path, data, publishNow, callback) {
		componentModel.setContent(path, data, publishNow, callback);
	},
	addContentItemToComponent: function(contentType, componentId, insertAfterId, callback) {
		componentModel.addContentItemToComponent(contentType, componentId, insertAfterId, callback);
	},
	removeContentItemFromComponent: function(contentItemName, componentId, callback) {
		componentModel.removeContentItemFromComponent(contentItemName, componentId, callback);
	},
	moveContentItemUp: function(contentItemName, componentId, callback) {
		componentModel.moveContentItemUp(contentItemName, componentId, callback);
	},
	moveContentItemDown: function(contentItemName, componentId, callback) {
		componentModel.moveContentItemDown(contentItemName, componentId, callback);
	},
	publishComponent: function(componentPath, callback) {
		componentModel.publishComponent(componentPath, callback);
	},
	unpublishComponent: function(componentPath, callback) {
		componentModel.unpublishComponent(componentPath, callback);
	},
	existsDir: function(path, callback) {
		componentModel.existsDir(path, callback);
	},
	existsComponent: function(path, callback) {
		componentModel.existsContent(path, callback);
	},
	mkdir: function(dirName, baseDir, callback) {
		componentModel.mkdir(dirName, baseDir, callback);
	},
	rmdir: function(dirName, callback) {
		componentModel.rmdir(dirName, callback);
	},
	createComponent: function(componentName, componentType, baseDir, callback) {
		componentModel.createComponent(componentName, componentType, baseDir, callback);
	},
	removeComponent: function(componentPath, callback) {
		componentModel.removeComponent(componentPath, callback);
	},
	rename: function(before, after, callback) {
		componentModel.rename(before, after, callback);
	},
	getAllComponents: function() {
		return componentModel.getAllComponents();
	},
	getEditors: function(components) {
		
		var componentEditors = [];
		
		if (components && components !== undefined) {
			for (var name in components) {
				var item = components[name];

				if (item.description === undefined) {
					item.description = name;
				}

				var allComponents = ComponentController.getAllComponents();

				//if (item.content !== undefined && item.content !== null && item.content !== "undefined" && item.content !== "") {
					//componentEditors.push(item.description + ' <input name="component:' + name + '" type="text" value="' + item.content + '">');
				//} else {

					var select = [];
					select.push("<div class=\"form-group\"><label for=\"" + name +  "\" class=\"col-sm-2 control-label\">" + item.description + "</label><div class=\"col-sm-10\">");
					select.push("<select id=\"component:" + name + "\" name=\"component:" + name + "\" class=\"form-control\">");
					select.push("<option></option>");

					for (var i = 0; i < allComponents.length; i++) {
						var componentPath = allComponents[i];
						
						if (item.content === componentPath) {
							select.push("<option selected>" + componentPath + "</option>");
						} else {
							select.push("<option>" + componentPath + "</option>");
						}
					}
					select.push("</select></div></div>");

					componentEditors.push(select.join(""));

					//componentEditors.push(item.description + ' <input name="component:' + name + '" type="text" value="">');
					//}
			}
		} 
		
		return componentEditors;
	},
	cachedComponents: [],
	getDraftOutput: function(componentPath) {

		console.log("ComponentController.getDraftOutput: " + componentPath);

		var baseDir = path.join(__dirname, "..", "content");

		//console.log(baseDir, componentPath);

		//Read draft component data
		var componentData = JSON.parse(fs.readFileSync(path.join(baseDir, componentPath), "utf8"));
		
		var templateName = componentData.templateName;
		
		//Get component object
		var component = null;
		var componentPath = path.join(__dirname, "..", "componenttypes", templateName, "component.js");
		
		if (ComponentController.cachedComponents[componentPath] !== undefined) {
			component = ComponentController.cachedComponents[componentPath];
		} else {
			console.log("Loading component: " + componentPath);
			component = require(componentPath);
			ComponentController.cachedComponents[componentPath] = component;
		}
		
		//Render the component
		var output = component.getOutput(componentData, "draft");
		
		return output;
	},
	getPublishedOutput: function(componentPath) {

		console.log("ComponentController.getPublishedOutput: " + componentPath);

		var baseDir = path.normalize(path.join(__dirname, "..", "content"));

		//Read published component data
		var componentFullPath = path.join(baseDir, componentPath);

		var publishedVersions = historyModel.getPublished(componentPath);
		
		if (publishedVersions.length > 0) {
			var mostRecentPublishedVersion = publishedVersions[0];
			var componentData = JSON.parse(fs.readFileSync(mostRecentPublishedVersion.path, "utf8"));

			var templateName = componentData.templateName;
		
			//Get component object
			var component = null;
			var componentPath = path.join(__dirname, "..", "componenttypes", templateName, "component.js");
		
			if (ComponentController.cachedComponents[componentPath] !== undefined) {
				component = ComponentController.cachedComponents[componentPath];
			} else {
				console.log("Loading component: " + componentPath);
				component = require(componentPath);
				ComponentController.cachedComponents[componentPath] = component;
			}
		
			//Render the component
			var output = component.getOutput(componentData, "published");
			
			return output;

		} else {
			return "";
		}
		
		
	}
	
};

module.exports = ComponentController;