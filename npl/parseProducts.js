var fs = require("fs");
var XmlStream = require("xml-stream");
var path = require("path");
var request = require("request");
var cheerio = require("cheerio");

var existingNplIds = {};

var productFiles = fs.readdirSync(__dirname + "/../fass/www/products/");

for (var i = 0; i < productFiles.length; i++) {
	if (productFiles[i].indexOf(".json") > -1) {
		existingNplIds[productFiles[i].replace(".json", "")] = true;
	}
}

var organizations = {};

function readOrganizations(callback) {

	console.log("Reading organizations...");

	var stream = fs.createReadStream(path.join(__dirname, '/database/organization.xml'));
	var xml = new XmlStream(stream);
	
	xml.on('updateElement: npl:organization', function(item) {
		var id = item.$.id;
		var name = item["npl:orgname"].replace("MAH Saknas.", "").replace("MAHSaknas.", "").replace(" (Sponsor)", "").replace(" (Tillverkare)", "").trim();
		
		organizations[id] = name;
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
	var atcTree = JSON.parse(fs.readFileSync(__dirname + "/newAtcTree.json", "utf8"));
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
		if ((totalCounter % 1000) === 0) {
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
				if (existingNplIds[nplId] === undefined) {

					missingInfoCounter++;

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

				var spcLink = "";

				var product = {
					"id": nplId,
					"name": name,
					"brand": brand,
					"atcCode": atcCode,
					"spcLink": spcLink,
					"available": available
				}
			
				availableCounter++;
			}
		} 
	});

	xml.on("end", function() {
		console.log(availableCounter + " products");
	});
	
}
