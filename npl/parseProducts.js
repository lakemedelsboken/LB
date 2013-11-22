var fs = require("fs");
var XmlStream = require("xml-stream");
var path = require("path");
var request = require("request");
var cheerio = require("cheerio");

var organizations = {};

function readOrganizations(callback) {

	console.log("Reading organizations...");

	var stream = fs.createReadStream(path.join(__dirname, '/database/organization.xml'));
	var xml = new XmlStream(stream);
	
	xml.on('updateElement: npl:organization', function(item) {
		var id = item.$.id;
		var name = item["npl:orgname"].replace("MAH Saknas.", "").replace("MAHSaknas.", "").replace(" (Sponsor)", "").replace(" (Tillverkare)", "").trim();
		
		organizations[id] = name;
		
//		console.log(id + " " + name);
	});
	
	xml.on("end", function() {
		console.log("Read " + Object.keys(organizations).length + " organizations.");
		callback();
	});
}

readOrganizations(function() {
	readProducts();
});

function readProducts() {

	console.log("Reading products...")

	var stream = fs.createReadStream(path.join(__dirname, '/database/NplProducts.xml'));
	var xml = new XmlStream(stream);

	xml.preserve("npl:names", true);
	xml.preserve("npl:flags", true);

	var atcItems = {};
	var atcTree = JSON.parse(fs.readFileSync(__dirname + "/atcTree.json", "utf8"));
	for (var i = 0; i < atcTree.length; i++) {
		if (atcTree[i].type === "atc") {
			atcItems[atcTree[i].id] = true;
		}
	}

	//console.log(atcTree.length);
	//console.log(Object.keys(atcItems).length);

	var availableCounter = 0;
	var totalCounter = 0;
	var missingInfoCounter = 0;

	xml.on('updateElement: npl:medprod', function(item) {

		totalCounter++;
		if ((totalCounter % 100) === 0) {
			console.log(availableCounter + " of " + totalCounter + ", " + missingInfoCounter + " items with missing info");
		}

		//console.log(item["npl:classifications"]["mpa:atc-code-lx"].$.v);

		var atcCode = item["npl:classifications"]["mpa:atc-code-lx"].$.v;
		
		if (atcCode !== undefined && atcCode.length < 5) {
			//console.log(atcCode);
		}

		if (atcCode === undefined) {
//			console.log(JSON.stringify(item, null, "\t"));
		}

		if (atcCode !== undefined && atcItems[atcCode] !== undefined) {

			//Availability
			var available = false;
			var flags = item["npl:flags"].$children;
			for (var i = 0; i < flags.length; i++) {
				var f = flags[i];
				if (f.$.type === "available") {
					available = (f.$.v === "Y");
					break;
				}
			}
			//console.log(available);

			//NplId
			var nplId = item["npl:identifiers"]["mpa:identifier"].$.v;

			if (nplId !== undefined) {

				//Check if product exists in fass listings
				if (!fs.existsSync(__dirname + "/../fass/www/products/" + nplId + ".json")) {
					var foundUpdates = JSON.parse(fs.readFileSync(__dirname + "/../fass/foundUpdates.json", "utf8"));
					var alreadyInList = false;
					
					for (var i = 0; i < foundUpdates.length; i++) {
						if (foundUpdates[i] === nplId) {
							alreadyInList = true;
							break;
						}
					}
					if (!alreadyInList) {
						console.log(nplId + " is added to foundUpdates.json");
						foundUpdates.push(nplId);
						fs.writeFileSync(__dirname + "/../fass/foundUpdates.json", JSON.stringify(foundUpdates, null, "\t"), "utf8");
					}
				}

				//Name
				var name = "";
				var names = item["npl:names"].$children;
				for (var i = 0; i < names.length; i++) {
					var n = names[i];
					if (n.$.type === "tradename") {
						name = n.$.v;
						break;
					}
				}
				//console.log(name);

				//Brand
				var brand = item["npl:organizations"]["mpa:organization"]["mpa:organization-lx"].$.v;
				if (brand !== undefined) {
					brand = organizations[brand];
					//console.log(brand);
				} else {
					brand = "";
					console.log("Unknown brand for " + name);
				}

				//Info available
				var hasInfo = false;
				if (fs.existsSync(__dirname + "/../fass/www/products/" + nplId + ".json")) {
					hasInfo = true;
				}
			
				//if (!hasInfo) {
					//console.log(name + ", " + atcCode);

					xml.pause();

					getSPC(name, nplId, function(err, spcLink) {


						if (err) {
							console.error(err);
							spcLink = "";
						}

						if (spcLink !== "") {
							//console.log(spcLink);
						}

						var product = {
							"id": nplId,
							"name": name,
							"brand": brand,
							"atcCode": atcCode,
							"spcLink": spcLink,
							"available": available
							//"item": item
						}
				
						if (spcLink !== "") {
							if (fs.existsSync(__dirname + "/../fass/www/products/" + nplId + ".json")) {
								var prod = JSON.parse(fs.readFileSync(__dirname + "/../fass/www/products/" + nplId + ".json", "utf8"));
								prod.spcLink = spcLink;
								fs.writeFileSync(__dirname + "/../fass/www/products/" + nplId + ".json", JSON.stringify(prod, null, "\t"), "utf8");
							}
						}
				
						fs.writeFileSync(__dirname + "/products/" + nplId + ".json", JSON.stringify(product, null, "\t"), "utf8");
						missingInfoCounter++;
						
						xml.resume();

					});

					//}
			
				availableCounter++;
			}
		} 
	});

	xml.on("end", function() {
		console.log(availableCounter + " products");
	});
	
}

function getSPC(name, nplId, callback) {

	var alreadyFetched = false;
	
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
}

var finishedCentralSPCs = {};

function _getCentralSPC(name, nplId, callback) {
	
	var searchName = name.replace("®", "").toLowerCase();
	if (searchName.indexOf("(") > -1) {
		searchName = searchName.substr(0, searchName.indexOf("("));
	}

	if (searchName.indexOf(" ") > -1) {
		searchName = searchName.substr(0, searchName.indexOf(" "));
	}

	if (finishedCentralSPCs[searchName] !== undefined) {
		return callback(null, finishedCentralSPCs[searchName]);
	}
	
	//Get search results
	console.log("Searching EMEA for: " + searchName);
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
							finishedCentralSPCs[searchName] = spcLink;
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
