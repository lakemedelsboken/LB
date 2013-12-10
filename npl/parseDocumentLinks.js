var fs = require("fs");
var XmlStream = require("xml-stream");
var path = require("path");

var products = {};

function readDocumentLinks(callback) {

	console.log("Reading document links...");

	var stream = fs.createReadStream(path.join(__dirname, '/database/LMFDocuments.xml'));
	var xml = new XmlStream(stream);
	
	xml.on('updateElement: DocumentList', function(item) {

		if (item["Typ"] === "SmPC") {
			//Found product resumé
			
			if (products[item["NplId"]] === undefined) {
				products[item["NplId"]] = [item];
			} else {
				products[item["NplId"]].push(item);
			}
			
		}
//		console.log(item);
//		console.log("");
		
//		var id = item.$.id;
//		var name = item["npl:orgname"].replace("MAH Saknas.", "").replace("MAHSaknas.", "").replace(" (Sponsor)", "").replace(" (Tillverkare)", "").trim();
		
//		organizations[id] = name;
	});
	
	xml.on("end", function() {
		console.log("Found documents for " + Object.keys(products).length + " products.");
		callback();
	});
}

readDocumentLinks(function(err, data) {

	var enCounter = 0;
	var svCounter = 0;
	//Save spcLinks
	for (var nplId in products) {
		var sv = null;
		var en = null;
		
		for (var i = 0; i < products[nplId].length; i++) {
			if (products[nplId][i]["Språk"] === "Svensk") {
				sv = products[nplId][i]["DokumentLänk"];
			} else if (products[nplId][i]["Språk"] === "Engelsk") {
				en = products[nplId][i]["DokumentLänk"];
			} else {
				console.log("Unknown language for: ", products[nplId][i]);
				console.log("");
			}
		}
		
		if (sv) {
			updateSPCLink(nplId, sv);
			svCounter++;
		} else if (en) {
			updateSPCLink(nplId, en);
			enCounter++;
		} else {
			console.log("Could not find link for: ", products[nplId]);
		}
		
	}
	
	console.log("Found " + svCounter + " swedish SPC:s");
	console.log("Found " + enCounter + " english SPC:s");
	
	console.log("Done");
});

function updateSPCLink(nplId, linkPath) {
	
	var productPath = __dirname + "/products/" + nplId + ".json";
	
	if (fs.existsSync(productPath)) {
		var product = JSON.parse(fs.readFileSync(productPath, "utf8"));
		product.spcLink = linkPath;
		fs.writeFileSync(productPath, JSON.stringify(product, null, "\t"), "utf8");
	} else {
		//console.log("Could not find product json for: " + productPath);
	}
	
	productPath = path.normalize(__dirname + "/../fass/www/products/" + nplId + ".json");

	if (fs.existsSync(productPath)) {
		var product = JSON.parse(fs.readFileSync(productPath, "utf8"));
		product.spcLink = linkPath;
		fs.writeFileSync(productPath, JSON.stringify(product, null, "\t"), "utf8");
	} else {
		//console.log("Could not find product json for: " + productPath);
	}

}