var express = require("express");
var path = require("path");
var fs = require("fs-extra");
var favicon = require("static-favicon");
var logger = require("morgan");
var bodyParser = require("body-parser");
var multer = require("multer");
var flash = require("connect-flash");
var request = require("request");

var routes = require('./routes/index');
var users = require('./routes/users');
var content = require('./routes/content');
var images = require('./routes/images');
var components = require('./routes/components');
var processors = require('./routes/processors');
var utils = require('./routes/utils');

var scrypt = require("scrypt");

scrypt.verify.config.keyEncoding = "utf8";
scrypt.verify.config.hashEncoding = "base64";

var secretSettingsPath = path.join(__dirname, "..", "..", "settings", "secretSettings.json");

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

var app = express();

var settingsPath = path.join(__dirname,"..", "..", "settings", "settings.json");
var settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));

var staticSettingsPath = path.join(__dirname,"output", "static", "settings.json");
var staticSettings = JSON.parse(fs.readFileSync(staticSettingsPath, "utf8"));

var chokidar = require("chokidar");

var chokidarOptions = {
	persistent: true,
	ignoreInitial: true
};

chokidar.watch(staticSettingsPath, chokidarOptions).on("all", function(event, path) {

	if (event === "change" || event === "add") {
		console.log("'settings.json' has changed, reloading in /app.js");
		staticSettings = JSON.parse(fs.readFileSync(staticSettingsPath, "utf8"));
	}

});


app.version = staticSettings.version;

var cronJob = require('cron').CronJob;

var job = new cronJob({
	cronTime: '00 00 07 * * *',
	onTick: function() {
		// Runs every day at 07:00:00 AM.
		updateATCTreeFromMaster();
	},
	start: true
});

//View engine setup
//Find admin interface views for pre and post processors

var views = [path.join(__dirname, 'views')];

var postProcessorsAdminInterfacesPath = path.join(__dirname, "postprocessors", "admininterfaces");
var preProcessorsAdminInterfacesPath = path.join(__dirname, "preprocessors", "admininterfaces");

if (fs.existsSync(postProcessorsAdminInterfacesPath) && fs.statSync(postProcessorsAdminInterfacesPath).isDirectory()) {
	var files = fs.readdirSync(postProcessorsAdminInterfacesPath);

	for (var i = 0; i < files.length; i++) {
		var adminInterfacePath = path.join(postProcessorsAdminInterfacesPath, files[i]);
		if (fs.statSync(adminInterfacePath).isDirectory()) {
			var viewsPath = path.join(adminInterfacePath, "views");
			if (fs.statSync(viewsPath).isDirectory()) {
				views.push(viewsPath);
			}
		}
	}
}

if (fs.existsSync(preProcessorsAdminInterfacesPath) && fs.statSync(preProcessorsAdminInterfacesPath).isDirectory()) {
	var files = fs.readdirSync(preProcessorsAdminInterfacesPath);

	for (var i = 0; i < files.length; i++) {
		var adminInterfacePath = path.join(preProcessorsAdminInterfacesPath, files[i]);
		if (fs.statSync(adminInterfacePath).isDirectory()) {
			var viewsPath = path.join(adminInterfacePath, "views");
			if (fs.statSync(viewsPath).isDirectory()) {
				views.push(viewsPath);
			}
		}
	}
}

app.set('views', views);
app.set('view engine', 'ejs');
app.set('json spaces', '  ')

var versionRemover = function(req, res, next) {

	//From Versionator

	// We only do this on GET and HEAD requests
	if ('GET' !== req.method && 'HEAD' !== req.method) {
		return next();
	}

	var vPos = req.url.indexOf(staticSettings.version)

	// If version isn't in path then move on.
	if (vPos === -1) {
		return next();
	}

	// Rebuild the URL without the version and set the request url.
	req.url = req.url.substring(0, vPos - 1) + req.url.substring(vPos + staticSettings.version.length);
	next();
};

app.use(versionRemover);
app.use(favicon(path.join(__dirname, 'output', 'static', 'favicon.ico')));
app.use(logger('dev'));

app.use(multer({dest: './tmp/'}));
app.use(bodyParser({limit: "200mb"}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());

var session = require('express-session');
var FileStore = require('session-file-store')(session);

var fileStoreOptions = {
	ttl: (3600 * 24 * 31),
	path: path.join(__dirname, "sessions")
};

app.use(session({
	store: new FileStore(fileStoreOptions),
	secret: 'keyboard cat',
	resave: false,
	saveUninitialized: false
}));

app.use(flash());
//app.use(cookieParser());

var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;

passport.serializeUser(function(user, done) {
	//What should be stored in session
	done(null, user.id);
});

var Users = {
	findById: function(id, callback) {
		var foundUser = null;

		for (var username in secretSettings.cms.users) {
			if (secretSettings.cms.users[username].id === id) {
				secretSettings.cms.users[username].username = username;
				foundUser = secretSettings.cms.users[username];
				break;
			}
		}
	
		if (foundUser) {
			return callback(null, foundUser);
		} else {
			return callback(new Error("Could not find user with id: " + id));
		}
	},
	findByUsername: function(username, callback) {
		var foundUser = null;

		for (var name in secretSettings.cms.users) {
			if (name === username) {
				secretSettings.cms.users[name].username = name;
				foundUser = secretSettings.cms.users[username];
				break;
			}
		}
	
		if (foundUser) {
			return callback(null, foundUser);
		} else {
			return callback(null, null); //new Error("Could not find user with name: " + username)
		}
	},
	verifyPassword: function(providedPassword, passwordHash) {
		return scrypt.verify(passwordHash, providedPassword);
	}
};

passport.deserializeUser(function(id, done) {
	Users.findById(id, function(err, user) {
		if (err) {
			done(null, false, {message: "Användare existerar ej."});
		} else {
			done(err, user);
		}
	});
});

passport.use(new LocalStrategy(
	function(username, password, done) {
		Users.findByUsername(username, function(err, user) {
			if (err) { return done(err); }
			if (!user) {
				return done(null, false, { message: 'Felaktigt användarnamn.' });
			}
			if (!Users.verifyPassword(password, user.password)) {
				return done(null, false, { message: 'Felaktigt lösenord.' });
			}
			return done(null, user);
		});
	}
));

app.use(passport.initialize());
app.use(passport.session());

app.get("/cms/login", function(req, res) {

	res.render('login', {title: "Logga in", error: req.flash("error")});
});

app.get("/cms/logout", function(req, res) {
	req.session.originalUrl = undefined;
	req.logout();
	res.redirect('/cms/login');
});

app.post('/cms/login',function(req, res, next) {

	passport.authenticate('local', function(err, user, info) {
		if (err) { return next(err); }

		if (!user) { 
			return res.redirect('/cms/login'); 
		}

		req.logIn(user, function(err) {
			if (err) { return next(err); }
			// Redirect if it succeeds

			var redirectUrl = (req.session.originalUrl || '/cms/');

			return res.redirect(redirectUrl);
		});
		
	
	})(req, res, next);

});

function ensureAuthenticated(req, res, next) {
	if (req.isAuthenticated()) {
		return next();
	}

	if (req.originalUrl !== "/cms/login") {
		req.session.originalUrl = req.originalUrl
	}

	res.redirect('/cms/login');
}

app.use("/cms", express.static(path.join(__dirname, 'public')));

app.use("/cms/", ensureAuthenticated);

//app.use(express.static(path.join(__dirname, 'output', 'published'), {index: ["default.html", "index.html"]}));
app.use("/cms/draft", express.static(path.join(__dirname, 'output', 'draft'), {index: ["default.html", "index.html"]}));

//app.use(express.static(path.join(__dirname, 'output', 'static')));

//js, css, images
app.use("/cms/draft", express.static(path.join(__dirname, 'output', 'static')));


app.use('/cms/', images);
app.use('/cms/', components);
app.use('/cms/', processors);
app.use('/cms/content', content);
app.use('/cms/utils', utils);

//Set "/" to last
app.use('/cms/', routes);

/// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

/// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});

function updateATCTreeFromMaster() {
	var apiKeys = secretSettings.api.keys;
	
	var cmsApiKey = "CMS";
	
	for (var key in apiKeys) {
		if (apiKeys[key] === "CMS") {
			cmsApiKey = key;
			break;
		}
	}
	
	if (cmsApiKey === "CMS") {
		console.log("Could not find API key for CMS.")
	}

	var statusError = false;
	var generalError = false;

	var tempAtcTreePath = path.join(__dirname, "tmp", "atcTree.json");

	console.log("Downloading new atcTree.json from master server...");

	var masterAtcTreeUrl = "http://www.lakemedelsboken.se/api/v1/atcTree.json";

	request(masterAtcTreeUrl)
	.on('response', function(response) {
		if (response.statusCode !== 200) {
			statusError = response.statusCode;
		}
	})
	.on('error', function(err) {
		generalError = err;
	})
	.pipe(fs.createWriteStream(tempAtcTreePath))
	.on('error', function (err) {
		generalError = err;
	})
	.on('close', function(err) {

		if (statusError) {
			console.error("Status code for response was: " + statusError);
			console.error("Could not download atcTree from " + masterAtcTreeUrl);
		}
		
		if (generalError) {
			console.error("General error: ", generalError);
			console.error("Could not download atcTree from " + masterAtcTreeUrl);
		}

		if (!statusError && !generalError) {
			
			//TODO:Check integrity of atcTree.json
			var atcTree = null;
			var readError = false;
			var parseError = false;
			
			try {
				atcTree = fs.readFileSync(tempAtcTreePath, "utf8");
			} catch(err) {
				readError = true;
				console.error("Could not read temp atc tree after downloading from master server");
			}
				
			
			if (!readError && atcTree !== null) {

				try {
					atcTree = JSON.parse(atcTree);
				} catch(err) {
					parseError = true;
					console.error("Could not parse temp atc tree after downloading from master server");
				}
			
				if (!parseError && !readError) {

					if (Array.isArray(atcTree)) {

						//Expect at least 20000 items in the atc tree
						var minExpectedItems = 20000;

						if (atcTree.length > minExpectedItems) {

							console.log("Downloaded new atcTree.json, everything seems fine, replacing npl version");
							
							var nplAtcTreePath = path.join(__dirname, "..", "..", "npl", "atcTree.json");

							fs.copy(tempAtcTreePath, nplAtcTreePath, function(err) {
								if (err) {
									console.error("Could not copy file from: " + tempAtcTreePath + " to: " + nplAtcTreePath, err);
								} else {
									console.log("Finished replacing atcTree.json with new version");
								}
								
							});

						} else {
							console.error("Downloaded atc tree only contained " + atcTree.length + " items, aborting replacement of new tree from master server");
						}

						
					} else {
						console.error("Atc tree is not an array, aborting replacement of new tree from master server");
					}


					
				}
				
			}
			
		}
	})
	
}

updateATCTreeFromMaster();

module.exports = app;
