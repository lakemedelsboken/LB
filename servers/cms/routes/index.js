var express = require('express');
var router = express.Router();
var contentController = require("../controllers/contentcontroller");
var componentController = require("../controllers/componentcontroller");
var historyModel = require("../models/historymodel");
var fs = require("fs");
var path = require("path");

function mergeRecursive(obj1, obj2) {

	for (var p in obj2) {
		try {
			// Property in destination object set; update its value.
			if ( obj2[p].constructor==Object ) {
				obj1[p] = MergeRecursive(obj1[p], obj2[p]);

			} else {
				obj1[p] = obj2[p];

			}

		} catch(e) {
			// Property in destination object not set; create it and set its value.
			obj1[p] = obj2[p];

		}
	}

	return obj1;
}

//Find correct view for each type of content
router.get('/*', function(req, res) {

	var baseUrl = req.path;

	contentController.getContent(baseUrl, function(err, data) {
		if (err) {
			res.status(err.status || 500);
			res.render('error', {
				message: err.message,
				error: err
			});
		} else {

			var output = {id: baseUrl, title: baseUrl, server: process.env.SERVER};

			if (data.type === "dir") {
				output.content = data.list;
				output.metadata = data.metadata;
				output.pageTypes = contentController.getPageTypes();
				output.drafts = data.drafts;

				output.username = req.user.username;

				res.render('index', output);
			} else if (data.type === "file") {
				output.page = data;

				//Get component editors
				output.componentEditors = [];

				var templateComponents = {};

				//Get components from template
				if (data.templateName !== undefined) {
					var template = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "pagetypes", data.templateName, "template.json"), "utf8"));
					if (template.components !== undefined) {
						templateComponents = template.components;
					}
				}

				var mergedComponents = templateComponents;

				//Merge with existing component settings
				if (output.page.components !== undefined) {
					mergedComponents = mergeRecursive(mergedComponents, output.page.components);
				}

				//Get component editors
				output.componentEditors = componentController.getEditors(mergedComponents);

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

					res.render('page', output);

				});
			} else if (data.type === "snapshot") {
				res.json(data);
			} else if (data.type === "published") {
				res.json(data);
			} else if (data.type === "unknown") {
				output = data;

				output.id = baseUrl;
				output.title = baseUrl;

				res.render('file', output);
			} else {
				res.render('error', {
					message: baseUrl + " is of unknown type",
					error: null
				});
			}
		}
	});


});

module.exports = router;
