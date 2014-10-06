var fs = require("fs");
var XmlStream = require("xml-stream");
var path = require("path");

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

var pharmForms = {};

function readPharmForms(callback) {

	console.log("Reading pharmaceutical forms...");

	var stream = fs.createReadStream(path.join(__dirname, '/database/pharmaceutical-form-lx.xsd'));
	var xml = new XmlStream(stream);
	
	xml.preserve("xs:enumeration", true);
	
	xml.on('updateElement: xs:enumeration', function(item) {
		var id = item.$.value;

		var n = item["xs:annotation"].$children.filter(function(e) {
			return (e.$["xml:lang"] === "sv");
		});

		var name = "";
		
		if (n.length > 0) {
			name = n[0].$text
		}
		
		pharmForms[id] = name;
	});
	
	xml.on("end", function() {
		console.log("Read " + Object.keys(pharmForms).length + " pharmaceutical forms.");
		callback();
	});
}

var controlClasses = {};

function readControlClasses(callback) {

	console.log("Reading control classes...");

	var stream = fs.createReadStream(path.join(__dirname, '/database/control-class-lx.xsd'));
	var xml = new XmlStream(stream);
	
	xml.preserve("xs:enumeration", true);
	
	xml.on('updateElement: xs:enumeration', function(item) {
		var id = item.$.value;

		var n = item["xs:annotation"].$children.filter(function(e) {
			return (e.$["xml:lang"] === "sv");
		});

		var name = "";
		
		if (n.length > 0) {
			name = n[0].$text
		}
		
		controlClasses["c_" + id] = name;
	});
	
	xml.on("end", function() {
		console.log("Read " + Object.keys(controlClasses).length + " control classes.");
		callback();
	});
}


readOrganizations(function() {
	readPharmForms(function() {
		readControlClasses(function() {
			readProducts();
		});
	});
});

function readProducts() {

	console.log("Reading products...")

	var stream = fs.createReadStream(path.join(__dirname, '/database/NplProducts.xml'));
	var xml = new XmlStream(stream);

	xml.preserve("npl:names", true);
	xml.preserve("npl:identifiers", true);
	xml.preserve("npl:flags", true);
	xml.preserve("npl:classifications", true);
	xml.preserve("mpa:identifier", true);

	xml.collect("npl:presentation", true);
	xml.collect("lfn:price", true);
	xml.collect("npl:price", true);
	xml.collect("ind:price", true);
	

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
			//fs.writeFileSync(__dirname + "/_old/" + totalCounter + ".json", JSON.stringify(item, null, "\t"), "utf8");
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

			if (nplId === undefined) {
				//console.log(item["npl:identifiers"].$children);
				for (var i = 0; i < item["npl:identifiers"].$children.length; i++) {
					var n = item["npl:identifiers"].$children[i];
					if (n.$.type === "nplid") {
						nplId = n.$.v;
						break;
					}
				}

				//console.log("");
				//fs.writeFileSync(__dirname + "/_old/" + atcCode + ".json", JSON.stringify(item, null, "\t"), "utf8");
				//nplId = item["npl:identifiers"]["mpa:pack-identifier"].$.v;
			}
			
			if (nplId === undefined) {
				console.log(item["npl:identifiers"].$children);
				console.log("");
			}

			if (nplId !== undefined) {

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
				var brand = undefined;
				
				if (item["npl:organizations"] && item["npl:organizations"]["mpa:organization"] && item["npl:organizations"]["mpa:organization"]["mpa:organization-lx"]) {
					brand = item["npl:organizations"]["mpa:organization"]["mpa:organization-lx"].$.v;
				}
				if (brand !== undefined) {
					brand = organizations[brand];
					//console.log(brand);
				} else {
					brand = "";
					console.log("Unknown brand for " + name + ", " + nplId);
				}

				//Form
				var form = undefined;
				if (item["mpa:pharmaceutical-form-lx"]) {
					form = item["mpa:pharmaceutical-form-lx"].$.v;
				}
				
				if (form !== undefined && pharmForms[form] !== undefined) {
					form = pharmForms[form];
				} else {
					form = "";
				}
				
				//Strength
				var strength = undefined;
				if (item["ind:strength-text"] && item["ind:strength-text"]["ind:v"]) {
					strength = item["ind:strength-text"]["ind:v"];
				} else {
					strength = "";
				}
				var description = (form + " " + strength).trim();


				//Narcotics
				var narcoticClass = "";
				var narcoticClassTextCaution = "";
				var narcoticClassTextHabituation = "";
				var isNarcotic = false;
				
				if (item["npl:classifications"] && item["npl:classifications"]["mpa:control-class-lx"] && item["npl:classifications"]["mpa:control-class-lx"]["$"] && item["npl:classifications"]["mpa:control-class-lx"]["$"]["v"]) {
					narcoticClass = item["npl:classifications"]["mpa:control-class-lx"]["$"]["v"]
					if (narcoticClass === "1" || narcoticClass === "2" || narcoticClass === "3" || narcoticClass === "4" || narcoticClass === "5") {
						narcoticClassTextCaution = "Iakttag största försiktighet vid förskrivning av detta läkemedel.";
						narcoticClassTextHabituation = "Beroendeframkallande medel.";
						isNarcotic = true;
					}
				}

				//Packaging
				var packaging = "";
				if (item["npl:medprodpack"] && item["npl:medprodpack"]["npl:presentation"]) {
					
					var presentation = item["npl:medprodpack"]["npl:presentation"];
					if (presentation.length > 0) {
						presentation = presentation[0];
						
						if (presentation["mpa:package-text"] && presentation["mpa:package-text"]["mpa:v"]) {
							packaging = presentation["mpa:package-text"]["mpa:v"];
						}
					}
				}

				//Availability
				var available = "";
				if (item["npl:flags"] && item["npl:flags"]["ind:flag"] && item["npl:flags"]["ind:flag"]["$"] && item["npl:flags"]["ind:flag"]["$"]["type"] === "available") {
					available = item["npl:flags"]["ind:flag"]["$"]["v"];
					
					if (available === "Y") {
						available = "true";
					} else {
						available = "false";
					}
				}

				//SPC Link
				var spcLink = undefined;
				if (fs.existsSync(__dirname + "/products/" + nplId + ".json")) {
					var product = JSON.parse(fs.readFileSync(__dirname + "/products/" + nplId + ".json", "utf8"));
					if (product.spcLink !== undefined && product.spcLink !== "") {
						spcLink = product.spcLink;
					}
				}
				
				//Check if product exists in fass listings
				if (existingNplIds[nplId] === undefined) {

					missingInfoCounter++;

					var foundUpdates = JSON.parse(fs.readFileSync(__dirname + "/../fass/shared/foundUpdates.json", "utf8"));
					var alreadyInList = false;
					
					for (var i = 0; i < foundUpdates.length; i++) {
						if (foundUpdates[i] === nplId) {
							alreadyInList = true;
							break;
						}
					}
					if (!alreadyInList) {
						console.log(nplId + " is added to shared/foundUpdates.json");
						foundUpdates.push(nplId);
						fs.writeFileSync(__dirname + "/../fass/shared/foundUpdates.json", JSON.stringify(foundUpdates, null, "\t"), "utf8");
					}
				} else {
					//Check that name and brand is set
					var product = JSON.parse(fs.readFileSync(__dirname + "/../fass/www/products/" + nplId + ".json"));
					var update = false;
					if (product.name === undefined || product.name === "") {
						product.name = name;
						update = true;
					}
					if (product.brand === undefined || product.brand === "" && brand !== undefined && brand !== "") {
						product.brand = brand;
						update = true;
					}

					if (product.atcCode === undefined || product.atcCode === "") {
						product.atcCode = atcCode;
						update = true;
					}

					if (product.strength !== strength) {
						product.strength = strength;
						update = true;
					}

					if (product.form !== form) {
						product.form = form;
						update = true;
					}

					if (product.packaging !== packaging) {
						product.packaging = packaging;
						update = true;
					}

					if (product.narcoticClass !== narcoticClass) {
						product.narcoticClass = narcoticClass;
						update = true;
					}

					if (isNarcotic) {
						if (product.narcoticClassTextHabituation !== narcoticClassTextHabituation) {
							product.narcoticClassTextHabituation = narcoticClassTextHabituation;
							update = true;
						}

						if (product.narcoticClassTextCaution !== narcoticClassTextCaution) {
							product.narcoticClassTextCaution = narcoticClassTextCaution;
							update = true;
						}
					} else {
						if (product.narcoticClassTextHabituation !== undefined) {
							delete product.narcoticClassTextHabituation;
							update = true;
						}
						
						if (product.narcoticClassTextCaution !== undefined) {
							delete product.narcoticClassTextCaution;
							update = true;
						}
					}

					if (product.available !== available) {
						product.available = available;
						update = true;
					}

					if (spcLink !== undefined && spcLink !== "" && product.spcLink !== spcLink) {
						product.spcLink = spcLink;
						update = true;
					}

					if (product.description === undefined || product.description === "" || product.description === "Saknar förskrivarinformation") {
						if (description !== "") {
							product.description = description;
							update = true;
						}
					}
					/*
					if (product.noinfo !== undefined && product.noinfo === true && product.description !== "Saknar förskrivarinformation") {
						product.description = "Saknar förskrivarinformation";
						update = true;
					}
					*/
					if (update) {
						console.log("Adding basic information to: " + nplId + " " + product.name + ", " + product.brand + ", " + product.description);
						fs.writeFileSync(__dirname + "/../fass/www/products/" + nplId + ".json", JSON.stringify(product, null, "\t"), "utf8");
					}
				}


				var product = {
					"id": nplId,
					"name": name,
					"brand": brand,
					"atcCode": atcCode,
					"spcLink": spcLink,
					"available": available,
					"description": description
				}

				fs.writeFileSync(__dirname + "/products/" + nplId + ".json", JSON.stringify(product, null, "\t"), "utf8");
				//fs.writeFileSync(__dirname + "/items/" + nplId + ".json", JSON.stringify(item, null, "\t"), "utf8");
			
				availableCounter++;
			}
		} 
	});

	xml.on("end", function() {
		console.log(availableCounter + " products");
	});
	
}
