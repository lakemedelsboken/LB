var cronJob = require('cron').CronJob;
var fs = require("fs-extra");
var path = require("path");
var blc = require("broken-link-checker");

require("es6-promise").polyfill();
require("object.assign").shim();

//Mail functionality
var nodemailer = require("nodemailer");

var job = new cronJob({
    cronTime: '00 00 10 * * *',
    onTick: function() {
        // Runs every day at 10:00:00 AM.
        checkBrokenLinks(function(err, message) {
            if (err) {
                console.error(err);
            } else {
                console.log(message);
            }
        });
    },
    start: true
});



if (!fs.existsSync("../../../../settings/secretSettings.json")) {
    console.error("Config file [../../../../settings/secretSettings.json] missing!");
    console.error("Did you forget to run `make decrypt_conf`?");
    process.exit(1);
}

(function() {
    var conf_time = fs.statSync("../../../../settings/secretSettings.json").mtime.getTime();
    var cast5_time = fs.statSync("../../../../settings/secretSettings.json.cast5").mtime.getTime();

    if (conf_time < cast5_time) {
        console.error("Your config file is out of date!");
        console.error("You need to run `make decrypt_conf` to update it.");
        process.exit(1);
    }
})();

var secretSettings = JSON.parse(fs.readFileSync("../../../../settings/secretSettings.json", "utf8"));


checkBrokenLinks(function(brokenLinks) {
    sendMail(brokenLinks);
});

function checkBrokenLinks(callback) {
    var that = this;

    that.brokenLinks = "";

    // Check lakemedelsboken.se

    var options  = {
        filterLevel: 0,
        honorRobotExclusions: false,
        excludeExternalLinks:false,
        excludedKeywords: ["/atc/", "/products/"]

    };

    var handlers = {
        link: function(result, data){
            if(result.broken) {
                that.brokenLinks += "--------------------------BROKEN LINK FOUND---------------------------- \n";
                that.brokenLinks += "Broken Link:     "+result.url.original+"\n";
                that.brokenLinks += "Reason:          "+result.brokenReason+"\n";
                that.brokenLinks += "Location:        "+result.base.original+"\n";
                that.brokenLinks += "Lable:           "+result.html.text+"\n";
                that.brokenLinks += "-----------------------------------------------------------------------\n";
            }
        },
        end: function(){
            callback(that.brokenLinks, "Finished checking links");
        }
    };


    var siteChecker = new blc.SiteChecker(options, handlers);

    siteChecker.enqueue("http://lakemedelsboken.se", {});

}

function sendMail(brokenLinksString) {

    if (brokenLinksString !== undefined && brokenLinksString !== "") {

        var plainMail = ["12" + brokenLinksString];

        var smtpTransport = nodemailer.createTransport("SMTP", {
            service: "Gmail",
            auth: {
                user: secretSettings.fass.gmailAddress,
                pass: secretSettings.fass.gmailPassword
            }
        });

        var mailOptions = {
            from: "Läkemedelsboken <" + secretSettings.fass.gmailAddress + ">",
            to: secretSettings.cms.brokenLinkRecipients,
            subject: "[BOT] Broken Links - LB",
            text: plainMail
        }

        smtpTransport.sendMail(mailOptions, function (error, response) {
            if (error) {
                console.log(error);
            } else {
                console.log("Message sent: " + response.message);
            }

            smtpTransport.close();
        });
    }
}


