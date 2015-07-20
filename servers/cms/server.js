var fs = require("fs");
var path = require("path");

var settingsPath = path.join(__dirname, "..", "..", "settings", "settings.json");

var settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
var networkPort = settings.internalServerPorts.cms;

console.log("Current version is: " + settings.version);

var app = require('./app');
app.set('port', networkPort);

var server = app.listen(app.get('port'), function() {
	console.log('CMS server listening on port ' + server.address().port);
});

