var fs = require("fs");
var newAtcPath = __dirname + "/newAtcTree.json";
var results = "";
var expectedMinimumItems = 10000;

if (fs.existsSync(newAtcPath)) {
	//TODO: Perform checks
	//Is the number of items of reasonable length
	var newAtcTree = JSON.parse(fs.readFileSync(newAtcPath));

	if (newAtcTree.length < expectedMinimumItems) {
		console.log("Number of items in newAtcTree.json is less than " + expectedMinimumItems + " (" + newAtcTree.length + ")");
	} else {
		fs.renameSync(__dirname + "/newAtcTree.json", __dirname + "/atcTree.json");
		console.log("Wrote new atcTree.json");
	}
} else {
	console.log("No \"newAtcTree.json\" file exists.");
}