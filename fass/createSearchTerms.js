var fs = require("fs");

//var productsPath = __dirname + "/www/products/";
//var productNames = fs.readdirSync(productsPath);

var atcTree = JSON.parse(fs.readFileSync(__dirname + "/atcTree.json", "utf8"));

var productNames = atcTree.filter(function(element) {
	return ((element.type === "atc" && element.hasChildren) || element.type === "product");
});

//Find all product names
//var foundNames = {"sdrf": true, "abcde": true, "abc": true};
var foundNames = {};

for (var i = 0; i < productNames.length; i++) {

	var product = productNames[i];
	if (product.title !== undefined) {

		var names = product.title.toLowerCase();
		if (names.indexOf(",") > -1) {
			names = names.split(",")[0];
		}
		
		names = names.replace(/\%/g, " ");
		names = names.replace(/\&/g, " ");
		names = names.replace(/\(/g, " ");
		names = names.replace(/\)/g, " ");
		names = names.replace(/\+/g, " ");
		names = names.replace(/\./g, " ");
		names = names.replace(/\,/g, " ");
		names = names.replace(/\-/g, " ");
		names = names.replace(/\®/g, " ");
		
		names = names.split(" ");
		
		for (var k = 0; k < names.length; k++) {
			var name = names[k].trim();
			if (name !== "") {
				if (foundNames[name] === undefined) {
					foundNames[name] = true;
				}
			}
		}
	}
}

//Create tree
var tree = {};

for (var name in foundNames) {
	for (var j = 1; j <= name.length; j++) {
		var characters = name.substr(0, j);
		if (tree[characters] === undefined) {
			tree[characters] = 1;
		} else {
			tree[characters]++;
		}
	}
}

//console.log(tree);

//Convert tree to array
var finalTree = [];
for (var searchItem in tree) {
	finalTree.push(searchItem);
}

finalTree.sort();

//console.log(finalTree);
fs.writeFileSync(__dirname + "/productSearchTerms.json", JSON.stringify(finalTree, null, "  "), "utf8");

console.log("Saved " + finalTree.length + " search terms to: " + __dirname + "/productSearchTerms.json");