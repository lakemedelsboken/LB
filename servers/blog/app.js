// Require jojo and create a server
var jojo = require('jojo'),
    express = require("express"),
// jojo.createServer makes an express server and auto-uses jojo
    app = jojo.createServer();

var fs = require("fs");
var settings = JSON.parse(fs.readFileSync(__dirname + "/../../settings/settings.json", "utf8"));

var networkPort = settings.internalServerPorts.blog;

app.listen(networkPort);

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.set('jojo basepath', '/blog/');
app.set('jojo articles', __dirname + '/articles/');
app.set('jojo index view', __dirname + '/views/pages/index');
app.set('jojo article view', __dirname + '/views/pages/article');
app.set('jojo rss view', __dirname + '/views/xml');

jojo.config.version = settings.version;
//app.use("/blog/", express.static(process.cwd() + '/public'));

console.log('Blog server is listening to http://127.0.0.1:' + networkPort);