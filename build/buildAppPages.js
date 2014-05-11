var path = require("path");
var fs = require("fs");
var wrench = require("wrench");
var async = require("async");
var crypto = require("crypto");
//var request = require("request");
//var zlib = require("zlib");
var exec = require('child_process').exec;
var cheerio = require("cheerio");



var searchIndexer = require("../search/createSearchIndex.js");

var numCPUs = require('os').cpus().length;
var settings = JSON.parse(fs.readFileSync(__dirname + "/../settings/settings.json", "utf8"));

var copyFileSync;

function copyFileSync(srcFile, destFile) {
	var BUF_LENGTH, buff, bytesRead, fdr, fdw, pos;
	BUF_LENGTH = 64 * 1024;
	buff = new Buffer(BUF_LENGTH);
	fdr = fs.openSync(srcFile, "r");
	fdw = fs.openSync(destFile, "w");
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

function convertAll(outputDir) {

	//Clear old parser messages
//	var latestParserMessagesFile = __dirname + "/mif/parserMessages.txt"; 
//	fs.writeFileSync(latestParserMessagesFile, "", "utf8");


	//get all mifml files
	var files = fs.readdirSync(__dirname + "/../servers/admin/mif/");

	var nrOfParallelProcessing = numCPUs;
	if (nrOfParallelProcessing < 1) {
		nrOfParallelProcessing = 1;
	}

	var startParserTime = new Date().getTime();

	var q = async.queue(function (task, callback) {
		parseToHtmlAndSave(task.name, outputDir, function(err) {
			callback();
		});
	}, nrOfParallelProcessing);

	q.drain = function() {
		//		console.log('All items have been processed');
		var endParserTime = new Date().getTime();
		var totalTime = ((endParserTime - startParserTime) / 1000) + " seconds";

		//fs.appendFileSync(latestParserMessagesFile, "\nParsing finished in " + totalTime, "utf8");
		
		console.log("All done, parsing finished in " + totalTime);
	}	

	for (var i=0; i < files.length; i++) {
		if (files[i].indexOf(".mifml") > 0) {
			var filePath = path.normalize(__dirname + "/../servers/admin/mif/" + files[i]);

			//Create image dirs and copy medium_x2 images from opt dir
			var cleanFileName = filePath.split("/");
			cleanFileName = cleanFileName[cleanFileName.length - 1].replace(".mif.mifml", "");
			
			var optImagesDir = path.normalize(__dirname + "/../servers/site/chapters/" + cleanFileName + "_images/opt/");
			var outputImagesDir = path.normalize(outputDir + "/" + cleanFileName + "_images/");
			
			var imageFiles = [];
			if (fs.existsSync(optImagesDir)) {
				imageFiles = fs.readdirSync(optImagesDir);
			} 

			console.log("Copy images from: " + optImagesDir);
			console.log("Copy images to: " + outputImagesDir);
			var foundImages = [];
			for (var j = 0; j < imageFiles.length; j++) {
				if (imageFiles[j].indexOf("_medium_x2.png") > 0) {
					console.log("Found: " + optImagesDir + imageFiles[j]);
					foundImages.push(imageFiles[j]);
				}
			}

			if (foundImages.length > 0) {
				if (fs.existsSync(outputImagesDir)) {
					wrench.rmdirSyncRecursive(outputImagesDir);
				}
				wrench.mkdirSyncRecursive(outputImagesDir);
				
				for (var j = 0; j < foundImages.length; j++) {
					console.log("Copying " + foundImages[j] + " to " + outputImagesDir);
					copyFileSync(optImagesDir + foundImages[j], outputImagesDir + foundImages[j]);
				}
			}

			console.log("Adding " + filePath + " to parser queue.");
			
			q.push({name: filePath}, function (err) {
			});
		}
	}
}

function parseToHtml(mifmlFilePath, callback) {

	var pathToParser = __dirname + "/../parser/mifmlparser.js";

	//console.error(pathToParser);
	var execute = require('child_process').exec;
	var child = execute("node " + pathToParser + " -i " + mifmlFilePath + " -t iOS -o /tmp/", {maxBuffer: 2000*1024}, function (error, stdout, stderr) {

		callback(error, stderr, stdout);

	});

}

function parseToHtmlAndSave(mifmlFilePath, outputDir, callback) {

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

		var $ = require("cheerio").load(htmlContent);

		/*
		console.log("Creating search index...");
		var newSearchIndex = searchIndexer(htmlContent, htmlFileName);
		console.log("Done creating index.");
		var searchDir = outputDir + "/" + htmlFileName.replace(".html", "_index/");
		wrench.mkdirSyncRecursive(searchDir);
		var searchIndexPath = searchDir + htmlFileName.replace(".html", ".json");
		fs.writeFileSync(searchIndexPath, newSearchIndex, "utf8");
	
		//Add page structure to sideBar
		newSearchIndex = JSON.parse(newSearchIndex);
		var $ = require("cheerio").load(htmlContent);
//		var sideBar = $("#sideBar");
//		var sideBarContent = buildSideBarToc(newSearchIndex);
//		sideBar.append($(sideBarContent));

*/
		//Add way to request conflicts of interest
		
		//Find authors of current chapter
		var chapterId = htmlFileName.split("_")[0];
		var authors = require(__dirname + "/../servers/admin/db/authors_registry").getAuthorsByChapterId(chapterId);

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
			
			//console.log("Adding author: " + niceAuthorName);
			var chapterName = $("h1").first().text();
			
			newAuthors.append("<li>" + niceAuthorName  + " <a href=\"mailto:registrator@mpa.se?subject=" + encodeURIComponent('Förfrågan om jävsdeklaration') + "&body=" + encodeURIComponent('Jag önskar jävsdeklaration för') + "%0D%0A" + encodeURIComponent(niceAuthorName) + "%0D%0A" + encodeURIComponent('författare till kapitlet ' + chapterName) + encodeURIComponent(', Läkemedelsboken 2014.') + "%0D%0A%0D%0A" + encodeURIComponent('Vänliga hälsningar') + "%0D%0A\" class=\"btn btn-mini\"><i class=\"icon icon-envelope-alt\"></i> Fråga efter jävsdeklaration via mejl</a></li>");
			
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
		fs.writeFileSync(outputDir + "/" + htmlFileName, htmlContent, "utf8");
	
		//Save messages from parser
		
		var endParseTime = new Date().getTime();
		var totalParseTime = ((endParseTime - startParseTime) / 1000) + " seconds";
		
		parserMessages += "Parsing finished in " + totalParseTime + "\n\n";

		console.log(parserMessages);

/*		
		var latestParserMessagesFile = __dirname + "/mif/parserMessages.txt";
		if (append) {
			fs.appendFileSync(latestParserMessagesFile, parserMessages, "utf8");
		} else {
			fs.writeFileSync(latestParserMessagesFile, parserMessages, "utf8");
		}
*/
		callback(err);
	
	});
}

var dirToSendParsedFiles = undefined;
var argv = process.argv;
var lastArgument = argv[argv.length - 1];

if (fs.lstatSync(path.normalize(lastArgument)).isDirectory()) {
	convertAll(lastArgument);
} else {
	console.log("Usage: \"node buildAppPages.js outputDir\"");
}

