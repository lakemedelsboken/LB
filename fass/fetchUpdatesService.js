var fs = require("fs");
var urlParser = require("url");
var http = require("http");
var async = require("async");
var path = require("path");
var cheerio = require("cheerio");
var crypto = require("crypto");
var request = require("request");
var nodemailer = require("nodemailer");
var auth = require('./authenticationService');
var Q = require('q');


var baseUrl = "http://www.fass.se/LIF/FassDocumentWebService2?WSDL";

var secretSettingsPath = __dirname + "/../settings/secretSettings.json";
var errors = {};


if (!fs.existsSync(secretSettingsPath)) {
	console.error("Config file [" + secretSettingsPath + "] missing!");
	console.error("Did you forget to run `make decrypt_conf`?");
	process.exit(1);
}

(function() {
	var conf_time = fs.statSync(secretSettingsPath).mtime.getTime();
	var cast5_time = fs.statSync(secretSettingsPath + ".cast5").mtime.getTime();

	if (conf_time < cast5_time) {
		console.error("Your config file is out of date!");
		console.error("You need to run `make decrypt_conf` to update it.");
		process.exit(1);
	}
})();

var secretSettings = JSON.parse(fs.readFileSync(secretSettingsPath, "utf8"));

var fassUserId = secretSettings.fass.fassUserId;
var fassUsername = secretSettings.fass.username;
var fassPassword = secretSettings.fass.password;

var chokidar = require("chokidar");
var watcher = chokidar.watch(path.normalize(__dirname + "/shared/foundUpdates.json"), {persistent: true, ignoreInitial: true, interval:1000});

watcher.on('error', function(error) {console.error('Error happened on file watch', error);})

watcher.on('change', function(path, stats) {
	//console.log("Fetching updates...");
	fetchUpdates();
});

console.log("Watching shared/foundUpdates.json for changes...");

var isUpdating = false;

function fetchUpdates() {

	if (isUpdating) {
		//console.log("Updated already in progress");
		return;
	}

	isUpdating = true;

	var foundUpdates = [];

	try {
		foundUpdates = JSON.parse(fs.readFileSync(__dirname + "/shared/foundUpdates.json", "utf8"));
	} catch (err) {
		console.error("Error trying to parse shared/foundUpdates.json:")
		console.error(err);
	}

	if (foundUpdates.length > 1) {
		//Get the last item and update
		var updates = [foundUpdates[foundUpdates.length - 1]];
		check(updates);
	} else {
		auth.logout();
		console.log("Fetch queue is empty.");
		isUpdating = false;
	}

}

//Run at start
fetchUpdates();



function check(updates) {

	console.log("\n" + formatDate(new Date()) + " Fetching " + updates.join(", ") + "...")

	var q = async.queue(function (task, callback) {

		auth.login(fassUsername, fassPassword)
		.then(function (ticket) {
			getProductByNplId(ticket, task.nplId)
			.then(function (answer) {
				processAnswer(answer, task.nplId, function(err, data) {

					if (err && (err.message.indexOf("Error fetching") > -1 || err.message.indexOf("Unexpected error") > -1)) {
						callback(err, task.nplId);
					} else if (data && data.id !== undefined) {
						var fileName = __dirname + "/www/products/" + data.id + ".json";
						//console.log("Writing to: " + fileName);

						//Save to file
						fs.writeFileSync(fileName, JSON.stringify(data, null, "\t"));

						var description = data.name + ", " + data.description;
						if (data.name === undefined) {
							description = "Preparatet har ingen förskrivarinformation: " + data.id;
						}
						callback(null, data.id, description);
					} else {
						if (err) {
							callback(err, task.nplId);
						} else {
							callback(new Error("Id was undefined"), task.nplId);
						}
					}
				});
			});
		})
		.fail(function (error) {
			console.log(error.message);
		});
	}, 1);

	//Add to queue
	for (var i = 0; i < updates.length; i++) {
		if (updates[i] !== null && updates[i] !== undefined && updates[i] !== "undefined") {
			q.push({url: baseUrl, nplId: updates[i]}, function(err, id, name) {
				if (err) {
					console.log(err);
					if (id !== undefined) {
						console.log("Error with id: " + id);
						//Move id to last of queue (first in array)
						if (errors[id] !== undefined) {
							//Retries, max 5 for one id, then save to error log and mail
							if (errors[id] >= 5) {
								//Remove and mail
								removeFromFoundUpdates(id);
								sendMail("Unable to update: " + id, "The server has tried multiple times to update nplId: \"" + id + "\"\n\nThe item has been removed from the queue.");
								errors[id] = undefined;
							} else {
								errors[id]++;
								moveToLast(id);
							}
						} else {
							errors[id] = 1;
							moveToLast(id);
						}
					}

				} else {
					//Remove from master list, this will trigger a new run of fetchUpdates()
					removeFromFoundUpdates(id);
					var abbrName = name;
					if (abbrName.indexOf("(") > -1) {
						abbrName = abbrName.substr(0, (abbrName.indexOf("(") - 1));
					}
					console.log(formatDate(new Date()) + " Finished updating " + id + " (" + abbrName + ")");
				}

			});

		} else {
			//Remove from list if undefined, null or "undefined"
			removeFromFoundUpdates(updates[i]);
			if (updates.length === 1) {
				q.drain();
			}
		}
	}

	//When queue is done
	q.drain = function() {
		//console.log("Queue is done for now");
		isUpdating = false;
		fetchUpdates();

	}
}

function getProductByNplId(ticket, nplId) {
	var deferred = Q.defer();
	var options = {
		url: 'https://www.fass.se/rest/fassdocument/nplid?version=1.0&nplId='+nplId,
		headers: {
			'ticket': ticket
		}
	};



	request(options, function (error, response, body) {
		deferred.resolve(body);
	}).on('error', function (e) {
		deferred.reject(e);
	});

	return deferred.promise
}

function moveToLast(nplId) {

	if (nplId !== null && nplId !== undefined && nplId !== "undefined") {
		var foundUpdates = JSON.parse(fs.readFileSync(__dirname + "/shared/foundUpdates.json", "utf8"));

		for (var i = foundUpdates.length - 1; i >= 1; i--) {
			if (foundUpdates[i] === nplId && i > 0) {
				//console.log("Removing " + nplId);
				foundUpdates.splice(i, 1);
			}
		}

		//Insert as second item
		foundUpdates.splice(1, 0, nplId);

		fs.writeFileSync(__dirname + "/shared/foundUpdatesFetchLock.json", JSON.stringify(foundUpdates, null, "\t"), "utf8");
		fs.renameSync(__dirname + "/shared/foundUpdatesFetchLock.json", __dirname + "/shared/foundUpdates.json");
		console.log("INFO: " + nplId + " was moved to the end of the queue.");
	} else {
		removeFromFoundUpdates(nplId);
	}

}

function removeFromFoundUpdates(nplId) {

	var foundUpdates = JSON.parse(fs.readFileSync(__dirname + "/shared/foundUpdates.json", "utf8"));

	for (var i = foundUpdates.length - 1; i >= 1; i--) {
		if (foundUpdates[i] === nplId && i > 0) {
			//console.log("Removing " + nplId);
			foundUpdates.splice(i, 1);
		}
	}

	//console.log("Saving new list");
	fs.writeFileSync(__dirname + "/shared/foundUpdatesFetchLock.json", JSON.stringify(foundUpdates, null, "\t"), "utf8");
	fs.renameSync(__dirname + "/shared/foundUpdatesFetchLock.json", __dirname + "/shared/foundUpdates.json");

}

function getNoInfo(nplId) {
	var noinfo = {noinfo: true, id: nplId};
	if (fs.existsSync(__dirname + "/../npl/products/" + nplId + ".json")) {
		var nplProduct = JSON.parse(fs.readFileSync(__dirname + "/../npl/products/" + nplId + ".json", "utf8"));
		noinfo.name = nplProduct.name;
		noinfo.description = nplProduct.description;
		noinfo.atcCode = nplProduct.atcCode;
		noinfo.brand = nplProduct.brand;
		noinfo.additionalMonitoring = false;
	}
	return noinfo;
}

function processAnswer(answer, nplId, callback) {

	if (answer.indexOf("errorMessage") > -1) {

		var output = getNoInfo(nplId);
		callback(new Error("No product info: " + nplId), output);

	}else {
		var $ = cheerio.load("<html><body>" + answer + "</body></html>");

		var product = $("npl-id:contains('" + nplId + "')").parent().parent();
		if (product.length > 0) {
			processProduct(product, $, function(err, result) {
				callback(err, result);
			});
		} else {
			//console.log("No products listed under nplId: " + nplId);
			callback(new Error("Error fetching: " + nplId + ". No products listed."));
		}
	}

}

function processProduct(product, $, callback) {

	var drugName = product.find("tradename").text().trim();
	var nplId = product.find("npl-id").text().trim();

	if (drugName === "" || drugName === null || nplId === null || nplId === "undefined" || nplId === undefined && nplId === "") {

		var output = {id: nplId, noinfo: true};

		callback(new Error("Error fetching nplId: " + nplId), output);
	} else {
		getImageData(nplId, function(err, imagesData) {
			if (err) {
				console.log(err);
				callback(err);
			} else {
				getSPC(drugName, nplId, function(err, spcLink) {
					var output = {};
					output.id = nplId;
					output.images = imagesData;
					output.name = drugName;
					output.brand = product.find("product-identifier > company").text();
					output.description = product.find("medicine-form").text() + " " + product.find("strength-text").text() + " " + product.find("product-info > flavour-or-appearance").text();
					output.mechanism = product.find("product-info > description").text();
					output.parallelimport = product.find("product-info > parallel-import-country").text();
					output.available = product.find("product-info > available").text();
					output.active = product.find("product-info > active").text();
					var additionalMonitoring = product.find("product-info > additional-monitoring");

					if (additionalMonitoring.length > 0 && additionalMonitoring.first().text() === "true") {
						output.additionalMonitoring = true;
					} else {
						output.additionalMonitoring = false;
					}

					if (spcLink !== undefined && spcLink !== null && spcLink !== "" && spcLink !== "undefined") {
						output.spcLink = spcLink;
					}

					output.partOfFass = $("is-part-of-fass").text();
					output.lffInsurance = $("lff-insurance-member").text();
					/*
					Vi uppmanar er att titta på värdena i nedanstående taggar som kommer med i svaret från webbtjänsten, dvs.:
					<is-part-of-fass>/<lff-insurance-member>
					1. True/True – Företaget deltar i Fass OCH i Läkemedelsförsäkringen
					2. True/False – Företaget deltar i Fass men INTE i Läkemedelsförsäkringen
					3. False/True – Företaget deltar INTE i Fass men i Läkemedelsförsäkringen – Informationen lämnas INTE med automatik. Det måste alltså läggas till en uppmaning om att söka information om läkemedlet omfattas av Läkemedelsförsäkringen eller ej, förslagsvis via t.ex. en länk: www.lakemedelsforsakringen.se
					4. False/False – Företaget deltar varken i Fass eller i Läkemedelsförsäkringen – Även här måste det ligga en uppmaning om att söka information om läkemedlet omfattas av Läkemedelsförsäkringen eller ej, förslagsvis via t.ex. en länk: www.lakemedelsforsakringen.se

					I fall 3 och 4 ignoreras alltså värdet för läkemedelsförsäkringen eftersom värdet för Fass medlemsskap är ”False”.
					Vi fortsätter att titta på detta men tills vidare måste alltså ni som användare av Fass webtjänst se till att korrekt information presenteras med hänvisning till ovanstående kombination av svar!
					*/

					output.benefit = product.find("product-info > benefit").text();
					/*
					Förmånsbegränsning, Värden: 0 = ingen förp. ingår i förmånen, 1 = alla förp. ingår i förmånen, 2 vissa förp. ingår i förmånen, 3 förmån med begränsning, 4 ingen symbol
					*/
					output.prescription = product.find("product-info > prescription").text();
					/*
					Receptbelagt -=Ospecificerad, 0=Receptfritt, 1=Receptbelagt, 2=Inskränkt förskrivning, 3=Vissa förpackningar receptbelagda, 4=Receptfritt från 2 års ålder, 5=Receptfritt från 12 års ålder, N=Ej tillämplig
					*/
					output.specRecipe = product.find("product-info > spec-recipe").text();
					//true = Särskild receptblankett krävs
					output.specRecipeText = product.find("product-info > spec-recipe-text").text();

					output.overTheCounter = product.find("product-info > OTC-type").text();
					//AD=Apoteks och daglivaruhandel, A = Apoteksbundna OTC-produkter (Over The Counter). AD är produkter där produkttypen antingen är av produkttypen TVB eller NLM eller har förpackningar med flaggan sales-restrictions=3

					output.narcoticClass = product.find("product-info > narcotic-class").text();
					//Narkotikaklass - = Ospecificerad, 0 = Ej narkotikaklassad, 1 = II - Narkotika. Substanser med högre beroendepotential och liten terapeutisk användning, 2 = Narkotika förteckning IV/V, 3 = III - Narkotika. Beredning innehållande dessa är narkotika under vissa förutsättningar, 4 = IV - Narkotika. Substanser med lägre beroendepotential och bred terapeutisk användning, 5 = V - Narkotika enbart enligt svensk lag, 6 = I - Narkotika ej förekommande i läkemedel, NA = Ej tillämplig

					output.narcoticClassTextCaution = product.find("product-info > narcotic-class-text-caution").text();
					output.narcoticClassTextHabituation = product.find("product-info > narcotic-class-text-habituation").text();

					//http://dtd.fass.se/schemas/ws-schemas/common/extra-product-info.xsd

					var substances = [];
					product.find("substance > display-substance-name").each(function(index, element) {
						substances.push($(element).text());
					});
					output.substance = substances.join(" / ");
					output.atcCode = product.find("atc-code").text();
					//output.atcLink = "http://www.fass.se/LIF/produktfakta/sok_lakemedel.jsp?DocTypeID=4&expanded=" + getExpandedATCCode(output.atcCode);

					var body = $("document > body");

					var sections = {};

					sections["Information"] = formatSection($("end-notes", body));

					var benefits = formatSection($("benefit-text", body)).trim();

					if (benefits !== "") {
						sections["Förmånsbegränsningar"] = benefits;
					}

					sections["Indikationer"] = formatSection($("indication", body));
					sections["Kontraindikationer"] = formatSection($("contraindication", body));
					sections["Dosering"] = formatSection($("dosage", body));
					sections["Varningar och försiktighet"] = formatSection($("caution", body));
					sections["Interaktioner"] = formatSection($("interaction", body));
					sections["Graviditet"] = "<p>Kategori " + $("pregnancy", body).attr("category") + "</p>" + formatSection($("pregnancy", body));
					sections["Amning"] = "<p>Grupp " + $("breastfeeding", body).attr("group") + "</p>" + formatSection($("breastfeeding", body));
					sections["Trafik"] = formatSection($("driving", body));
					sections["Biverkningar"] = formatSection($("side-effects", body));
					sections["Överdosering"] = formatSection($("overdosage", body));
					sections["Farmakodynamik"] = formatSection($("pharmacodynamic", body));
					sections["Farmakokinetik"] = formatSection($("pharmacokinetic", body));
					sections["Prekliniska uppgifter"] = formatSection($("preclinical-info", body));
					sections["Innehåll"] = formatSection($("composition", body));
					sections["Blandbarhet"] = formatSection($("incompatibility", body));

					var environmentalInfos = "";
					$("environmental-infos > environmental-info", body).each(function(i, e) {

						var substanceName = formatSection($("substance-name", $(e)));
						if (substanceName !== "") { environmentalInfos += "<h3>" + substanceName + "</h3>\n" };

						var level1 = formatSection($("level-1", $(e)));
						if (level1 !== "") { environmentalInfos += "<p>Miljörisk: " + level1 + "</p>\n" };

						var degeneration = formatSection($("degeneration", $(e)));
						if (degeneration !== "") { environmentalInfos += "<p>Nedbrytning: " + degeneration + "</p>\n" };

						var bioack = formatSection($("bioack", $(e)));
						if (bioack !== "") { environmentalInfos += "<p>Bioackumulering: " + bioack + "</p>\n" };

						var pbt = formatSection($("pbt", $(e)));
						if (pbt !== "") { environmentalInfos += "<p><strong>I enlighet med EU:s fastställda kriterier ska substansen betraktas som en PBT/vPvB-substans.</strong></p>\n"; }

					});
					if (environmentalInfos !== "") {
						sections["Miljöpåverkan"] = environmentalInfos;
					}

					sections["Hantering, hållbarhet och förvaring"] = formatSection($("handling-life-shelf-storage", body));

					var propertiesMedicine = formatSection($("properties-medicine", body));
					if (propertiesMedicine !== "") {
						sections["Egenskaper hos läkemedelsformen"] = propertiesMedicine;
					}

					sections["Förpackningsinformation"] = formatSection($("price-text", body));

					output.sections = sections;

					callback(null, output);

				});
			}
		});
	}

}

function createCheckSum(data) {
	var checksum = crypto.createHash("sha1");
	checksum.update(data);
	return checksum.digest("hex");
}

/*
function getExpandedATCCode(atc) {
	//N02BE01 -> N_N02_N02B_N02BE_N02BE01#N02BE01
	var expanded = atc.substr(0,1) + "_" + atc.substr(0,3) + "_" + atc.substr(0,4) + "_" + atc.substr(0,5) + "_" + atc.substr(0,6);
	return expanded;
}
*/
function formatSection(section) {

	var $ = cheerio;

	//replace links
	$("newslink", section).remove();

	//turn to string
	section = section.html();

	if (section !== null) {
		//turn xml into html
		section = section.trim();
		section = section.replace(/\<paragraph\/\>/g, "");
		section = section.replace(/\<very-common\/\>/g, "");
		section = section.replace(/\<very-common\>\<\/very-common\>/g, "");

		section = section.replace(/\<very-common\>/g, "<table class=\"table\"><tbody><tr><td style=\"width: 150px;\">Mycket vanliga <br>(≥1/10)</td><td>");
		section = section.replace(/\<\/very-common\>/g, "</td></tr></tbody></table>");

		section = section.replace(/\<common\/\>/g, "");
		section = section.replace(/\<common\>\<\/common\>/g, "");

		section = section.replace(/\<common\>/g, "<table class=\"table\"><tbody><tr><td style=\"width: 150px;\">Vanliga <br>(≥1/100, <1/10)</td><td>");
		section = section.replace(/\<\/common\>/g, "</td></tr></tbody></table>");

		section = section.replace(/\<less-common\/\>/g, "");
		section = section.replace(/\<less-common\>\<\/less-common\>/g, "");

		section = section.replace(/\<less-common\>/g, "<table class=\"table\"><tbody><tr><td style=\"width: 150px;\">Mindre vanliga <br>(≥1/1 000, <1/100)</td><td>");
		section = section.replace(/\<\/less-common\>/g, "</td></tr></tbody></table>");

		section = section.replace(/\<rare\/\>/g, "");
		section = section.replace(/\<rare\>\<\/rare\>/g, "");

		section = section.replace(/\<rare\>/g, "<table class=\"table\"><tbody><tr><td style=\"width: 150px;\">Sällsynta <br>(≥1/10 000, <1/1 000)</td><td>");
		section = section.replace(/\<\/rare\>/g, "</td></tr></tbody></table>");

		section = section.replace(/\<very-rare\/\>/g, "");
		section = section.replace(/\<very-rare\>\<\/very-rare\>/g, "");

		section = section.replace(/\<very-rare\>/g, "<table class=\"table\"><tbody><tr><td style=\"width: 150px;\">Mycket sällsynta <br>(<1/10 000)</td><td>");
		section = section.replace(/\<\/very-rare\>/g, "</td></tr></tbody></table>");

		section = section.replace(/\<clickable\/\>/g, "");
		section = section.replace(/\<clickable\>/g, "");


		section = section.replace(/\<paragraph\>/g, "<p>");
		section = section.replace(/\<\/paragraph\>/g, "</p>");

		section = section.replace(/\<list class=\"list-unordered\"\>/g, "<ul>");
		section = section.replace(/\<\/list\>/g, "</ul>");

		section = section.replace(/\<list class=\"list-ordered\"\>/g, "<ul>");
		section = section.replace(/\<\/list\>/g, "</ul>");

		section = section.replace(/\<listitem\>/g, "<li>");
		section = section.replace(/\<\/listitem\>/g, "</li>");
		section = section.replace(/\<clickable\>/g, "");
		section = section.replace(/\<\/clickable\>/g, "");
		section = section.replace(/\<italic\>/g, "<em>");
		section = section.replace(/\<\/italic\>/g, "</em>");
		section = section.replace(/\<bold\>/g, "<strong>");
		section = section.replace(/\<\/bold\>/g, "</strong>");
		section = section.replace(/\<capitals\>/g, "<span style='text-transform: capitalize;'>");
		section = section.replace(/\<\/capitals\>/g, "</span>");
		section = section.replace(/\<superscript\>/g, "<sup>");
		section = section.replace(/\<\/superscript\>/g, "</sup>");
		section = section.replace(/\<subscript\>/g, "<sub>");
		section = section.replace(/\<\/subscript\>/g, "</sub>");

		section = section.replace(/\<image\s/g, "<img style=\"max-width:100%;\" ");
		section = section.replace(/\<\/image\>/g, "");
		section = section.replace(/fileref\=\"\//g, "src=\"http://www.fass.se/");
		section = section.replace(/fileref\=\"/g, "src=\"");

	} else {
		section = "";
	}

	return section;
}

function getImageData(nplId, callback) {

	auth.login(fassUsername, fassPassword)
	.then(function (ticket) {
		var options = {
			url: 'https://www.fass.se/rest/fia/tabletinfo?version=1.0&nplId='+nplId,
			headers: {
				'ticket': ticket
			}
		};

		request(options, function (error, response, data) {
			var images = [];

			var $ = cheerio.load("<html><body>" + data + "</body></html>");

			$("items").each(function(index, item) {

				item = $(item);
				var image = {};

				image.description = $(item).find("description").first().html();

				var base64ImageData = $(item).find("photo").first().html();

				if (base64ImageData !== undefined && base64ImageData !== null && base64ImageData !== "") {
					//console.log("Creating checksum for " + base64ImageData.length + " characters..");
					//Create checksum, use for filename
					var checksum = crypto.createHash("sha1");
					checksum.update(base64ImageData);
					var imageChecksum = checksum.digest("hex");
					image.checksum = imageChecksum;
					//console.log("Checksum was: " + imageChecksum);
					var newFilePath = __dirname + "/www/products/images/" + image.checksum + ".jpg"
					fs.writeFileSync(newFilePath, new Buffer(base64ImageData, "base64"));
					images.push(image);
				} else {
					images.push(image);
				}
			});

			callback(null, images)

		}).on('error', function (e) {

		});
	})
	.fail(function (error) {
		console.log(error.message);
	});
}

function formatDate(time) {
	var month = (time.getMonth() + 1).toString();
	if (month.length === 1) {
		month = "0" + month;
	}
	var days = time.getDate().toString();
	if (days.length === 1) {
		days = "0" + days;
	}
	var hours = time.getHours().toString();
	if (hours.length === 1) {
		hours = "0" + hours;
	}
	var minutes = time.getMinutes().toString();
	if (minutes.length === 1) {
		minutes = "0" + minutes;
	}
	var seconds = time.getSeconds().toString();
	if (seconds.length === 1) {
		seconds = "0" + seconds;
	}

	var newTime = time.getFullYear() + "-" + month + "-" + days + " " + hours + ":" + minutes + ":" + seconds ;
	return newTime;
}

function getSPC(name, nplId, callback) {

	var alreadyFetched = false;
/*
	if (fs.existsSync(__dirname + "/products/" + nplId + ".json")) {
		var produ = JSON.parse(fs.readFileSync(__dirname + "/products/" + nplId + ".json", "utf8"));
		if (produ.spcLink !== undefined) {
			//No need to go and fetch
			alreadyFetched = true;
			setTimeout(function() {
				callback(null, produ.spcLink);
			}, 1);
		}
	}
*/
	if (!alreadyFetched) {
		_getMpaSPC(name, nplId, function(err, data) {
			if (err) {
				return callback(err);
			}

			if (!data.isCentral) {
				callback(null, data.spcLink)
			} else {
				_getCentralSPC(name, nplId, function(err, spcLink) {
					if (err) {
						return callback(err);
					} else {
						console.log("Found SPC link from EMA: " + spcLink);
						callback(null, spcLink);
					}
				});
			}
		});
	}
}

function _getMpaSPC(name, nplId, callback) {

	console.log("Searching MPA for: " + name);

	var spcLink = "";
	var isCentral = true;
	var error = null;

	if (fs.existsSync(__dirname + "/../npl/products/" + nplId + ".json")) {
		var product = JSON.parse(fs.readFileSync(__dirname + "/../npl/products/" + nplId + ".json", "utf8"));
		if (product.spcLink !== undefined &&  product.spcLink !== "") {
			spcLink = product.spcLink;
			isCentral = false;
			console.log("Found SPC link from MPA: " + spcLink);
		}
	}
	callback(error, {isCentral: isCentral, spcLink: spcLink});

/*

	request("http://www.lakemedelsverket.se/LMF/Lakemedelsinformation/?nplid=" + nplId + "&type=product", function (err, response, body) {

		var spcLink = "";
		var isCentral = false;
		var error = null;

		if (!err && response.statusCode == 200) {
			if (body.indexOf("Detta läkemedel är centralt godkänt") > -1) {
				isCentral = true;
			}

			if (!isCentral) {
				var $ = cheerio.load(body);
				var links = $("div.docLink a");

				links.each(function(index, element) {
					if ($(element).attr("href").indexOf("SmPC") > -1) {
						spcLink = $(element).attr("href");
					} else {
						//console.log($(element).attr("href"));
					}
				});
			}

		} else {
			error = new Error("Error loading docs: http://www.lakemedelsverket.se/LMF/Lakemedelsinformation/?nplid=" + nplId + "&type=product");
		}

		callback(error, {isCentral: isCentral, spcLink: spcLink});

	});

*/
}

//var finishedCentralSPCs = {};

function _getCentralSPC(name, nplId, callback) {

	var searchName = name.replace("®", "").toLowerCase();
	if (searchName.indexOf("(") > -1) {
		searchName = searchName.substr(0, searchName.indexOf("("));
	}

	if (searchName.indexOf(" ") > -1) {
		searchName = searchName.substr(0, searchName.indexOf(" "));
	}
	/*
	if (finishedCentralSPCs[searchName] !== undefined) {
		return callback(null, finishedCentralSPCs[searchName]);
	}
	*/
	//Get search results
	console.log("Searching EMA for: " + searchName);
	request("http://www.ema.europa.eu/ema/index.jsp?curl=pages%2Fmedicines%2Flanding%2Fepar_search.jsp&mid=WC0b01ac058001d125&searchTab=searchByKey&alreadyLoaded=true&isNewQuery=true&status=Authorised&status=Withdrawn&status=Suspended&status=Refused&keyword=" + encodeURIComponent(searchName) + "&keywordSearch=Submit&searchType=name&taxonomyPath=&treeNumber=&searchGenericType=generics", function (err, response, body) {
		if (!err && response.statusCode == 200) {
			var $ = cheerio.load(body);
			var links = $("div#searchResults").find("th.name").find("a");
			var possibleLinks = [];

			links.each(function(index, element) {
				var link = $(element);
				possibleLinks.push({name: link.text().trim().toLowerCase(), href: "http://www.ema.europa.eu/ema/" + link.attr("href")});
			});

			if (possibleLinks.length > 1) {
				var filteredLinks = possibleLinks.filter(function(link) {
					return (link.name === searchName)
				});

				if (filteredLinks.length === 0 || filteredLinks.length > 1) {
					filteredLinks = [possibleLinks[0]];
				}
				possibleLinks = filteredLinks;
			}

			if (possibleLinks.length === 1) {
				//console.log("Link for: " + searchName);
				//Pursue, get specific page for product
				request(possibleLinks[0].href, function (err2, response2, body2) {
					if (!err2 && response2.statusCode == 200) {

						var $d = cheerio.load(body2);

						var pdfLink = $d("a.pdf").filter(function(index) {
							return (($d(this).text().indexOf("EPAR - Product Information") > -1) && ($d(this).attr("href").indexOf("sv_SE") > -1));
						});

						if (pdfLink.length === 1) {
							//console.log("Found SPC: " + spcLink);
							var spcLink = "http://www.ema.europa.eu" + pdfLink.attr("href");
							//finishedCentralSPCs[searchName] = spcLink;
							callback(null, spcLink);
						} else {
							callback(new Error("Multiple links for " + searchName + " " + pdfLink.length));
						}

					} else {
						callback(err2);
					}

				});
			} else if (possibleLinks.length === 0) {
				callback(new Error("No links for: " + searchName));
			} else {
				callback(new Error("Multiple links for: " + searchName + "\n"));
			}
		} else {
			callback(new Error("Error fetching from EMA:" + searchName));
		}
	});
}

function sendMail(subject, text) {

	var plainMail = text;

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
		subject: "[BOT] " + subject,
		text: plainMail
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
