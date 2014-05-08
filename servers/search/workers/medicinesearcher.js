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
		distance: 2000
	};

	var medicineSearchTree = atcTree.filter(function(element) {
		return ((element.type === "atc" && element.hasChildren) || element.type === "product");
	});

	//sort with the longest title first
//	medicineSearchTree.sort(function(a, b) {
//		return (b.title.length - a.title.length)
//	});

	//Create 32 slices
	var slices = [[],[],[],[],[],[],[],[],[],[],[],[],[],[],[],[],[],[],[],[],[],[],[],[],[],[],[],[],[],[],[],[]];

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
	//var length = index.length;
	//console.time(input.index + " : " + length);
	var results = index.search(input.term);
	//console.timeEnd(input.index + " : " + length);

	callback(null, results);
}