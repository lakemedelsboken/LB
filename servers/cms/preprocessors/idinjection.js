var cheerio = require("cheerio");
var path = require("path");
var fs = require("fs");

module.exports = injector = {
	process: function(html) {

		var $ = cheerio.load(html);

		var usedIds = [];
		
		$("h1,h2,h3,h4,h5,h6").each(function(index, item) {

			item = $(item);

			if (item.attr("id") === undefined || item.attr("id").indexOf("_") === -1) { // 

				var id = item.text()
					.replace(/([^a-zåäö0-9]+)/gi, '-')
					.replace(/å/g, "a")
					.replace(/ä/g, "a")
					.replace(/ö/g, "o")
					.replace(/Å/g, "A")
					.replace(/Ä/g, "A")
					.replace(/Ö/g, "O");

				//Check for [a-z] as the first character
				if (!/^[a-zA-Z]/.test(id)) {
					id = "n-" + id;
				}

				//Set id to something completely different
				item.attr("id", "nonsensical");

				if (id.length > 0) {
					//Check for previous occurences
					var occurences = getNrOfOccurences(id, usedIds);
					if (occurences > 0) {
						id += ("-" + occurences);
					}
				} else {
					var counters = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "settings", "counters.json"), "utf8"));
					counters.id++;
					fs.writeFileSync(path.join(__dirname, "..", "settings", "counters.json"), JSON.stringify(counters, null, "\t"), "utf8");
					id = "n" + counters.id;
				}
				
				usedIds.push(id);

				var currentIds = $("#" + id);

				if (currentIds.length > 0) {
					id = id + "-" + (currentIds.length + 1);
					usedIds.push(id);
				}

				item.attr("id", id);
				
			}
		});
		
		return $.html();
	}
};

function getNrOfOccurences(id, usedIds) {

	var index = usedIds.indexOf(id);
	var occurences = [];

	while (index !== -1) {
		occurences.push(index);
		index = usedIds.indexOf(id, index + 1);
	}
	
	return occurences.length;
}