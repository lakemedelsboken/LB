(function() {
	var async = require("async");
	var fs = require("fs");
	var request = require('request');
	var pd = require('pretty-data').pd;
	var cheerio = require("cheerio");

	module.exports = {
		fetch: function (callback) {
			var self = this;

			//Iterate all products and see which ones belong to APL
			atcTreePath = __dirname + "/../../atcTree.json";

			if (fs.existsSync(atcTreePath)) {
				var atcTree = JSON.parse(fs.readFileSync(atcTreePath, "utf8"));

				//Remove non products
				var products = atcTree.filter(function(element) {
					return (element.type === "product");
				});

				var counter = 0;
				var foundAPLProducts = [];

				for (var i = 0; i < products.length; i++) {
					var product = products[i];

					if (product.title !== undefined && product.title.indexOf("(APL)") > -1) {
						counter++;
						foundAPLProducts.push(product);
					}

				}

				//foundAPLProducts = [{id: "20030804001211"}];

				console.log("Found " + counter + " products from APL");

				var spcCounter = 0;

				var q = async.queue(self.updateAPLProduct, 1);

				q.drain = function() {
				    console.log("All items have been processed, found " + spcCounter + " SPC:s from " + foundAPLProducts.length + " possible products.");

					//Write new atcTree.json
					fs.writeFileSync(__dirname + "/../../atcTree.json", JSON.stringify(atcTree, null, "\t"), "utf8");

					if (callback !== undefined && typeof callback === "function") {
						return callback();
					}

				};

				q.push(foundAPLProducts, function(err, id) {
					if (err) {
						console.log(err);
					} else if (id !== undefined) {
						spcCounter++;
						var foundProduct = false;
						for (var i = 0; i < atcTree.length; i++) {
							if (atcTree[i].id === id) {
								foundProduct = true;
								console.log("Successfully updated " + atcTree[i].title);
								break;
							}
						}

						if (!foundProduct) {
							console.log("ERROR: Could not find product for id: " + id);
						}
					}
				});

				if (foundAPLProducts.length === 0) {
					if (callback !== undefined && typeof callback === "function") {
						return callback();
					}
				}


			} else {
				console.log("Could not find newATCTree.json in function updateFromAPL - updateFromNplService.js");
				if (callback !== undefined && typeof callback === "function") {
					return callback();
				}
			}

		},

		updateAPLProduct: function (stub, callback) {

			var url = "https://www.apl.se/Sv/vard/extempore/_vti_bin/APLRestService.svc/Produkter/" + stub.id + "/spc";
			var options = {
				rejectUnauthorized: false,
				url: url,
				headers: {
					'Accept': 'application/xml'
				}
			};

			request(options, function (error, response, body) {
				if (!error && response.statusCode == 200) {

					//Pre parse output
					body = body.replace(/\<linebreak \/\>/g, "<br/>");
					body = body.replace(/paragraph/g, "p");
					body = body.replace(/<emphasis>/g, "<em>");
					body = body.replace(/<\/emphasis>/g, "</em>");
					body = body.replace(/<item>/g, "<li>");
					body = body.replace(/<\/item>/g, "</li>");
					body = body.replace(/<unorderedlist>/g, "<ul>");
					body = body.replace(/<\/unorderedlist>/g, "</ul>");
					body = body.replace(/<orderedlist>/g, "<ol>");
					body = body.replace(/<\/orderedlist>/g, "</ol>");
					body = body.replace(/<underline>/g, "<u>");
					body = body.replace(/<\/underline>/g, "</u>");
					body = body.replace(/<table>/g, "<table class=\"table table-bordered\">");
					body = body.replace(/<spc>/g, "<body>");
					body = body.replace(/<\/spc>/g, "</body>");
					body = body.replace(/<dateContent>/g, "");
					body = body.replace(/<\/dateContent>/g, "");

					//console.log(pd.xml(body));

					var $ = cheerio.load(body);

					var name = $("name").first().html();
					var composition = $("composition-text").first().html();
					var excipientsReference = $("excipients-reference").first().html();

					if (excipientsReference === null) {
						excipientsReference = "";
					}

					composition += excipientsReference;
					var pharmaceuticalForm = $("pharmaceutical-form").first().html();
					var indication = $("indication").first().html();
					var dosage = $("dosage").first().html();
					var contraindication = $("contraindication").first().html();
					var caution = $("caution").first().html();
					var interaction = $("interaction").first().html();
					var pregnancyText = $("pregnancy-text").first().html();
					var breastfeedingText = $("breastfeeding-text").first().html();
					var driving = $("driving").first().html();
					var sideEffects = $("side-effects").first().html();
					var overDosage = $("overdosage").first().html();
					var pharmacodynamicText = $("pharmacodynamic-text").first().html();
					var pharmacoTherapeutic = $("pharmacotherapeutic").first().html();
					var atcCode = $("atc-code").first().html();
					var pharmacoKinetic = $("pharmacokinetic").first().html();
					var preclinicalInfo = $("preclinical-info").first().html();
					var excipients = $("excipients").first().html();
					var incompatibilities = $("incompatibilities").first().html();
					var shelfLife = $("shelf-life").first().html();
					var storage = $("storage").first().html();
					var containerProperties = $("container-properties").first().html();
					var handling = $("handling").first().html();
					var marketingAuthorizationHolder = $("marketing-authorization-holder").first().html();
					var marketingAuthorizationNumber = $("marketing-authorization-number").first().html();
					var authorizationRenewalDate = $("authorization-renewal-date").first().html();
					var revisionDate = $("revision-date").first().html();

					var sections = {
						"1 LÄKEMEDLETS NAMN": name,
						"2 KVALITATIV OCH KVANTITATIV SAMMANSÄTTNING": composition,
						"3 LÄKEMEDELSFORM": pharmaceuticalForm,
						"4.1 Terapeutiska indikationer": indication,
						"4.2 Dosering och administreringssätt": dosage,
						"4.3 Kontraindikationer": contraindication,
						"4.4 Varningar och försiktighet": caution,
						"4.5 Interaktioner med andra läkemedel och övriga interaktioner": interaction,
						"4.6 Graviditet och amning": "<h3>Graviditet</h3>" + pregnancyText + "<h3>Amning</h3>" + breastfeedingText,
						"4.7 Effekter på förmågan att framföra fordon och använda maskiner": driving,
						"4.8 Biverkningar": sideEffects,
						"4.9 Överdosering": overDosage,
						"5.1 Farmakodynamiska egenskaper": "<p>Farmakoterapeutisk grupp: " + pharmacoTherapeutic + "</p><p>ATC-kod: " + atcCode + "</p>" + pharmacodynamicText,
						"5.2 Farmakokinetiska egenskaper": pharmacoKinetic,
						"5.3 Prekliniska säkerhetsuppgifter": preclinicalInfo,
						"6.1 Förteckning över hjälpämnen": excipients,
						"6.2 Inkompatibiliteter": incompatibilities,
						"6.3 Hållbarhet": shelfLife,
						"6.4 Särskilda förvaringsanvisningar": storage,
						"6.5 Förpackningstyp och innehåll": containerProperties,
						"6.6 Särskilda anvisningar för destruktion och övrig hantering": handling,
						"7 TILLVERKARE AV RIKSLICENSEN": marketingAuthorizationHolder,
						"8 LÄKEMEDELSVERKETS DIARIENUMMER OCH DATUM FÖR BEVILJANDE AV RIKSLICENSEN": marketingAuthorizationNumber,
						"9 DATUM FÖR LÄKEMEDELSVERKETS ÖVERSYN AV PRODUKTRESUMÉN": authorizationRenewalDate,
						"10 DATUM FÖR SENASTE ADMINISTRATIVA REVISION": revisionDate
					};

					//Update the atc tree in memory
					stub.noinfo = false;
					if (indication !== undefined && indication !== null && indication.trim() !== "") {
						stub.indications = indication;
					}

					var productPath = __dirname + "/../../../fass/www/products/" + stub.id + ".json";

					//Write to the product information
					if (fs.existsSync(productPath)) {
						var productStub = JSON.parse(fs.readFileSync(productPath, "utf8"));
						if (productStub.noinfo !== undefined) {
							delete productStub.noinfo;
						}

						//Remove any error markers
						if (productStub.errors !== undefined) {
							delete productStub.errors;
						}

						productStub.sections = sections;
						productStub.provider = "APL";
						productStub.license = "Rikslicens";
						productStub.licenseLink = "http://www.lakemedelsverket.se/malgrupp/Halso---sjukvard/Forskrivning/Ex-temporeRikslicens/";

						var firstChar = "";
						if (productStub.name !== undefined && productStub.name.length > 0) {
							firstChar = productStub.name.substr(0,1).toUpperCase();
						}
						productStub.providerLink = "https://www.apl.se/Sv/vard/extempore/Sidor/alla.aspx?bokstav=" + firstChar + "#ProduktLista";
						fs.writeFileSync(productPath, JSON.stringify(productStub, null, "\t"), "utf8");
					}

					callback(null, stub.id);

				} else {

					var productPath = __dirname + "/../../../fass/www/products/" + stub.id + ".json";

					//Update product information
					if (fs.existsSync(productPath)) {

						var productStub = JSON.parse(fs.readFileSync(productPath, "utf8"));

						//Third time with error, remove from listings
						if (productStub.errors !== undefined && productStub.errors >= 2 && productStub.noinfo !== true) {

							console.log(productStub.id + " has failed to update, marking as not available.");

							//Set noinfo to true in atcTree
							stub.noinfo = true;

							//Mark it with no information
							productStub.noinfo = true;

							//Remove sections
							if (productStub.sections !== undefined) {
								delete productStub.sections;
							}

							//Remove counter errors
							if (productStub.errors !== undefined) {
								delete productStub.errors;
							}

						} else if (productStub.noinfo !== true) {
							if (productStub.errors !== undefined) {
								//Add an error marker
								productStub.errors++;
							} else {
								//Add the first error marker
								productStub.errors = 1;
							}

							console.log(productStub.id + " has failed to update " + productStub.errors + " times.");

						}

						fs.writeFileSync(productPath, JSON.stringify(productStub, null, "\t"), "utf8");
					}


					if (error) {
						return callback(error);
					}

					if (response) {
						//console.log(response);
					}

					//callback(new Error("The SPC for " + stub.id + " could not be found."), stub.id);
					callback();
				}
			});
		}
	};
}());
