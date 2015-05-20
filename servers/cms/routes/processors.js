var express = require("express");
var router = express.Router();
//var imageController = require("../controllers/imagecontroller");
var path = require("path");
var fs = require("fs");

var processorsWithAdminInterfaces = [];

/* GET home page. */
router.get('/processors', function(req, res) {

	var output = {id: req.path, title: "Processorer", processors: processorsWithAdminInterfaces};

	res.render("processors", output);

});


function appendProcessorsRoutes(router) {

	var postProcessorsAdminInterfacesPath = path.join(__dirname, "..", "postprocessors", "admininterfaces");
	var preProcessorsAdminInterfacesPath = path.join(__dirname, "..", "preprocessors", "admininterfaces");

	if (fs.existsSync(postProcessorsAdminInterfacesPath) && fs.statSync(postProcessorsAdminInterfacesPath).isDirectory()) {
		var files = fs.readdirSync(postProcessorsAdminInterfacesPath);
	
		for (var i = 0; i < files.length; i++) {
			var adminInterfacePath = path.join(postProcessorsAdminInterfacesPath, files[i]);
			if (fs.statSync(adminInterfacePath).isDirectory()) {
				var processorPath = path.join(adminInterfacePath, "processor.js");
				if (fs.statSync(processorPath).isFile()) {
					
					var processor = require(processorPath);
					var baseRoute = processor.addRoutes(router);
					
					processorsWithAdminInterfaces.push(baseRoute);

				}
			}
		}
	}

	if (fs.existsSync(preProcessorsAdminInterfacesPath) && fs.statSync(preProcessorsAdminInterfacesPath).isDirectory()) {
		var files = fs.readdirSync(preProcessorsAdminInterfacesPath);
	
		for (var i = 0; i < files.length; i++) {
			var adminInterfacePath = path.join(preProcessorsAdminInterfacesPath, files[i]);
			if (fs.statSync(adminInterfacePath).isDirectory()) {
				var processorPath = path.join(adminInterfacePath, "processor.js");
				if (fs.statSync(processorPath).isFile()) {
					
					var processor = require(processorPath);
					var baseRoute = processor.addRoutes(router);
					
					processorsWithAdminInterfaces.push(baseRoute);

				}
			}
		}
	}
}

/*
//Find correct view for each type of content
router.get('/processors/*', function(req, res) {

	var baseUrl = req.path;

	var output = {id: req.path, title: "Processorer"};

	res.render("processors", output);

	procController.getContent(baseUrl, function(err, data) {
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

*/

appendProcessorsRoutes(router);

module.exports = router;
