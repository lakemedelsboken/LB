var fs = require("fs");
var XmlStream = require("xml-stream");
var path = require("path");
var async = require("async");

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

	var stream = fs.createReadStream(path.join(__dirname, '/database/npl/Lexicondata/organization.xml'));
	var xml = new XmlStream(stream);

	xml.on('updateElement: organization', function(item) {
		var id = item.$.id;
		var name = item["orgname"].replace("MAH Saknas.", "").replace("MAHSaknas.", "").replace(" (Sponsor)", "").replace(" (Tillverkare)", "").trim();

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

	var stream = fs.createReadStream(path.join(__dirname, '/database/npl/Lexicondata/pharmaceutical-form-lx.xml'));
	var xml = new XmlStream(stream);

	xml.preserve("commonTerm", true);

	xml.on('updateElement: commonTerm', function(item) {
		var id = item["mpaId"].$text;
		var n = item.$children.filter(function(e) {
			if (e.$) {
				return (e.$["xml:lang"] === "sv" && e.$name === 'term-name');
			}
			return false
		});

		var name = "";

		if (n.length > 0) {
			name = n[0].$.v
		}

		pharmForms[id] = name;

	});

	xml.on("end", function() {

		console.log("Read " + Object.keys(pharmForms).length + " pharmaceutical forms.");
		callback();
	});
}

function addToDownloadList(nplId) {

	if (nplId !== undefined && nplId !== "") {
		var foundUpdates = JSON.parse(fs.readFileSync(__dirname + "/../fass/shared/foundUpdates.json", "utf8"));
		var alreadyInList = false;

		var alreadyInList = (foundUpdates.indexOf(nplId) > -1);

		if (!alreadyInList) {
			console.log(nplId + " is added to shared/foundUpdates.json");
			foundUpdates.push(nplId);
			fs.writeFileSync(__dirname + "/../fass/shared/foundUpdatesParseLock.json", JSON.stringify(foundUpdates, null, "\t"), "utf8");
			fs.renameSync(__dirname + "/../fass/shared/foundUpdatesParseLock.json", __dirname + "/../fass/shared/foundUpdates.json");
		}
	}

}

var controlClasses = {};

function readControlClasses(callback) {

	console.log("Reading control classes...");

	var stream = fs.createReadStream(path.join(__dirname, '/database/npl/Lexicondata/narcotic-classification-lx.xml'));
	var xml = new XmlStream(stream);

	xml.preserve("commonTerm", true);

	xml.on('updateElement: commonTerm', function(item) {
		var id = item['mpaId'].$text;

		var n = item.$children.filter(function(e) {
			if (e.$) {
				return (e.$["xml:lang"] === "sv" && e.$name === 'term-name');
			}
			return false
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

	var atcItems = {};
	var atcTree = JSON.parse(fs.readFileSync(__dirname + "/newAtcTree.json", "utf8"));
	for (var i = 0; i < atcTree.length; i++) {
		if (atcTree[i].type === "atc") {
			atcItems[atcTree[i].id] = true;
		}
	}

	var availableCounter = 0;
	var totalCounter = 0;
	var missingInfoCounter = 0;

	var q = async.queue(function (file, callback) {

		var stream = fs.createReadStream(path.join(__dirname, '/database/npl/Productdata/'+ file ));
		var xml = new XmlStream(stream);

		xml.preserve("npl:names", true);
		xml.preserve("npl:classifications", true);
		xml.collect("npl:package", true);


		xml.on('updateElement: npl:medprod', function(item) {
			totalCounter++;
			if ((totalCounter % 1000) === 0) {
				console.log(availableCounter + " of " + totalCounter + ", " + missingInfoCounter + " items with missing info");
			}

			var atcCode = item["npl:classifications"]["mpa:atc-code-lx"].$.v;

			if (atcCode !== undefined && atcItems[atcCode] !== undefined) {

				//NplId
				var nplId = item["mpa:nplid"];

				if (nplId !== undefined) {

					//Name
					var name = "";
					var name = item["npl:names"]['mpa:medprodname'].$.v;

					//Brand
					var brand = undefined;

					if (item["npl:organizations"] && item["npl:organizations"]["mpa:organization"] && item["npl:organizations"]["mpa:organization"]["mpa:organization-lx"]) {
						brand = item["npl:organizations"]["mpa:organization"]["mpa:organization-lx"].$.v;
					}
					if (brand !== undefined) {
						brand = organizations[brand];
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
					if (item["mpa:strength-text"] && item["mpa:strength-text"]["mpa:v"]) {
						strength = item["mpa:strength-text"]["mpa:v"];
					} else {
						strength = "";
					}
					var description = (form + " " + strength).trim();


					//Narcotics
					var narcoticClass = "";
					var narcoticClassTextCaution = "";
					var narcoticClassTextHabituation = "";
					var isNarcotic = false;

					if (item["npl:classifications"] && item["npl:classifications"]["mpa:narcotic-class-lx"] && item["npl:classifications"]["mpa:narcotic-class-lx"]["$"] && item["npl:classifications"]["mpa:narcotic-class-lx"]["$"]["v"]) {
						narcoticClass = item["npl:classifications"]["mpa:narcotic-class-lx"]["$"]["v"]
						if (narcoticClass === "1" || narcoticClass === "2" || narcoticClass === "3" || narcoticClass === "4" || narcoticClass === "5") {
							narcoticClassTextCaution = "Iakttag största försiktighet vid förskrivning av detta läkemedel.";
							narcoticClassTextHabituation = "Beroendeframkallande medel.";
							isNarcotic = true;
						}
					}

					//Packaging
					var packaging = "";
					if (item["npl:packages"] && item["npl:packages"]["npl:package"]) {

						var presentation = item["npl:packages"]["npl:package"];
						if (presentation.length > 0) {
							presentation = presentation[0];

							if (presentation["mpa:pack-text"] && presentation["mpa:pack-text"]["mpa:v"]) {
								packaging = presentation["mpa:pack-text"]["mpa:v"].$text;
							}
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

						addToDownloadList(nplId);

						//Write a basic stub to fass/www/products/
						var newProduct = {
							"noinfo": true,
							"id": nplId,
							"name": name,
							"brand": brand,
							"atcCode": atcCode,
							"strength": strength,
							"form": form,
							"packaging": packaging,
							"narcoticClass": narcoticClass,
							"spcLink": spcLink,
							"available": true,
							"description": description
						}

						if (isNarcotic) {
							newProduct.narcoticClassTextHabituation = narcoticClassTextHabituation;
							newProduct.narcoticClassTextCaution = narcoticClassTextCaution;
						}

						fs.writeFileSync(__dirname + "/../fass/www/products/" + nplId + ".json", JSON.stringify(newProduct, null, "\t"), "utf8");

					} else {
						//Check that name and brand is set
						var product = JSON.parse(fs.readFileSync(__dirname + "/../fass/www/products/" + nplId + ".json"));
						var update = false;
						var updateFromFass = false;

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

						//Make sure additional monitoring info is added to each product
						if (product.additionalMonitoring === undefined) {
							updateFromFass = true;
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

						if (updateFromFass) {
							addToDownloadList(nplId);
						}
					}

					var product = {
						"id": nplId,
						"name": name,
						"brand": brand,
						"atcCode": atcCode,
						"spcLink": spcLink,
						"available": true,
						"description": description
					}

					fs.writeFileSync(__dirname + "/products/" + nplId + ".json", JSON.stringify(product, null, "\t"), "utf8");
					//fs.writeFileSync(__dirname + "/items/" + nplId + ".json", JSON.stringify(item, null, "\t"), "utf8");

					availableCounter++;
				}
			}
		});

		xml.on("end", function() {
			callback();
			console.log(file);
			console.log(availableCounter + " products");
		});

	}, 100);


	var productFiles = fs.readdirSync(__dirname + "/database/npl/Productdata/");



	console.log(productFiles.length);
	for (var i = 0; i < productFiles.length; i++) {
		if (productFiles[i].indexOf(".xml") > -1) {
			q.push(productFiles[i], function () {

			});
		}
	}

	q.drain = function() {
	    console.log('all items have been processed');
	};

	q.drain();

}
