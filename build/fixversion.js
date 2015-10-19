var fs = require("fs");
var path = require("path");

var staticSettingsPath = path.join(__dirname, "..", "servers", "cms", "output", "static", "settings.json");
var staticSettings = JSON.parse(fs.readFileSync(staticSettingsPath, "utf8"));

// /js/scripts.min.js
var jsFileContentsPath = path.join(__dirname, "..", "servers", "cms", "output", "static", "js", "scripts.min.js");
var jsFileContents = fs.readFileSync(jsFileContentsPath, "utf8");

jsFileContents = jsFileContents.replace(/\{version\}/g, staticSettings.version);

fs.writeFileSync(jsFileContentsPath, jsFileContents, "utf8");

// /css/styles.min.css
var cssFileContentsPath = path.join(__dirname, "..", "servers", "cms", "output", "static", "css", "styles.min.css");
var cssFileContents = fs.readFileSync(cssFileContentsPath, "utf8");

cssFileContents = cssFileContents.replace(/\{version\}/g, staticSettings.version);

fs.writeFileSync(cssFileContentsPath, cssFileContents, "utf8");

// /css/noscript.min.css
cssFileContentsPath = path.join(__dirname, "..", "servers", "cms", "output", "static", "css", "noscript.min.css");
cssFileContents = fs.readFileSync(cssFileContentsPath, "utf8");

cssFileContents = cssFileContents.replace(/\{version\}/g, staticSettings.version);

fs.writeFileSync(cssFileContentsPath, cssFileContents, "utf8");
