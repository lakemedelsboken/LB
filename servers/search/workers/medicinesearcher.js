var fs = require("fs");
var Fuse = require("../lib/fuse.js");

var isInitializingSearchIndex = false;
var searchIndices = null;

function initSearchIndex() {
	
	if (isInitializingSearchIndex) {
		return;
	}

	isInitializingSearchIndex = true;
	searchIndices = {};

	var atcTree = JSON.parse(fs.readFileSync(__dirname + "/../../../npl/atcTree.json", "utf8"));

	//Medicine search
	var options = {
		keys: ["title", "titlePath", "id", "indications", "substance"],
		threshold: 0.3,
		distance: 3000,
		boost: [2, 1, 1, 1, 1]
	};

	var medicineSearchTree = atcTree.filter(function(element) {
		return ((element.type === "atc" && element.hasChildren) || element.type === "product");
	});

	//sort with the longest title first
//	medicineSearchTree.sort(function(a, b) {
//		return (b.title.length - a.title.length)
//	});

	var slices = [];

	//Create 16 slices
	var nrOfSlices = 16;
	for (var i = 0; i < nrOfSlices; i++) {
		slices.push([]);
	}

	//Iterate and distribute evenly in 8 slices
	for (var i = 0; i < medicineSearchTree.length; i++) {
		//Get first slice
		var slice = slices.shift();
		//Add to slice
		slice.push(medicineSearchTree[i]);
		//Send slice to back of slices array
		slices.push(slice);
	}

	//Distribute slices to search indices
	for (var i = 0; i < slices.length; i++) {
		searchIndices[i] = new Fuse(slices[i], options);
	}

	isInitializingSearchIndex = false;
}

initSearchIndex();

module.exports = function(input, callback) {

	var index = searchIndices[input.index];
	var results = index.search(input.term);

	//Create copy of array
	var trimmed = JSON.parse(JSON.stringify(results));

	//Remove indications blob before returning or saving
	for (var i = trimmed.length - 1; i >= 0; i--){
		if (trimmed[i].type === "product") {
			trimmed[i].indications = "";
		}
	}

	results = trimmed;

	callback(null, results);
}