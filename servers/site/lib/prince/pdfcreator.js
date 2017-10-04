var fs = require("fs");
var request = require("request");
var path = require("path")
var cheerio = require("cheerio");
var spawn = require("child_process").spawn;
var exec = require("child_process").exec;
var dateFormat = require("dateformat");
var uuid = require('node-uuid');
var historyModel = require("../../../cms/models/historymodel");


var pdfCreator = {
	printCssFile: "http://localhost/css/uncompressed/print.css",
	createFromUrl: function(url, requestCookies, callback) {

		if (url !== undefined && url !== "") {

			if (url.indexOf('.json') !== -1 ) {
				url = url.replace('.json', '.html');
			}

			//Calculate hash based on the current output
			url = url.replace(/\.\.\//g, "").replace(/\.\//g, "");

			var fileOnDisk = path.join(__dirname, "..", "..", "..", "cms", "output");

			if (url.indexOf("/cms/draft") === 0) {
				fileOnDisk = path.join(fileOnDisk, "draft", url.replace("/cms/draft/", ""));
				console.log("file on disk : "+fileOnDisk);
				//Do not cache draft files
				//fileOnDisk = null;
			} else if (url.indexOf("/kapitel") === 0) {
				fileOnDisk = path.join(fileOnDisk, "published", url.substr(1));
				console.log("file on disk : "+fileOnDisk);
			} else {
				fileOnDisk = null;
			}

			var uniqueIdForContent = uuid.v1();

			//Find the file on disk
			if (fileOnDisk !== null && fs.existsSync(fileOnDisk)) {
				console.log("file exists");
				//Calculate the hash of the output html file
				uniqueIdForContent = historyModel.getFileChecksumSync(fileOnDisk);
				console.log("unique Id For Content is : "+uniqueIdForContent);

				if (uniqueIdForContent === null || uniqueIdForContent === undefined) {
					uniqueIdForContent = uuid.v1();
				}
			}

			//The id will either be the checksum of the file or a uuid
			var outPath = path.join(require("os").tmpdir(), uniqueIdForContent + ".pdf");
			console.log("outPath is : "+outPath);
			var date = new Date();
			var fileNameDate = dateFormat(date, "yyyy-mm-dd--HH-MM-ss");
			console.log("fileNameDate is : "+fileNameDate);
			var newFileName = path.basename(url, ".html") + "-" + fileNameDate + ".pdf";
			console.log("newFileName is : "+newFileName);
			//Simple cache check, hash match equals direct result
			if (fs.existsSync(outPath)) {
				console.log("output exists");
				return callback(null, {name: newFileName, path: outPath});
			}

			var cookies = [];

			if (requestCookies !== undefined && requestCookies !== null) {
				for (var cookie in requestCookies) {
					cookies.push("--cookie " + encodeURIComponent(cookie) + "=" + encodeURIComponent(requestCookies[cookie]));
				}
			}

			var arguments = ["--no-author-style", "-s " + pdfCreator.printCssFile, "--script=http://localhost/js/uncompressed/print.js"];

			arguments = arguments.concat(cookies);

			arguments.push("http://localhost" + url)
			arguments.push("-o " + outPath);

			var hasExited = false;
			console.log("About to run prince with arguments:");
			console.log(arguments.join(" "));

			exec("prince " + arguments.join(" "), function(err, stdout, stderr) {

				if (err) {
					return callback(err);
				}

				if (stdout) {
					console.log(stdout);
				}

				if (stderr) {
					console.log(stderr);
				}

				return callback(err, {name: newFileName, path: outPath});
			});


		} else {
			return callback(new Error("'url' was empty or undefined"));
		}
	}
}

module.exports = pdfCreator;
