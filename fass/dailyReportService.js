var fs = require("fs");
var nodemailer = require("nodemailer");

if (!fs.existsSync("../settings/secretSettings.json")) {
	console.error("Config file [../settings/secretSettings.json] missing!");
	console.error("Did you forget to run `make decrypt_conf`?");
	process.exit(1);
}

(function() {
	var conf_time = fs.statSync("../settings/secretSettings.json").mtime.getTime();
	var cast5_time = fs.statSync("../settings/secretSettings.json.cast5").mtime.getTime();
 
	if (conf_time < cast5_time) {
		console.error("Your config file is out of date!");
		console.error("You need to run `make decrypt_conf` to update it.");
		process.exit(1);
	}
})();

var secretSettings = JSON.parse(fs.readFileSync("../settings/secretSettings.json", "utf8"));

var updateInterval = 1000 * 60 * 60 * 24;
setInterval(function() {

	var recentUpdates = getRecentlyModifiedFiles(24);
	sendMail(recentUpdates);	

}, updateInterval);

//Also run at start
var recentUpdates = getRecentlyModifiedFiles(24);
sendMail(recentUpdates);

function getRecentlyModifiedFiles(hours) {

	var recentlyModifiedFiles = [];
	var productsFolderPath = __dirname + "/www/products/";
	var allFiles = fs.readdirSync(productsFolderPath);

	var currentDate = new Date().getTime();
	var lastDay = 1000 * 60 * 60 * hours;
	var minimumModifiedDate = currentDate - lastDay;

	for (var i = allFiles.length - 1; i >= 0; i--) {
		if (allFiles[i].indexOf(".json") > -1) {
			if (fs.statSync(productsFolderPath + allFiles[i]).mtime.getTime() > minimumModifiedDate) {
				recentlyModifiedFiles.push(productsFolderPath + allFiles[i]);
			}
		}
	}
	return recentlyModifiedFiles;
}

function sendMail(updatedFiles) {

	var plainMail = [updatedFiles.length + " preparat uppdaterades de senaste 24 timmarna.\n\nDessa preparat uppdaterades med ny information:\n"];
	var htmlMail = ["<p><strong>" + updatedFiles.length + " preparat uppdaterades de senaste 24 timmarna.</strong></p><p>Dessa preparat uppdaterades med ny information:</p><ol>"];

	var removedHtml = [];
	var removedPlain = [];

	var updateCounter = 0;
	var removedCounter = 0;

	for (var i = 0; i < updatedFiles.length; i++) {
		var product = JSON.parse(fs.readFileSync(updatedFiles[i], "utf8"));
		if (product.noinfo === undefined) {
			updateCounter++;
			plainMail.push(updateCounter + ". " + product.name + ", " + product.description + ", " + product.brand);
			htmlMail.push("<li><strong>" + product.name + "</strong>, " + product.description + ", <strong>" + product.brand + "</strong></li>");
		} else {
			removedCounter++;
			var nplId = updatedFiles[i].split("/");
			nplId = nplId[nplId.length - 1];
			removedPlain.push(removedCounter + ". " + nplId);
			removedHtml.push("<li>" + nplId + "</li>");
		}
	}

	htmlMail.push("</ol>");
	
	htmlMail.push("<p>Följande filer innehåller ingen information längre:</p><ol>");
	plainMail.push("\nFöljande filer innehåller ingen information längre:\n");
	
	htmlMail = htmlMail.concat(removedHtml);
	plainMail = plainMail.concat(removedPlain);
	
	htmlMail.push("</ol>");

	var smtpTransport = nodemailer.createTransport("SMTP",{
		service: "Gmail",
		auth: {
			user: secretSettings.fass.gmailAddress,
			pass: secretSettings.fass.gmailPassword
		}
	});

	var mailOptions = {
		from: "Läkemedelsboken <" + secretSettings.fass.gmailAddress + ">", 
		to: secretSettings.fass.dailyReportRecipients, 
		subject: "[BOT] Uppdaterade preparat", 
		text: plainMail.join("\n"), 
		html: htmlMail.join("")
	}

	smtpTransport.sendMail(mailOptions, function(error, response){
		if (error){
			console.log(error);
		} else {
			console.log("Message sent: " + response.message);
		}

		smtpTransport.close();
	});	
}