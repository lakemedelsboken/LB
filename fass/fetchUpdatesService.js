var fs = require("fs");
var urlParser = require("url");
var http = require("http");
var async = require("async");
var path = require("path");
var cheerio = require("cheerio");
var crypto = require("crypto");
var request = require("request");
var nodemailer = require("nodemailer");

var baseUrl = "http://www.fass.se/LIF/FassDocumentWebService?WSDL";

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

var chokidar = require("chokidar");
var watcher = chokidar.watch(path.normalize(__dirname + "/shared/foundUpdates.json"), {persistent: true, ignoreInitial: true, interval:1});

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
		console.log("Fetch queue is empty.");
		isUpdating = false;
	}
}

//Run at start
fetchUpdates();

function check(updates) {

	console.log(formatDate(new Date()) + " Fetching " + updates.join(", ") + "...")

	var q = async.queue(function (task, callback) {

		var productInfoEnvelope = "<env:Envelope xmlns:env=\"http://schemas.xmlsoap.org/soap/envelope/\"><env:Header /><env:Body><getXmlDocumentByNplIdElement xmlns=\"http://webservice.usersys.fass.lif.se/\"><nplId>{NPLID}</nplId><userId>{USERID}</userId></getXmlDocumentByNplIdElement></env:Body></env:Envelope>";
		productInfoEnvelope = productInfoEnvelope.replace("{NPLID}", task.nplId).replace("{USERID}", fassUserId);

		//Send request
		requestSoapData(task.url, productInfoEnvelope, function(err, answer) {
			if (err) {
				//console.log(err);
				callback(err);
			} else {
				processAnswer(answer, task.nplId, function(err, data) {

					if (err && (err.message.indexOf("Error fetching") > -1 || err.message.indexOf("Unexpected error") > -1)) { 
						callback(err);
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
							callback(err);
						} else {
							callback(new Error("Id was undefined"));
						}
					}
				});
			}
		});

	}, 1);

	//Add to queue
	for (var i = 0; i < updates.length; i++) {

		q.push({url: baseUrl, nplId: updates[i]}, function(err, id, name) {
			if (err) {
				console.log("Error with id: " + id);
				console.log(err);
				
				if (errors[id] !== undefined) {
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
				
				//TODO: Move id to last of queue (first in array)
				//Implement retries, max 5 for one id, then save to error log and mail
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
	}
	
	//When queue is done
	q.drain = function() {

		//console.log("Queue is done for now");
		isUpdating = false;
		fetchUpdates();

	}

}

function moveToLast(nplId) {

	var foundUpdates = JSON.parse(fs.readFileSync(__dirname + "/shared/foundUpdates.json", "utf8"));

	for (var i = foundUpdates.length - 1; i >= 1; i--) {
		if (foundUpdates[i] === nplId && i > 0) {
			//console.log("Removing " + nplId);
			foundUpdates.splice(i, 1);
		}
	}

	//Insert as second item
	foundUpdates.splice(1, 0, nplId);

	fs.writeFileSync(__dirname + "/shared/foundUpdates.json", JSON.stringify(foundUpdates, null, "\t"), "utf8");
	
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
	fs.writeFileSync(__dirname + "/shared/foundUpdates.json", JSON.stringify(foundUpdates, null, "\t"), "utf8");
	
}

function getNoInfo(nplId) {
	var noinfo = {noinfo: true, id: nplId};
	if (fs.existsSync(__dirname + "/../npl/products/" + nplId + ".json")) {
		var nplProduct = JSON.parse(fs.readFileSync(__dirname + "/../npl/products/" + nplId + ".json", "utf8"));
		noinfo.name = nplProduct.name;
		noinfo.description = nplProduct.description;
		noinfo.atcCode = nplProduct.atcCode;
		noinfo.brand = nplProduct.brand;
	}
	return noinfo;
}

function processAnswer(answer, nplId, callback) {

	if (answer.indexOf("No published FASS-document") > -1) {

		var output = getNoInfo(nplId);
		callback(new Error("No published FASS-document: " + nplId), output);

		
	} else if (answer.indexOf("Product is not active") > -1) {

		var output = getNoInfo(nplId);
		callback(new Error("Product is not active: " + nplId), output);
		
	} else if (answer.indexOf("Unable to find document for nplId = ") > -1) {

		var output = getNoInfo(nplId);
		callback(new Error("Unable to find document for nplId = " + nplId), output);
		
	} else if (answer.indexOf("Unexpected error") > -1) {

		var output = getNoInfo(nplId);
		callback(new Error("Unexpected error for nplId = " + nplId), output);
		
	} else {

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
		
		console.log(answer);
	
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

	var productInfoEnvelope = "<env:Envelope xmlns:env=\"http://schemas.xmlsoap.org/soap/envelope/\"><env:Header /><env:Body><getTabletInfoByProductIdElement xmlns=\"http://webservice.usersys.fass.lif.se/\"><nplId>{NPLID}</nplId><userId>{USERID}</userId></getTabletInfoByProductIdElement></env:Body></env:Envelope>";
	productInfoEnvelope = productInfoEnvelope.replace("{NPLID}", nplId).replace("{USERID}", fassUserId);

	requestSoapData("http://www.fass.se/LIF/FIAWebService2?WSDL", productInfoEnvelope, function(err, data) {
		if (err) {
			callback(err);
		} else {
			//Clean data
			data = data.replace(/ns0\:/g, "");
			data = data.replace(/ns1\:/g, "");
			data = data.replace(/ns2\:/g, "");
			data = data.replace(/ns3\:/g, "");
			data = data.replace(/ns4\:/g, "");
			data = data.replace(/ns5\:/g, "");

			var images = [];

			var $ = cheerio.load("<html><body>" + data + "</body></html>");

			$("items").each(function(index, item) {
			
				item = $(item);
				var image = {};

				image.description = $("description", item).html();

				var base64ImageData = $("photo", item).html();

				if (base64ImageData !== undefined && base64ImageData !== null && base64ImageData !== "") {
					//Create checksum, use for filename
					var checksum = crypto.createHash("sha1");
					checksum.update(base64ImageData);
					var imageChecksum = checksum.digest("hex");
					image.checksum = imageChecksum;
					var newFilePath = __dirname + "/www/products/images/" + image.checksum + ".jpg"
					fs.writeFileSync(newFilePath, new Buffer(base64ImageData, "base64"));
					images.push(image);
				} else {
					images.push(image);
				}
			});

			callback(null, images);
		}
	});
}

function requestSoapData(url, xmlDoc, callback) {

	url = urlParser.parse(url);
	var responseXml = [];

	var options = {
	  host: url.host,
	  port: 80,
	  path: url.pathname + url.search,
	  method: 'POST',
	  headers: {"Content-Type": "text/xml"}
	};
	
	var req = http.request(options, function(res) {
		res.on('data', function (chunk) {
			responseXml.push(chunk);
		});
		res.on("end", function() {
			req = null;
			res = null;
			//Success
			callback(null, responseXml.join(""));
		});
		res.on("error", function(err) {
			req = null;
			res = null;
			callback(err);
		});
	});

	req.on("error", function(err) {
	    if (err.code === "ECONNRESET") {
			callback(new Error("Timeout for: " + url + " with data: " + xmlDoc));
	    } else {
	    	callback(err);
	    }
	});	

	req.write(xmlDoc);
	req.end();	
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
					}

					callback(null, spcLink);
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
			console.log("Found link: " + spcLink);
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
			callback(new Error("Error fetching from EMEA:" + searchName));
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