var request = require("request");
var should = require("should");
var cheerio = require("cheerio");
var jsdom = require("jsdom");

var apiKey = "3946aab9-1d65-46c4-8255-fcbe8c9195c3";

describe("API", function() {

	describe("#/api/v1/extractkeywords?url=http://lakemedelsboken.se/kapitel/akutmedicin/chock.html", function() {
		it("should find several keywords", function(done) {
			
			this.timeout(15000);
			
			request("http://localhost/api/v1/extractkeywords?url=http://lakemedelsboken.se/kapitel/akutmedicin/chock.html&apikey=" + apiKey, function (error, response, body) {

				should.not.exist(error);
				response.statusCode.should.equal(200);

				var data = JSON.parse(body);
				data.content.should.not.equal("");

				var recognized = data.content.length;
				
				recognized.should.be.above(0);

				done();

			});

		});
	});

	describe("#/api/v1/extractkeywords?content=<body>hypertoni</body>", function() {
		it("should find one keyword: 'hypertoni' and it should be a MeSH term", function(done) {
			
			this.timeout(15000);
			
			request("http://localhost/api/v1/extractkeywords?content=<body>hypertoni</body>&apikey=" + apiKey, function (error, response, body) {

				should.not.exist(error);
				response.statusCode.should.equal(200);

				var data = JSON.parse(body);
				data.content.should.not.equal("");

				var recognized = data.content.length;
				
				recognized.should.be.equal(1);
				data.content[0].word.should.be.exactly("hypertoni");
				(data.content[0].meshterm).should.be.true();

				done();

			});

		});
	});

	describe("#/api/v1/extractkeywords form usage", function() {
		it("should find one keyword: 'hypertoni' and it should be a MeSH term", function(done) {
			
			this.timeout(15000);
			
			request.post({url: "http://localhost/api/v1/extractkeywords", form: {apikey: apiKey, content: "<body>hypertoni</body>"}}, function (error, response, body) {

				should.not.exist(error);
				response.statusCode.should.equal(200);

				var data = JSON.parse(body);
				data.content.should.not.equal("");

				var recognized = data.content.length;
				
				recognized.should.be.equal(1);
				data.content[0].word.should.be.exactly("hypertoni");
				(data.content[0].meshterm).should.be.true();

				done();

			});

		});
	});


	describe("#/api/v1/injectgenericas/:selector?", function() {
		it("should inject code around four substance names when no selector is specified", function(done) {
			
			this.timeout(15000);
			
			request("http://localhost/api/v1/injectgenericas?url=http://localhost/api/v1/injectgenericas/test1.html&apikey=" + apiKey, function (error, response, body) {

				should.not.exist(error);
				response.statusCode.should.equal(200);

				var data = JSON.parse(body);
				data.content.should.not.equal("");

				var $ = cheerio.load(data.content);
				var recognized = $(".inlineGenerica").length;
				
				recognized.should.equal(4);

				done();

			});

		});

		it("should inject code around 'dabigatran' when multiple hits for '.test1' are found", function(done) {
			
			this.timeout(15000);
			
			request("http://localhost/api/v1/injectgenericas/.test1/?url=http://localhost/api/v1/injectgenericas/test1.html&apikey=" + apiKey, function (error, response, body) {

				should.not.exist(error);
				response.statusCode.should.equal(200);

				var data = JSON.parse(body);
				data.content.should.not.equal("");

				var $ = cheerio.load(data.content);
				$(".inlineGenerica").length.should.equal(1);
				
				$(".inlineGenerica").text().should.equal("dabigatran");

				done();

			});

		});

		it("should inject code around 'nsaid' substance name when selector \"#test2\" is specified", function(done) {
			
			this.timeout(15000);
			
			request("http://localhost/api/v1/injectgenericas/%23test2/?url=http://localhost/api/v1/injectgenericas/test1.html&apikey=" + apiKey, function (error, response, body) {

				should.not.exist(error);
				response.statusCode.should.equal(200);

				var data = JSON.parse(body);
				data.content.should.not.equal("");

				var $ = cheerio.load(data.content);
				$(".inlineGenerica").length.should.equal(1);
				
				$(".inlineGenerica").text().should.equal("nsaid");

				done();

			});

		});

	});
	
	describe("#/api/v1/injectgenericas/lb.injectgenericas.js/:selector?", function() {
	
		it("should work with the script injection technique", function(finished) {
			
			this.timeout(20000);

			request("http://localhost/api/v1/injectgenericas/test1.html?apikey=" + apiKey, function (error, response, body) {

				should.not.exist(error);
				response.statusCode.should.equal(200);

				body.should.not.equal("");

				var doc = jsdom.jsdom(body);
				var window = doc.defaultView;
				window.document.location.href = "http://localhost/api/v1/injectgenericas/test1.html";

				should.exist(window);

				var virtualConsole = jsdom.getVirtualConsole(window);
				var consoleHistory = [];

				var hasFinished = false;

				var checkEndGame = function() {

					should.exist(window.$);
					
					var $ = window.$;
					$(".inlineGenerica").length.should.equal(4);

					finished();
				};

				virtualConsole.on("log", function(message) {
					consoleHistory.push(message);
					//console.log(message);
					if (message.indexOf("LB: Done loading substances") > -1 && !hasFinished) {
						hasFinished = true;
						
						checkEndGame();
					}
				});
								
				window.addEventListener("load", function(event) {
					
					setTimeout(function() {

						if (!hasFinished) {

							console.error("Took too long, log: ", consoleHistory.join("\n"));

							hasFinished = true;
							
							checkEndGame();
							
						}
					}, 15000);
					
					
				});
			});

		});


	});
});

