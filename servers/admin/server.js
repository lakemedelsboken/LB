var cluster = require("cluster");
var path = require("path");
var fs = require("fs");
var wrench = require("wrench");
var async = require("async");
var crypto = require("crypto");
var request = require("request");
var zlib = require("zlib");
var exec = require('child_process').exec;
var cheerio = require("cheerio");
var filesize = require("filesize");

//Setup master index
var masterIndex = JSON.parse(fs.readFileSync(__dirname + "/../site/masterIndex.json", "utf8"));

var atcTree = JSON.parse(fs.readFileSync(__dirname + "/../../npl/atcTree.json", "utf8"));
var searchIndexer = require("../../search/createSearchIndex.js");

var settings = JSON.parse(fs.readFileSync(__dirname + "/../../settings/settings.json", "utf8"));

var networkPort = settings.internalServerPorts.admin;
var externalNetworkPort = settings.externalServerPorts.main;

var numCPUs = require('os').cpus().length;

var app = require('./app').init(networkPort);

var locals = {
	title: 		 'Läkemedelsboken',
	description: '',
	author: 	 'staliv'
};

app.get('/admin/', function(req, res){

	//    locals.date = new Date().toLocaleDateString();

	res.render('main.ejs', locals);

});

app.get('/admin/frontpage', function(req,res) {

	var images = getUploadedImages();
	locals.images = images;
	//locals.previews = getChapters();
	//locals.parserMessages = fs.readFileSync(__dirname + "/mif/parserMessages.txt", "utf8");
	res.render('frontpage.ejs', locals);

});

function getUploadedImages() {
	var images = {};
	var imagesDirPath = __dirname + "/../site/static/img/static/";
	
	var files = fs.readdirSync(imagesDirPath);
	
	for (var i = 0; i < files.length; i++) {
		if (files[i].indexOf("_images") > -1) {
			var imageDirPath = imagesDirPath + files[i] + "/";
			var subImages = [];
			var subFiles = fs.readdirSync(imageDirPath);

			var imagePrefix = files[i].replace("_images", "");
			var result = [];
			
			result.push("<div class=\"staticImage\" data-picture data-alt=\"Bild\">");
			result.push("	<div data-src=\"/img/static/" + files[i] + "/opt/" + imagePrefix + "_small.png\"></div>");
			result.push("	<div data-src=\"/img/static/" + files[i] + "/opt/" + imagePrefix + "_small_x2.png\" data-media=\"(min-device-pixel-ratio: 2.0)\"></div>");
			result.push("	<div data-src=\"/img/static/" + files[i] + "/opt/" + imagePrefix + "_medium.png\" data-media=\"(min-width: 481px)\"></div>");
			result.push("	<div data-src=\"/img/static/" + files[i] + "/opt/" + imagePrefix + "_medium_x2.png\" data-media=\"(min-width: 481px) and (min-device-pixel-ratio: 2.0)\"></div>");
			result.push("	<div data-src=\"/img/static/" + files[i] + "/opt/" + imagePrefix + "_large.png\" data-media=\"(min-width: 980px)\"></div>");
			result.push("	<div data-src=\"/img/static/" + files[i] + "/opt/" + imagePrefix + "_large_x2.png\" data-media=\"(min-width: 980px) and (min-device-pixel-ratio: 2.0)\"></div>");
			result.push("	<div data-src=\"/img/static/" + files[i] + "/opt/" + imagePrefix + "_huge.png\" data-media=\"(min-width: 1200px)\"></div>");
			result.push("	<div data-src=\"/img/static/" + files[i] + "/opt/" + imagePrefix + "_huge_x2.png\" data-media=\"(min-width: 1200px) and (min-device-pixel-ratio: 2.0)\"></div>");
			result.push("	<!--[if (lt IE 9) & (!IEMobile)]>");
			result.push("	<div data-src=\"/img/static/" + files[i] + "/opt/" + imagePrefix + "_large.png\"></div>");
			result.push("	<![endif]-->");
			result.push("	<noscript>");
			result.push("	<img src=\"/img/static/" + files[i] + "/opt/" + imagePrefix + "_large.png\" alt=\"Bild\">");
			result.push("	</noscript>");
			result.push("</div>");

			for (var j = 0; j < subFiles.length; j++) {
				if (subFiles[j].indexOf(".png") > -1 && subFiles[j].indexOf("_") > -1) {
					subImages.push("/img/static/" + files[i] + "/opt/" + subFiles[j]);
				}
			}
			
			images[files[i].replace("_images", ".png")] = {images: subImages, html: result.join("\n")};
		}
	}
	
	return images;
}

app.post('/admin/uploadimage', function(req,res){

	req.connection.setTimeout(1000 * 60 * 30); //30 minutes

	//Move image files to correct path
	for (var image in req.files) {
		if (image.name !== "" && image.indexOf("image") === 0 && req.files[image].name.toLowerCase().indexOf(".png") > 0) {
			var safeImageName = req.files[image].name.toLowerCase().replace(".png", "").replace(/[^a-z0-9]/gi, '_');
			var imagesDir = __dirname + "/../site/static/img/static/" + safeImageName + "_images/";
			wrench.mkdirSyncRecursive(imagesDir);
			var newImagePath = imagesDir + safeImageName + ".png";
			fs.renameSync(req.files[image].path, newImagePath);

			createImageSizes(newImagePath, function(err, results) {
				if (err) {
					console.log(err);
				} else {
					console.log(results)
				}
				res.redirect('/admin/frontpage');
			});
		} else {
			res.redirect('/admin/frontpage');
		}
	}

});

var im = require("imagemagick");

function resizeImage(imagePath, maxWidth, extension, forceResize, callback) {
	//var maxImageWidth = maxWidth;
	var newDestination = imagePath.replace(".png", extension + ".png");

	if (fs.existsSync(newDestination) && !forceResize) {
		callback(null, "Skipped resize of " + newDestination);
	} else {
		im.identify(imagePath, function(err, features) {
			if (err) { return callback(err); }
			//var maxImageWidth = parseInt((features.width / 2), 10);
			if (maxWidth > features.width) {
				maxWidth = features.width;
			}
			var newWidth = maxWidth;
			var newHeight = parseInt(features.height * (newWidth/features.width), 10);

			//Make sure image is not bigger than 1024*1024*3 for compatibility with iPod Touch 4 and iPhone 3GS
			var maxPixels = 1024*1024*3;

			if (extension.indexOf("_x2") > -1) {
				//Make sure image is not bigger than 1024*1024*5 for compatibility with retina devices
				var maxPixels = 1024*1024*5;
			}

			while((newWidth * newHeight) > maxPixels) {
				var ratio = newWidth / newHeight;
				var oldWidth = newWidth;
				newWidth = newWidth - 5;
				newHeight = parseInt(newHeight * (newWidth/oldWidth), 10);
			}

			im.convert([imagePath, '-resize', newWidth + 'x' + newHeight, 'PNG:' + newDestination], function(err, stdout) { //, "-colors", "256"
			if (err) { return callback(err); }

			var optImageDir = newDestination.split("/");
			var newFileName = optImageDir.pop();
			optImageDir = optImageDir.join("/") + "/opt/";

			wrench.mkdirSyncRecursive(optImageDir);
				
			exec("pngnq -e .png -f -s 1 -d " + optImageDir + " " + newDestination, function (error, stdout, stderr) {
				//console.error('stdout: ' + stdout);
				//console.error('stderr: ' + stderr);
				if (error !== null) {
					//console.error('exec error: ' + error);
				}
					
				exec("pngout -s1 -y " + optImageDir + "/" + newFileName, function (error, stdout, stderr) {
					callback(null, "Resized: " + imagePath + " to " + newWidth + "x" + newHeight + " at " + newDestination);
				});
			});

		});
	});
		
}

}

function createImageSizes(newImagePath, callback) {

	var forcedImageResizing = true;

	async.parallel([
		function(callback) {
			resizeImage(newImagePath, 300, "_small", forcedImageResizing, function(err, result) {
				callback(err, result);
			});
		},
		function(callback) {
			resizeImage(newImagePath, 600, "_small_x2", forcedImageResizing, function(err, result) {
				callback(err, result);
			});
		},
		function(callback) {
			resizeImage(newImagePath, 524, "_medium", forcedImageResizing, function(err, result) {
				callback(err, result);
			});
		},
		function(callback) {
			resizeImage(newImagePath, 1048, "_medium_x2", forcedImageResizing, function(err, result) {
				callback(err, result);
			});
		},
		function(callback) {
			resizeImage(newImagePath, 740, "_large", forcedImageResizing, function(err, result) {
				callback(err, result);
			});
		},
		function(callback) {
			resizeImage(newImagePath, 1480, "_large_x2", forcedImageResizing, function(err, result) {
				callback(err, result);
			});
		},
		function(callback) {
			resizeImage(newImagePath, 970, "_huge", forcedImageResizing, function(err, result) {
				callback(err, result);
			});
		},
		function(callback) {
			resizeImage(newImagePath, 1940, "_huge_x2", forcedImageResizing, function(err, result) {
				callback(err, result);
			});
		}
	], function(err, results) {
		callback(err, results)
	});
	
}

app.get('/admin/frontpage/generate', function(req,res){

	buildAuthorsRegistry();
	buildPDFRegistry();
	buildEditorsRegistry();
	buildForeword();
	buildPress();

	req.connection.setTimeout(1000 * 60 * 30); //30 minutes

	var frontPageContent = [];

	//Get header and footer
	var header = fs.readFileSync(__dirname + "/../../parser/templates/browser/header.html", "utf8");
	var footer = fs.readFileSync(__dirname + "/../../parser/templates/browser/footer.html", "utf8");
	var hero = fs.readFileSync(__dirname + "/templates/frontpage.html", "utf8");

	//Generate side menu
	var index = genereateMasterSideMenu(masterIndex);
	
	//header = header.replace()

	//Get blog contents
	request({uri: 'http://127.0.0.1:' + externalNetworkPort + '/blog/index.json', json: true}, function (error, response, body) {

		var blogArticles = [];
		if (!error && response.statusCode === 200) {
			blogArticles = body;
		} else {
			console.log("Error fetching blog content.")
		}

		frontPageContent.push(header);
		frontPageContent.push(hero);

		//BLOG
		for (var i = 0; i < blogArticles.length; i++) {
			var article = blogArticles[i];
			frontPageContent.push('<h3><a href="/blog/' + article.url + '">' + article.title + '</a></h3>');
			frontPageContent.push('<p>' + article.summary + '</p>');
			frontPageContent.push('<p><a href="/blog/' + article.url + '">Läs vidare &raquo;</a></p>');
		}
				
		frontPageContent.push(footer);

		var frontPagePath = __dirname + "/../site/chapters/index.html";
		frontPageContent = frontPageContent.join("\n");
		
		var $ = cheerio.load(frontPageContent);
		//Remove pdf viewer
		$("#pdf").attr("style", "display: none;");
		//Add sidebar
		$("#sideBar").html(index);

		frontPageContent = $.html();

		//Change title
		frontPageContent = frontPageContent.replace("{TITLE}", "Läkemedelsboken")
		frontPageContent = frontPageContent.replace(/\{VERSION\}/g, settings.version)
		
		//console.log(frontPageContent);
		
		fs.writeFileSync(frontPagePath, frontPageContent, "utf8");

		res.redirect('/admin/frontpage');
	});	

});

function buildAuthorsRegistry() {

	var indexedAuthors = require("./db/authors_registry").getIndexedAuthors();

	var pageContent = [];

	//Get header and footer
	var header = fs.readFileSync(__dirname + "/../../parser/templates/browser/header.html", "utf8");
	var footer = fs.readFileSync(__dirname + "/../../parser/templates/browser/footer.html", "utf8");

	//Generate side menu
	var index = genereateMasterSideMenu(masterIndex);
	
	pageContent.push(header);

	pageContent.push("<h2>Författarregister</h2>");

	//Add authors registry
	pageContent.push("<ul class=\"nav nav-pills\" id=\"authorsRegistryLetterIndex\">");
	for (var letter in indexedAuthors) {
		pageContent.push("<li><a title=\"Gå till författare vars efternamn börjar med " + letter + "\" href=\"#" + letter + "\">" + letter + "</a></li>");
	}
	pageContent.push("</ul>");

	for (var letter in indexedAuthors) {
		var authorsByLetter = indexedAuthors[letter];
	
		pageContent.push("<h4 id=\"" + letter + "\">" + letter + "</h4>");
		pageContent.push("<ul class=\"authorsByLetter\">");
	
		for (var i = 0; i < authorsByLetter.length; i++) {
			var author = authorsByLetter[i];
			pageContent.push("<li><article>");
			
			var name = author.name.split(" ");
			if (name.length === 2) {
				pageContent.push("<strong>" + name[1] + " " + name[0] + "</strong> <small>" + author.title + "</small><br>");
			} else if (author.firstname !== undefined && author.lastname !== undefined) {
				pageContent.push("<strong>" + author.firstname + " " + author.lastname + "</strong> <small>" + author.title + "</small><br>");
			} else {
				pageContent.push("<strong>" + author.name + "</strong> <small>" + author.title + "</small><br>");
				console.log(author.name + " could not be niced up.");
			}
			//pageContent.push(author.title + "<br>");
			
			if (author.department && author.department !== "") {
				pageContent.push("<em>" + author.department + "</em><br>");
			}
			//pageContent.push("<address>");
			if (author.hospital && author.hospital !== "") {
				pageContent.push(author.hospital + ", ");
			}
			pageContent.push(author.city);
			//pageContent.push("</address>");

			//pageContent.push("<h5>Kapitel</h5>");
			pageContent.push("<ul>");
			for (var k = 0; k < author.chapters.length; k++) {
				pageContent.push("<li>");
				pageContent.push("<a href=\"" + author.chapters[k].htmlFile + "\">" + author.chapters[k].chaptertitle + " <i class=\"icon-double-angle-right\"></i></a>");
				pageContent.push("</li>");
			
			}
			pageContent.push("</ul>");
		
			pageContent.push("</article></li>");
		
		}
		pageContent.push("</ul>");
	}
	
	pageContent.push(footer);

	var pagePath = __dirname + "/../site/chapters/authors.html";
	pageContent = pageContent.join("\n");
	
	var $ = cheerio.load(pageContent);
	//Remove pdf viewer
	$("#pdf").attr("style", "display: none;");
	//Add sidebar
	$("#sideBar").html(index);

	pageContent = $.html();

	//Change title
	pageContent = pageContent.replace("{TITLE}", "Författarregister | Läkemedelsboken")
	pageContent = pageContent.replace(/\{VERSION\}/g, settings.version)
	
	fs.writeFileSync(pagePath, pageContent, "utf8");

}

function buildPDFRegistry() {

	var pageContent = [];

	//Get header and footer
	var header = fs.readFileSync(__dirname + "/../../parser/templates/browser/header.html", "utf8");
	var footer = fs.readFileSync(__dirname + "/../../parser/templates/browser/footer.html", "utf8");

	//Generate side menu
	var index = genereateMasterSideMenu(masterIndex);
	
	pageContent.push(header);

	pageContent.push("<h2>PDF-versioner av alla kapitel i Läkemedelsboken</h2>");

	//PDF:s
	var pdfs = getPDFs();
	
	for (var division in pdfs) {
		pageContent.push('<h4>' + division + '</h4>');
		pageContent.push('<ul>');
		for (var name in pdfs[division]) {
			pageContent.push('<li><a href="' + pdfs[division][name].url + '" class="pdfLink">' + name + '</a> <small>(' + pdfs[division][name].size + ')</small></li>');
		}
		pageContent.push('</ul>');
	}
	
	pageContent.push(footer);

	var pagePath = __dirname + "/../site/chapters/pdfs.html";
	pageContent = pageContent.join("\n");
	
	var $ = cheerio.load(pageContent);
	//Remove pdf viewer
	$("#pdf").attr("style", "display: none;");
	//Add sidebar
	$("#sideBar").html(index);

	pageContent = $.html();

	//Change title
	pageContent = pageContent.replace("{TITLE}", "PDF-versioner av alla kapitel | Läkemedelsboken")
	pageContent = pageContent.replace(/\{VERSION\}/g, settings.version)
	
	fs.writeFileSync(pagePath, pageContent, "utf8");

}

function getPDFs() {
	var result = {};
	
	for (var key in masterIndex) {
		var item = masterIndex[key];
		var name = item.name;
		var division = item.division;
		
		if (result[division] === undefined) {
			result[division] = {};
		}
		
		var pdf = getPDF(key);
		if (pdf.url !== null && pdf.size !== null) {
			result[division][name] = pdf;
		} else {
			console.error("Could not find pdf for id: " + key);
		}
	}
	
	return result;
}

function getPDF(id) {

	var chaptersPath = __dirname + "/../site/chapters/";

	var files = fs.readdirSync(chaptersPath);

	id = id.toLowerCase();

	var result = {url: null, size: null};

	for (var i = 0; i < files.length; i++) {
		var fileName = files[i];

		if (fileName.indexOf("_") > -1) {
			var chapterId = fileName.split("_")[0];
			if (chapterId === id && fileName.indexOf("_pdf") > -1) {
				result.url = "/" + fileName + "/" + fileName.replace("_pdf", "") + ".pdf";
				var filePath = chaptersPath + fileName + "/" + fileName.replace("_pdf", "") + ".pdf";
				if (fs.existsSync(filePath)) {
					var stat = fs.statSync(filePath);
					var size = stat.size;
					size = filesize(size, {round: 1});
					result.size = size;
				}
			} 
		}

	}

	return result;
}

function buildEditorsRegistry() {

	var pageContent = [];

	//Get header and footer
	var header = fs.readFileSync(__dirname + "/../../parser/templates/browser/header.html", "utf8");
	var footer = fs.readFileSync(__dirname + "/../../parser/templates/browser/footer.html", "utf8");
	var content = fs.readFileSync(__dirname + "/templates/editors.html", "utf8");

	//Generate side menu
	var index = genereateMasterSideMenu(masterIndex);
	
	pageContent.push(header);

	pageContent.push(content);
	
	pageContent.push(footer);

	var pagePath = __dirname + "/../site/chapters/editors.html";
	pageContent = pageContent.join("\n");
	
	var $ = cheerio.load(pageContent);
	//Remove pdf viewer
	$("#pdf").attr("style", "display: none;");
	//Add sidebar
	$("#sideBar").html(index);

	pageContent = $.html();

	//Change title
	pageContent = pageContent.replace("{TITLE}", "Redaktionskommittén | Läkemedelsboken")
	pageContent = pageContent.replace(/\{VERSION\}/g, settings.version)
	
	fs.writeFileSync(pagePath, pageContent, "utf8");

}

function buildForeword() {

	var pageContent = [];

	//Get header and footer
	var header = fs.readFileSync(__dirname + "/../../parser/templates/browser/header.html", "utf8");
	var footer = fs.readFileSync(__dirname + "/../../parser/templates/browser/footer.html", "utf8");
	var content = fs.readFileSync(__dirname + "/templates/foreword.html", "utf8");

	//Generate side menu
	var index = genereateMasterSideMenu(masterIndex);
	
	pageContent.push(header);

	pageContent.push(content);
	
	pageContent.push(footer);

	var pagePath = __dirname + "/../site/chapters/foreword.html";
	pageContent = pageContent.join("\n");
	
	var $ = cheerio.load(pageContent);
	//Remove pdf viewer
	$("#pdf").attr("style", "display: none;");
	//Add sidebar
	$("#sideBar").html(index);

	pageContent = $.html();

	//Change title
	pageContent = pageContent.replace("{TITLE}", "Förord | Läkemedelsboken")
	pageContent = pageContent.replace(/\{VERSION\}/g, settings.version)
	
	fs.writeFileSync(pagePath, pageContent, "utf8");

}

function buildPress() {

	var pageContent = [];

	//Get header and footer
	var header = fs.readFileSync(__dirname + "/../../parser/templates/browser/header.html", "utf8");
	var footer = fs.readFileSync(__dirname + "/../../parser/templates/browser/footer.html", "utf8");
	var content = fs.readFileSync(__dirname + "/templates/press.html", "utf8");

	//Generate side menu
	var index = genereateMasterSideMenu(masterIndex);
	
	pageContent.push(header);

	pageContent.push(content);
	
	pageContent.push(footer);

	var pagePath = __dirname + "/../site/chapters/press.html";
	pageContent = pageContent.join("\n");
	
	var $ = cheerio.load(pageContent);
	//Remove pdf viewer
	$("#pdf").attr("style", "display: none;");
	//Add sidebar
	$("#sideBar").html(index);

	pageContent = $.html();

	//Change title
	pageContent = pageContent.replace("{TITLE}", "Pressmaterial | Läkemedelsboken")
	pageContent = pageContent.replace(/\{VERSION\}/g, settings.version)
	
	fs.writeFileSync(pagePath, pageContent, "utf8");

}

function genereateMasterSideMenu(index) {
	
	var chapters = getChapters();
	var divisions = {};
	var result = [];
	
	for (var id in index) {
		
		var path = "#";
		
		for (var i = 0; i < chapters.length; i++) {
			if (chapters[i].name.indexOf(id.toLowerCase()) === 0) {
				path = chapters[i].name;
				break;
			}
		}
		
		var item = index[id];
		
		if (divisions[item.division] === undefined) {
			divisions[item.division] = {children: [{name: item.name, path: path}]};
		} else {
			divisions[item.division].children.push({name: item.name, path: path})
		}
	}


	for (var division in divisions) {
		var item = divisions[division]
		if (item.children.length === 1) {
			result.push("<li><a href=\"" + item.children[0].path + "\"><i class=\"icon icon-bookmark-empty\"></i> " + item.children[0].name + "</a></li>");
		} else if (item.children.length > 1) {
			result.push("<li><i class=\"icon icon-bookmark\"></i> " + division + "<ul>");
			for (var i = 0; i < item.children.length; i++) {
				result.push("<li><a href=\"" + item.children[i].path + "\"><i class=\"icon icon-bookmark-empty\"></i> " + item.children[i].name + "</a></li>");
			}
			result.push("</ul></li>");
		}
	}
	
	return result.join("\n");
}

app.get('/admin/preview', function(req,res){

	locals.date = new Date().toLocaleDateString();
	locals.previews = getChapters();
	locals.parserMessages = fs.readFileSync(__dirname + "/mif/parserMessages.txt", "utf8");
	res.render('preview.ejs', locals);

});

app.get('/admin/preview/updateall', function(req,res){

	req.connection.setTimeout(1000 * 60 * 30); //30 minutes

	//Clear old parser messages
	var latestParserMessagesFile = __dirname + "/mif/parserMessages.txt";
	fs.writeFileSync(latestParserMessagesFile, "", "utf8");

	//get all mifml files
	var files = fs.readdirSync(__dirname + "/mif/");

	var nrOfParallelProcessing = numCPUs;
	if (nrOfParallelProcessing < 1) {
		nrOfParallelProcessing = 1;
	}

	var startParserTime = new Date().getTime();

	var q = async.queue(function (task, callback) {
		parseToHtmlAndSave(task.name, true, function(err) {
			callback();
		});
	}, nrOfParallelProcessing);

	q.drain = function() {
		//		console.log('All items have been processed');
		var endParserTime = new Date().getTime();
		var totalTime = ((endParserTime - startParserTime) / 1000) + " seconds";

		fs.appendFileSync(latestParserMessagesFile, "\nParsing finished in " + totalTime, "utf8");
		
		res.redirect('/admin/preview');
	}	

	for (var i=0; i < files.length; i++) {
		if (files[i].indexOf(".mifml") > 0) {
			
			console.log("Adding " + __dirname + "/mif/" + files[i] + " to parser queue.");
			
			q.push({name: __dirname + "/mif/" + files[i]}, function (err) {
			});
		}
	}
});

app.post('/admin/uploadmif', function(req,res){

	req.connection.setTimeout(1000 * 60 * 30); //30 minutes

	locals.date = new Date().toLocaleDateString();

	if (req.files["mif"] !== undefined) {

		//Move and rename
		var mif = req.files["mif"];
		var fileEnding = mif.name.toLowerCase().split(".");
		if (fileEnding.length > 1) {
			fileEnding = fileEnding[fileEnding.length - 1];
		} else {
			fileEnding = "";
		}
	
		if (fileEnding !== "mif") {
			res.redirect('/admin/preview');
		} else {
			//Move image files to correct path
			for (var image in req.files) {
				if (image.indexOf("figur") === 0 && req.files[image].name.toLowerCase().indexOf(".png") > 0) {
					var imagesDir = __dirname + "/../site/chapters/" + mif.name.toLowerCase().replace(".mif", "_images/").replace(/\+/g, "-");
					wrench.mkdirSyncRecursive(imagesDir);
					var newImagePath = imagesDir + image + ".png";
					fs.renameSync(req.files[image].path, newImagePath);
					
				}
			}

			//Save pdf
			for (var pdf in req.files) {
				if (req.files[pdf].name.toLowerCase().indexOf(".pdf") > 0) {
					var pdfDir = __dirname + "/../site/chapters/" + mif.name.toLowerCase().replace(".mif", "_pdf/").replace(/\+/g, "-");
					wrench.mkdirSyncRecursive(pdfDir);
					var newPdfPath = pdfDir + mif.name.toLowerCase().replace(".mif", ".pdf").replace(/\+/g, "-");
					fs.renameSync(req.files[pdf].path, newPdfPath);
				}
			}

			var newPath = __dirname + "/mif/" + mif.name.toLowerCase();
			var convertedPath = newPath + ".mifml";
		
			fs.renameSync(mif.path, newPath);

			//Convert to mifml
			var spawn = require('child_process').spawn,
			wine = spawn('wine', ["mifml.exe", mif.name.toLowerCase()], {cwd: __dirname + "/mif/"});

			wine.stdout.on('data', function (data) {

				//console.log('stdout: ' + data);

				if (data.toString().indexOf("Press any key to continue") > -1 || data.toString().indexOf("Press Return key to continue") > -1) {

					process.kill(wine.pid)

					//convert to html
					parseToHtmlAndSave(__dirname + "/mif/" + mif.name.toLowerCase() + ".mifml", false, function(err) {

						res.redirect('/admin/preview');
					});
				}
			});

			wine.stderr.on('data', function (data) {
				console.log('stderr: ' + data);
			});

			wine.on('exit', function (code) {
				//console.log('child process exited with code ' + code);
			});

		}
	}

});

app.get('/admin/controls', function(req,res){

	locals.results = getControlResults();
	res.render('controls.ejs', locals);

});


function getControlResults() {
	var result = [];

	var controls = {};
    
	if (fs.existsSync(__dirname + "/controls.json")) {
		controls = JSON.parse(fs.readFileSync(__dirname + "/controls.json", "utf8"));
	}

	var chapters = getChapters();

	//Check that every chapter has a control object
	for (var i = 0; i < chapters.length; i++) {
		var chapter = chapters[i];
		var chapterName = chapter.name;
		var chapterId = chapter.name.split("_");

		if (chapterId.length < 2) {
			console.error(new Error("Could not extract chapter id from " + chapterName + " in getControlResults()"));
			return [];
		}

		chapterId = chapterId[0] + "_" + chapterId[1];
		if (controls[chapterId] === undefined) {
			controls[chapterId] = {facts: 0, therapyRecommendations: 0, infoTables: 0, figures: 0};
		}

	}

	//Save controls
	fs.writeFileSync(__dirname + "/controls.json", JSON.stringify(controls, null, "\t"), "utf8");

	//Perform controls
	for (var chapterId in controls) {
		var control = controls[chapterId];
        
		//Find correct chapter
		var chapterContent = "";
        
		var chapter = null;
		for (var i = 0; i < chapters.length; i++) {
			if (chapters[i].name.indexOf(chapterId) === 0) {
				
				chapterContent = fs.readFileSync(chapters[i].path, "utf8");

				var $ = cheerio.load(chapterContent);

				var chapterResults = {"chapter": chapters[i].name};
				
				//Facts
				var expectedFacts = controls[chapterId].facts;
				var foundFacts = $("table.facts").length;
				
				if (foundFacts === expectedFacts) {
					chapterResults.facts = {result: true, description: "Fann " + foundFacts + " av " + expectedFacts + " faktarutor."};
				} else {
					chapterResults.facts = {result: false, description: "Förväntade " + expectedFacts + " faktarutor, fann " + foundFacts + " stycken."};
				}

				//Figures
				var expectedFigures = controls[chapterId].figures;
				var foundFigures = $("div.figure").length;
				
				if (foundFigures === expectedFigures) {
					chapterResults.figures = {result: true, description: "Fann " + foundFigures + " av " + expectedFigures + " figurer."};
				} else {
					chapterResults.figures = {result: false, description: "Förväntade " + expectedFigures + " figurer, fann " + foundFigures + " stycken."};
				}

				//TODO: Check if figure paths exist

				//Tables
				var expectedTables = controls[chapterId].infoTables;
				var foundTables = $("h4.infoTable").length;
				
				if (foundTables === expectedTables) {
					chapterResults.tables = {result: true, description: "Fann " + foundTables + " av " + expectedTables + " tabeller."};
				} else {
					chapterResults.tables = {result: false, description: "Förväntade " + expectedTables + " tabeller, fann " + foundTables + " stycken."};
				}

				//Therapy Recommendations
				var expectedTherapies = controls[chapterId].therapyRecommendations;
				var foundTherapies = $("h4.therapyRecommendations").length;
				
				if (foundTherapies === expectedTherapies) {
					chapterResults.therapyRecommendations = {result: true, description: "Fann " + foundTherapies + " av " + expectedTherapies + " terapirekommendationer."};
				} else {
					chapterResults.therapyRecommendations = {result: false, description: "Förväntade " + expectedTherapies + " terapirekommendationer, fann " + foundTherapies + " stycken."};
				}

				//Outgoing links
				/*
				var links = $("a");
				var outLinks = [];
				links.each(function(i, e) {
					var link = $(e);
					if (link.attr("href") !== undefined && (link.attr("href").indexOf("http") > -1)) {
						outLinks.push({text: link.text().trim(), href: link.attr("href")});
					}
				});

				chapterResults.links = outLinks;
				*/
				chapterResults.links = [];
				//Send to results
				result.push(chapterResults);
				
			}
		}
	}

	//Sort result
	result.sort(function(a, b){
		if(a.chapter < b.chapter) return -1;
		if(a.chapter > b.chapter) return 1;
		return 0;
	})

	return result;
}

function getTables() {
	var result = [];

	var chapters = getChapters();

	//Check that every chapter has a control object
	for (var i = 0; i < chapters.length; i++) {
		var chapter = chapters[i];
		var chapterName = chapter.name;
		var chapterId = chapter.name.split("_");

		chapterContent = fs.readFileSync(chapters[i].path, "utf8");

		var $ = cheerio.load(chapterContent);
		
		var chapterResults = {chapter: chapterName, tables: []};

		//Tables
		var foundTables = $("div.facts, div.wide, div.narrow, div.therapy-recommendations");
		
		foundTables.each(function(i, e) {
			var tableContent = cheerio.html(cheerio(e));
			chapterResults.tables.push(tableContent);
		});
		
		//Send to results
		result.push(chapterResults);
		
	}

	//Sort result
	result.sort(function(a, b){
		if(a.chapter < b.chapter) return -1;
		if(a.chapter > b.chapter) return 1;
		return 0;
	})

	return result;
}

app.get('/admin/keywords', function(req,res){

	locals.keywords = getKeywords();
	res.render('keywords.ejs', locals);

});

app.get('/admin/keywords/existing', function(req,res){

	var connections = getExistingKeywordConnections();

	var sorted = [];
	for (var connection in connections) {
		sorted.push(connection);
	}
	
	sorted.sort();
	
	//console.log(sorted);
	
	var out = [];
	
	for (var i = 0; i < sorted.length; i++) {
		var word = sorted[i];
		out.push("<strong>" + word + "</strong>");
		console.log(word);
		var titles = connections[word].title;

		for (var j = 0; j < titles.length; j++) {
			out.push("&nbsp;&nbsp;&nbsp;&nbsp;<small>" + titles[j] + "</small>");
		}
	}

	locals.existingKeywords = out.join("<br>");
	res.render('existingkeywords.ejs', locals);

});

app.get('/admin/sitemap', function(req,res){

	locals.date = new Date().toLocaleDateString();

	locals.sitemap = getSiteMap();
	res.render('sitemap.ejs', locals);


});

app.get('/admin/tables', function(req,res){

	locals.date = new Date().toLocaleDateString();

	locals.tables = getTables();
	
	res.render('tables.ejs', locals);

});

app.get('/admin/publish', function(req,res){

	locals.date = new Date().toLocaleDateString();

	res.render('publish.ejs', locals);

});

app.get('/admin/tree', function(req,res){

	var root = req.query["root"];

	if (root === "source") {
		root = "root";
	}

	var tree = getTreeChildren(root);

	res.json(tree);
});

function getTreeChildren(parentId, showATCCodes) {

	console.log("Fetching: " + parentId);

	var childATCCodes = [];
	var childProducts = [];
	var parent = null;

	var result = [];

	if (showATCCodes === undefined) {
		showATCCodes = true;
	}

	for (var j = 0; j < atcTree.length; j++) {

		if (atcTree[j].parentId === parentId) {
			var child = atcTree[j];
			if (child.type === "atc" && child.hasChildren) {
				childATCCodes.push(child);
			} else {
				childProducts.push(child);
			}
		}
	
		if (atcTree[j].id === parentId) {
			parent = atcTree[j];
		}
	}

	for (var i = 0; i < childATCCodes.length; i++) {
		result.push({text: ((showATCCodes) ? childATCCodes[i].id + " " : "") + childATCCodes[i].title, id: childATCCodes[i].id, hasChildren: true});
	}

	for (var i = 0; i < childProducts.length; i++) {
		var product = getProduct(childProducts[i].title);
		//result.push({text: childProducts[i].title, id: childProducts[i].id});
		var title = childProducts[i].title;
		title = title.split(",");
		title[0] = "<strong>" + title[0] + "</strong>";
		title = title.join(",");
		title = "<a href=\"#\" data-product-id=\"" + childProducts[i].id + "\" class=\"inlineProduct\">" + title + "</a>";
		product.children.push({text: title, id: childProducts[i].id});

	}

	//TODO: Fix products that have a single child

	return result;

	function getProduct(productTitle) {
		productTitle = productTitle.split(",")[0];
	
		var product = null;
		//Find if the product already exists
		for (var i=0; i < result.length; i++) {
			if (result[i].text === productTitle) {
				product = result[i];
				break;
			}
		}
	
		if (product === null) {
			product = {text: productTitle, id: productTitle, children: []};
			result.push(product)
		}
	
		return product;
	}

}

function getSiteMap() {
	var header = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xsi:schemaLocation=\"http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd\" xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n";
	var footer = "\n</urlset>";
	
	var content = [];

	//Get all pages
	var htmlFiles = fs.readdirSync(__dirname + "/../site/chapters").filter(function(fileName) { return (fileName.indexOf(".html") > -1);})
	
	for (var i = 0; i < htmlFiles.length; i++) {
		content.push("\t<url>");
		content.push("\t\t<loc>http://www.lakemedelsboken.se/" + htmlFiles[i] + "</loc>");
		content.push("\t</url>");
	}
	
	content = content.join("\n");
	
	var sitemap = header + content + footer;
	return sitemap;
	
}

app.get('/admin/atc', function(req,res){

	locals.date = new Date().toLocaleDateString();

	var query = req.query["query"];
	var results = [];
	var maxResults = 200;
	if (query !== undefined && query.length > 1) {

		query = query.toLowerCase();

		for (var i=0; i < atcTree.length; i++) {

			if (atcTree[i].id !== "root" && atcTree[i].type === "atc" && (atcTree[i].title.toLowerCase().indexOf(query) > -1 || atcTree[i].id.toLowerCase().indexOf(query) > -1)) {
				if (atcTree[i].title.toLowerCase() === query) {
					results.unshift(atcTree[i].id + " " + atcTree[i].title);
				} else {
					results.push(atcTree[i].id + " " + atcTree[i].title);
				}
				if (results.length >= maxResults) {
					break;
				}
			}

			if (atcTree[i].id !== "root" && atcTree[i].type !== "atc" && atcTree[i].title !== undefined && (atcTree[i].title.toLowerCase().indexOf(query) > -1 || atcTree[i].id.toLowerCase().indexOf(query) > -1)) {
				var parentATC = null;
				for (var j=0; j < atcTree.length; j++) {
					if (atcTree[j].id === atcTree[i].parentId) {
						parentATC = atcTree[j];
					}
				};
				results.push(parentATC.id + " " + parentATC.title + " (*" + atcTree[i].title + ")");
				if (results.length >= maxResults) {
					break;
				}
			}

		}
	}
	var options = {"options": results};

	res.json(options);

});

app.get('/admin/keywords.json', function(req,res) {
	res.json(getKeywords());
});

app.get('/admin/update', function(req,res) {
	if (req.xhr) {
		var word = req.query["keyword"];
		var atc = req.query["value"];
	
		if (word !== undefined && word !== "" && atc !== undefined && atc !== "") {
			if (atc.indexOf("(*") > -1) {
				atc = atc.split("(*")[0];
			}
			word = word.toLowerCase();
			updateWord(word, atc);
			res.send(200);
		} else {
			res.send(500, "Not what I was expecting...");
		}
	} else {
		res.send(500, "Not what I was expecting...");
	}
});

app.get('/admin/delete', function(req,res) {
	if (req.xhr) {
		var word = req.query["keyword"];
		if (word !== undefined && word !== "") {
			deleteWord(word);
			res.send(200);
		} else {
			res.send(500, "Not what I was expecting...");
		}
	} else {
		res.send(500, "Not what I was expecting...");
	}
});


/* The 404 Route (ALWAYS Keep this as the last route) */
/*
app.get('/*', function(req, res){
//res.end(404)
res.render('404.ejs', locals);
});
*/

function getExistingKeywordConnections() {
	var chapters = getChapters();
	
	var existing = {};
	
	for (var i = 0; i < chapters.length; i++) {
		var chapter = chapters[i];
		var $ = cheerio.load(fs.readFileSync(chapter.path));
		
		var genericas = $(".inlineGenerica");
		genericas.each(function(index, element) {
			var generica = $(element);
			var atcCodes = generica.attr("data-atcid").split(",");
			var atcTitles = generica.attr("data-atctitles").replace(/\_/g, " ").replace(/\-\-/g, " / ").split("$$");
			
			var word = generica.text().trim().toLowerCase();
			
			existing[word] = {atc: atcCodes, title: atcTitles};
		});
	}
	
	return existing;
}

var keywords = null;

function getKeywords() {

	keywords = JSON.parse(fs.readFileSync(__dirname + "/keywords.json", "utf8"));

	//Sort keywords on ATC
	var sortedKeywords = [];
	for (var name in keywords) {
		sortedKeywords.push({name: name, atc: keywords[name].atc});
	}

	sortedKeywords.sort(function(a, b) {
		if(a.atc < b.atc) return -1;
		if(a.atc > b.atc) return 1;
		return 0;
	});

	console.log(sortedKeywords);

	var sorted = {};
	for (var i = 0; i < sortedKeywords.length; i++) {
		sorted[sortedKeywords[i].name] = {atc: sortedKeywords[i].atc};
	}

	return sorted;

}
function deleteWord(word) {

	createBackupCopyOfWords();

	var words = getKeywords();
	delete words[word];
	fs.writeFileSync(__dirname + "/keywords.json", JSON.stringify(words, null, "\t"), "utf8");
	keywords = words;
}

function updateWord(word, atc) {

	createBackupCopyOfWords();

	var words = getKeywords();
	words[word] = {"atc": atc};
	fs.writeFileSync(__dirname + "/keywords.json", JSON.stringify(words, null, "\t"), "utf8");
	keywords = words;
}

function createBackupCopyOfWords() {
	var backupLocation = __dirname + "/backup/keywords-" + getCurrentTimestamp() + ".json";
	copyFileSync(__dirname + "/keywords.json", backupLocation);
}

function copyFileSync(srcFile, destFile) {
	var BUF_LENGTH, buff, bytesRead, fdr, fdw, pos;
	BUF_LENGTH = 64 * 1024;
	buff = new Buffer(BUF_LENGTH);
	fdr = fs.openSync(srcFile, 'r');
	fdw = fs.openSync(destFile, 'w');
	bytesRead = 1;
	pos = 0;
	while (bytesRead > 0) {
		bytesRead = fs.readSync(fdr, buff, 0, BUF_LENGTH, pos);
		fs.writeSync(fdw, buff, 0, bytesRead);
		pos += bytesRead;
	}
	fs.closeSync(fdr);
	return fs.closeSync(fdw);
}

function getPastTimestamp(t) {
	var d = new Date(t);
	var output = "";
	var items = new Array();
	var i = 0;
	items[i++] = d.getFullYear();
	items[i++] = d.getMonth() + 1;
	items[i++] = d.getDate();
	items[i++] = d.getHours();
	items[i++] = d.getMinutes();
	items[i]   = d.getSeconds();

	for(i=0;i<items.length;i+=1) {
		output += (items[i]<10)?"0"+items[i]:items[i];
		if(i < items.length - 1) output += '-'; 
	}

	return output;
}
function getCurrentTimestamp() {
	return getPastTimestamp((new Date()).getTime());
}

function parseToHtml(mifmlFilePath, callback) {

	var pathToParser = __dirname + "/../../parser/mifmlparser.js";

	//console.error(pathToParser);
	var execute = require('child_process').exec;
	var child = execute("node " + pathToParser + " -i " + mifmlFilePath + " -o /tmp/", {maxBuffer: 2000*1024}, function (error, stdout, stderr) {

		callback(error, stderr, stdout);

	});

}


function parseToHtmlAndSave(mifmlFilePath, append, callback) {

	console.log("Begin parsing " + mifmlFilePath);

	var startParseTime = new Date().getTime();

	parseToHtml(mifmlFilePath, function(err, stderr, stdout) {

		var parserMessages = stderr.toString();

		if (err !== null) {
			console.log('exec error: ' + err);
		}

		var fileName = mifmlFilePath.split("/");
		fileName = fileName[fileName.length - 1];
	
		var htmlFileName = fileName.toLowerCase().replace(".mif.mifml", ".html").replace(/\+/g, "-");
		var htmlContent = stdout.toString();
	
		htmlContent = htmlContent.replace(/\{VERSION\}/g, settings.version);
	
		//console.error("Error:" + stderr);
		//console.error("Out:" + htmlContent);

		//Create and save searchIndex
		var newSearchIndex = searchIndexer(htmlContent, htmlFileName);
		var searchDir = __dirname + "/../site/chapters/" + htmlFileName.replace(".html", "_index/");
		wrench.mkdirSyncRecursive(searchDir);
		var searchIndexPath = searchDir + htmlFileName.replace(".html", ".json");
		fs.writeFileSync(searchIndexPath, newSearchIndex, "utf8");
	
		//Add page structure to sideBar
		newSearchIndex = JSON.parse(newSearchIndex);
		var $ = require("cheerio").load(htmlContent);
		var sideBar = $("#sideBar");
		var sideBarContent = buildSideBarToc(newSearchIndex);
		sideBar.append($(sideBarContent));

		//Add way to request conflicts of interest
		
		//Find authors of current chapter
		var chapterId = htmlFileName.split("_")[0];
		var authors = require("./db/authors_registry").getAuthorsByChapterId(chapterId);

		//console.log("Found " + authors.length + " authors for chapterId: " + chapterId);

		//Render authors anew
		var oldAuthors = $("p.authors");
		//console.log("Before:");
		//console.log(oldAuthors.html());

		var authorsDisclosure = $('<div class="authorsDisclosure"><p>Jävsdeklarationer för kapitlets författare kan erhållas via <a href=\"mailto:registrator@mpa.se\">registrator@mpa.se</a>. Enklast sker detta genom de förberedda mejlen nedan.</p></div>');

		var newAuthors = $('<ul class="authors"></ul>');
		for (var i = 0; i < authors.length; i++) {
			var author = authors[i];
			
			var niceAuthorName = "";

			var name = author.name.split(" ");
			if (name.length === 2) {
				niceAuthorName = name[1] + " " + name[0];
			} else if (author.firstname !== undefined && author.lastname !== undefined) {
				niceAuthorName = author.firstname + " " + author.lastname;
			} else {
				niceAuthorName = author.name
				//console.log(author.name + " could not be niced up.");
			}

			if (author.department !== undefined && author.department !== "") {
				niceAuthorName += ", " + author.department;
			}

			if (author.hospital !== undefined && author.hospital !== "") {
				niceAuthorName += ", " + author.hospital;
			}
			
			if (author.city !== undefined && author.city !== "") {
				niceAuthorName += ", " + author.city;
			}
			
			//console.log("Addind author: " + niceAuthorName);
			var chapterName = $("h1").first().text();
			
			newAuthors.append("<li>" + niceAuthorName  + " <a href=\"mailto:registrator@mpa.se?subject=Förfrågan om jävsdeklaration&body=Jag önskar jävsdeklaration för%0D%0A" + niceAuthorName + "%0D%0Aförfattare till kapitlet " + chapterName + ", Läkemedelsboken 2014.%0D%0A%0D%0AVänliga hälsningar%0D%0A\" class=\"btn btn-mini\"><i class=\"icon icon-envelope-alt\"></i> Fråga efter jävsdeklaration via mejl</a></li>");
			
		}

		if (authors.length > 0) {
			//oldAuthors.replaceWith(newAuthors);

			authorsDisclosure.append(newAuthors)

			var referenceHeader = $(".referenceHeader").last();
			referenceHeader.before(authorsDisclosure);
		}

		//console.log("After:");
//		console.log(oldAuthors.html());

		//Get parsed and restructured content
		htmlContent = $.html();

		//Write page to disk
		fs.writeFileSync(__dirname + "/../site/chapters/" + htmlFileName, htmlContent, "utf8");
	
		//Save messages from parser
		
		var endParseTime = new Date().getTime();
		var totalParseTime = ((endParseTime - startParseTime) / 1000) + " seconds";
		
		parserMessages += "Parsing finished in " + totalParseTime + "\n\n";
		
		var latestParserMessagesFile = __dirname + "/mif/parserMessages.txt";
		if (append) {
			fs.appendFileSync(latestParserMessagesFile, parserMessages, "utf8");
		} else {
			fs.writeFileSync(latestParserMessagesFile, parserMessages, "utf8");
		}

		callback(err);
	
	});
}

function buildSideBarToc(index) {
	var content = "<li><a href=\"/\"><i class=\"icon icon-chevron-left\"></i> Läkemedelsboken</a><ul>";

	var root = index[0];

	if (root.hasChildren) {
		content += getChildrenAsHtml(index, root.id);
	}
	
	content += "</li></ul>"
	return content;
}

function getIcon(type) {
	var icons = {
		header: "icon-chevron-right",
		infoTable: "icon-th-large",
		facts: "icon-th-list",
		therapyRecommendations: "icon-list",
		figure: "icon-picture"
	}
	if (icons[type] !== undefined) {
		return icons[type];
	} else {
		return icons["header"];
	}
}

function getChildrenAsHtml(index, parentId) {
	var content = "";
	var children = getIndexChildrenById(index, parentId);
	for (var i=0; i < children.length; i++) {
		content += "<li><a href=\"" + children[i].chapter + "#" + children[i].id + "\"><i class=\"icon " + (children[i].hasChildren ? "icon-bookmark-empty" : getIcon(children[i].type)) + "\"></i> " + htmlEscape(children[i].title) + "</a>";
		if (children[i].hasChildren) {
			content += "<ul>"; //class=\"nav nav-list\"
			content += getChildrenAsHtml(index, children[i].id);
			content += "</ul>";
		}
		content += "</li>"
	}
	return content;
}

function htmlEscape (text) {

	return String(text)
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function getIndexChildrenById(index, parentId) {
	var children = [];
	for (var i=0; i < index.length; i++) {
		if (index[i].parentId === parentId) {
			children.push(index[i]);
		}
	}
	return children;
}

function getIndexItemById(index, id) {
	var item = null;
	for (var i=0; i < index.length; i++) {
		if (index[i].id === id) {
			item = index[i];
			break;
		}
	}
	return item;
}

function getChapters() {
	var files = fs.readdirSync(__dirname + "/../site/chapters/");
	var previews = [];
	for (var i=0; i < files.length; i++) {
		if (files[i].indexOf(".html") > -1) {
			var pdf = "";
		
			var pdfDirPath = __dirname + "/../site/chapters/" + files[i].replace(".html", "_pdf/");
			if (fs.existsSync(pdfDirPath)) {
				pdf = files[i].replace(".html", "_pdf/") + files[i].replace(".html", ".pdf");
			}
		
			previews.push({"name": files[i], "date": fs.statSync(__dirname + "/../site/chapters/" + files[i]).mtime.getTime(), "pdf": pdf, "path": __dirname + "/../site/chapters/" + files[i]});
		}
	}
	previews.sort(function(a, b) {return (b.date - a.date);});
	return previews;
}
