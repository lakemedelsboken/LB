var express = require('express');
var path = require('path');
var fs = require("fs");
var favicon = require('static-favicon');
var logger = require('morgan');
//var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var multer = require('multer');
var flash = require('connect-flash');

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

var app = express();

var secretSettingsPath = __dirname + "/../../settings/secretSettings.json";
var settingsPath = __dirname + "/../../settings/settings.json";

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
var settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));

app.version = settings.version;

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

app.use(favicon(path.join(__dirname, 'output', 'static', 'favicon.ico')));
app.use(logger('dev'));

app.use(multer({dest: './tmp/'}));
app.use(bodyParser({limit: "200mb"}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());

var session = require('express-session');
var FileStore = require('session-file-store')(session);

var fileStoreOptions = {
	ttl: (3600 * 24 * 31)
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
		done(err, user);
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


module.exports = app;
