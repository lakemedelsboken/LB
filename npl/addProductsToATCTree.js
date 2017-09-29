var fs = require("fs");
var $ = require("cheerio");

var atcTree = JSON.parse(fs.readFileSync(__dirname + "/newAtcTree.json"));

function getItemById(id) {
	var result = undefined;
	for (var i = atcTree.length - 1; i >= 0; i--) {
		if (atcTree[i].id === id) {
			result =  atcTree[i];
			break;
		}
	}
	return result;
}

var productsPath = __dirname + "/../fass/www/products/";

var fileNames = fs.readdirSync(productsPath);

for (var i = 0; i < fileNames.length; i++) {

//for (var i=0; i < atcTree.length; i++) {
//	var item = atcTree[i];
	
//	if (item.type === "product") {
		//Check if product description exists
//		if (fs.existsSync(__dirname + "/www/products/" + item.id + ".json")) {
		if (fileNames[i].indexOf(".json") > -1) {

			var add = false;
			//Read description
			//console.log("open: " + item.id);
			var product = JSON.parse(fs.readFileSync(productsPath + fileNames[i]));

			if (product.description !== undefined) {

				var description = product.description;
				
				if (description.indexOf("(") > -1) {
					description = description.substr(0, description.indexOf("("));
				}
				
				var parent = getItemById(product.atcCode);
				if (parent === undefined) {
					console.log("There was not atc for: " + product.atcCode);
				} else {

					parent.hasChildren = true;
				
					var item = getItemById(product.id);
					if (item === undefined) {
						item = {
							id: product.id,
							parentId: product.atcCode,
							title: product.name + ", " + description + ", " + product.brand,
							type: "product",
							titlePath: parent.titlePath,
							idPath: parent.idPath
						};
						add = true;
					
					}

					/*
					"id": "20091203000076",
					"parentId": "D08",
					"title": "Calendula Weleda, Kutan lösning , Weleda",
					"type": "product",
					"titlePath": "Hudpreparat / Antiseptika och sårmedel",
					"idPath": "D / D08",
					"indications": "",
					"substance": "",
					"parallelimport": "",
					"noinfo": true
			
					*/

					if (product.noinfo === undefined && product.images !== undefined && product.images.length > 0) {
						var images = product.images;
						var imagesToSave = [];
						for (var j=0; j < images.length; j++) {
							var imageFilePath = productsPath + "images/" + images[j].checksum + ".jpg";
							if (fs.existsSync(imageFilePath)) {
								var imageWebPath = "/products/images/" + images[j].checksum + ".jpg";
								imagesToSave.push(imageWebPath);
							}
						}
						//Add to atc tree
						item.images = imagesToSave;
						item.noinfo = false;
					} 

					if (product.noinfo === undefined && product.sections !== undefined && product.sections["Indikationer"] !== undefined) {
						var indications = $(product.sections["Indikationer"]).text().replace(/\n/g, " ");
						//Add to atc tree
						item.indications = indications;
					} else {
						item.indications = "";
					} 

					if (product.noinfo === undefined && product.substance !== undefined) {
						//Add to atc tree
						item.substance = product.substance;
					} else {
						item.substance = "";
					} 

					if (product.noinfo === undefined && product.parallelimport !== undefined && product.parallelimport !== "") {
						//Add to atc tree
						item.parallelimport = product.parallelimport;
					} else {
						item.parallelimport = "";
					} 

					if (product.noinfo !== undefined) {
						item.noinfo = true;
					} else {
						item.noinfo = false;
					}
				
					if (add) {
						atcTree.push(item);
					}
					
				}
			}
			
		}
//	}
}

function setupHierarchy(checksum) {
	//Modify
	for (var i = atcTree.length - 1; i >= 0; i--) {
		if (atcTree[i].type === "atc" && atcTree[i].hasChildren) {
			var parent = getItemById(atcTree[i].parentId);
			if (parent !== undefined) {
				parent.hasChildren = true;
			}
		}
	}
	
	var newChecksum = JSON.stringify(atcTree);
	if (newChecksum !== checksum) {
		setupHierarchy(newChecksum);
	}
}

var checksum = JSON.stringify(atcTree);
setupHierarchy(checksum);

//Cleanup, remove atc types with no children
for (var i = atcTree.length - 1; i >= 0; i--) {
	if (atcTree[i].type === "atc" && !atcTree[i].hasChildren) {

		atcTree.splice(i, 1);
		//console.log(atcTree[i].id, atcTree[i].title);
	}
}

console.log(atcTree.length);

//Save new atcTree
fs.writeFileSync(__dirname + "/newAtcTree.json", JSON.stringify(atcTree, null, "\t"), "utf8");
