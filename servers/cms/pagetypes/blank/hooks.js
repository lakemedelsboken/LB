var cheerio = require("cheerio");

var Hooks = {
	
	preRender: function(html, data) {
		return html;
	},
	postRender: function(html, data) {
		return html;
	}
};

module.exports = Hooks;