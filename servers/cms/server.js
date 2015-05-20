//var debug = require('debug')('cms');
var fs = require("fs");

var settings = JSON.parse(fs.readFileSync(__dirname + "/../../settings/settings.json", "utf8"));
var networkPort = settings.internalServerPorts.cms;

var app = require('./app');
app.set('port', networkPort);

var server = app.listen(app.get('port'), function() {
	console.log('Express server listening on port ' + server.address().port);
});
