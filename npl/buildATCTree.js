var fs = require("fs");
var XmlStream = require("xml-stream");
var path = require("path");

var stream = fs.createReadStream(path.join(__dirname, '/database/sensl/atc-code-lx.xsd'));
var xml = new XmlStream(stream);

xml.preserve('xs:enumeration', true);

var counter = 0;

var atcItems = [];
var atcTree = {root: {
		"titlePath": "",
		"idPath": "",
		"hasChildren": true
	}
};

xml.on('updateElement: xs:enumeration', function(item) {
	//Discard veterinary codes
	if (item.$.value.substr(0, 1) !== "Q") {
		counter++;
		var title = "";
		var annotation = item["xs:annotation"].$children.filter(function(e) {
			if (e.$) {
				return true;
			}
			return false
		});;
		for (var i = 0; i < annotation.length; i++) {

			if (annotation[i].$["xml:lang"] === "sv") {
				title = annotation[i].$text;
				break;
			}
		}

		if (title.indexOf(" / ") > -1) {

			console.log("Error: " + title + " contains \" / \" in title");
		}

		atcItems.push({id: item.$.value, title: title});
	}
});

xml.on("end", function() {
	//Build tree, each step
	for (var i = 0; i < atcItems.length; i++) {
		if (atcItems[i].id.length === 1) {
			atcTree[atcItems[i].id] = {title: atcItems[i].title, parentId: "root", titlePath: atcItems[i].title, idPath: atcItems[i].id, hasChildren: false};
		}
	}

	for (var i = 0; i < atcItems.length; i++) {
		if (atcItems[i].id.length === 3) {
			var item = atcItems[i];
			var parentId = item.id.substr(0, 1);
			var parent = atcTree[parentId];
			if (parent === undefined) {
				console.log(item.id + " has no parent");
			} else {
				//parent.hasChildren = true;
				var titlePath = parent.titlePath + " / " + item.title;
				var idPath = parent.idPath + " / " + item.id;

				atcTree[item.id] = {parentId: parentId, title: item.title, titlePath: titlePath, idPath: idPath};
			}
		}
	}

	for (var i = 0; i < atcItems.length; i++) {
		if (atcItems[i].id.length === 4) {
			var item = atcItems[i];
			var parentId = item.id.substr(0, 3);
			var parent = atcTree[parentId];

			if (parent === undefined) {
				console.log(item.id + " has no parent");
			} else {
				//parent.hasChildren = true;
				var titlePath = parent.titlePath + " / " + item.title;
				var idPath = parent.idPath + " / " + item.id;

				atcTree[item.id] = {parentId: parentId, title: item.title, titlePath: titlePath, idPath: idPath};
			}
		}
	}

	for (var i = 0; i < atcItems.length; i++) {
		if (atcItems[i].id.length === 5) {
			var item = atcItems[i];
			var parentId = item.id.substr(0, 4);
			var parent = atcTree[parentId];

			if (parent === undefined) {
				console.log(item.id + " has no parent");
			} else {
				//parent.hasChildren = true;
				var titlePath = parent.titlePath + " / " + item.title;
				var idPath = parent.idPath + " / " + item.id;

				atcTree[item.id] = {parentId: parentId, title: item.title, titlePath: titlePath, idPath: idPath};
			}
		}
	}

	for (var i = 0; i < atcItems.length; i++) {
		if (atcItems[i].id.length === 7) {
			var item = atcItems[i];
			var parentId = item.id.substr(0, 5);
			var parent = atcTree[parentId];

			if (parent === undefined) {
				console.log(item.id + " has no parent");
			} else {
				//parent.hasChildren = true;
				var titlePath = parent.titlePath + " / " + item.title;
				var idPath = parent.idPath + " / " + item.id;

				atcTree[item.id] = {parentId: parentId, title: item.title, titlePath: titlePath, idPath: idPath};
			}
		}
	}

	//Flatten tree
	var atc = [];
	for (var id in atcTree) {
		var data = atcTree[id];
		data.id = id;
		if (id !== "root") {
			data.type = "atc";
		}
		atc.push(data);
	}

	//console.log(atc);
	fs.writeFileSync(__dirname + "/newAtcTree.json", JSON.stringify(atc, null, "\t"), "utf8");
	console.log(counter + " items saved to newAtcTree.json");

});
