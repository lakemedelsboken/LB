var http = require("http");
http.globalAgent.maxSockets = 20;

var express = require('express');
//var app = express.createServer();
var app = express();
var path = require("path");
var fs = require("fs");

var secretSettingsPath = __dirname + "/../../settings/secretSettings.json";

if (!fs.existsSync(secretSettingsPath)) {
	console.error("Config file [" + secretSettingsPath + "] missing!");
	console.error("Did you forget to run `make decrypt_conf`?");
	process.exit(1);
}

(function() {
	var conf_time = fs.statSync(secretSettingsPath).mtime.getTime();
	var cast5_time = fs.statSync(secretSettingsPath + ".cast5").mtime.getTime();
 
	if (conf_time < cast5_time) {
		console.error("Your config file is out of date!");
		console.error("You need to run `make decrypt_conf` to update it.");
		process.exit(1);
	}
})();

var secretSettings = JSON.parse(fs.readFileSync(secretSettingsPath, "utf8"));

exports.init = function(port) {

	function authorize(username, password) {
		return secretSettings.admin.basicAuthId === username & secretSettings.admin.basicAuthPassword === password;
	}

	app.enable('trust proxy');

	app.configure(function(){
		app.use(express.basicAuth(authorize));
		app.set('views', __dirname + '/views');
		app.set('view engine', 'ejs');
//		app.use(express.logger());
//		app.use(express.compress());
//		app.use(express.bodyParser());
//		app.use(express.methodOverride());
		app.use(express.static(__dirname + '/static'));
		app.use(express.static(__dirname + '/chapters'));
//		app.use(express.staticCache());
		app.use(express.static(__dirname + '/../../fass/www'));
		app.use(app.router);
//		app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
	});

	app.configure('development', function(){
		app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
		// app.use(express.logger({ format: ':method :url' }));
	});

 	app.configure('production', function(){
		app.use(express.errorHandler()); 
	});

	app.use(function(err, req, res, next) {
		res.render('500.ejs', { locals: { error: err },status: 500 });	
	});

	app.listen(port);

	getNetworkIPs(function(err, ips) {
		console.log("Running server on port " + port + ":");
		for (var i=0; i < ips.length; i++) {
			console.log("http://" + ips[i] + ":" + port);
		}
		console.log("Ctrl+C to quit");
	});

	return app;
}

var getNetworkIPs = (function () {
	var ignoreRE = /^(127\.0\.0\.1|::1|fe80(:1)?::1(%.*)?)$/i;

	var exec = require('child_process').exec;
	var cached;
	var command;
	var filterRE;

	switch (process.platform) {
		case 'win32':
			//case 'win64': // TODO: test
			command = 'ipconfig';
			filterRE = /\bIP(v[46])?-?[^:\r\n]+:\s*([^\s]+)/g;
			// TODO: find IPv6 RegEx
			break;
		case 'darwin':
			command = 'ifconfig';
			filterRE = /\binet\s+([^\s]+)/g;
			// filterRE = /\binet6\s+([^\s]+)/g; // IPv6
			break;
		case 'linux':
			command = '/sbin/ifconfig';
			filterRE = /\binet\b[^:]+:\s*([^\s]+)/g;
			// filterRE = /\binet6\s+([^\s]+)/g; // IPv6
			break;
		default:
			command = 'ifconfig';
			filterRE = /\binet\b[^:]+:\s*([^\s]+)/g;
			// filterRE = /\binet6[^:]+:\s*([^\s]+)/g; // IPv6
			break;
	}

	return function (callback, bypassCache) {
		if (cached && !bypassCache) {
			callback(null, cached);
			return;
		}
		// system call
		exec(command, function (error, stdout, sterr) {
			cached = [];
			var ip;
			var matches = stdout.match(filterRE) || [];
			for (var i = 0; i < matches.length; i++) {
				ip = matches[i].replace(filterRE, '$1')
				if (!ignoreRE.test(ip)) {
					cached.push(ip);
				}
			}
			callback(error, cached);
		});
	};
})();