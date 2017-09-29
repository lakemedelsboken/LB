var fs = require("fs");
var cheerio = require("cheerio");
var contentModel = require("../models/contentmodel.js");
var path = require("path");
var imageController = require("../controllers/imagecontroller.js");
var wrench = require("wrench");
var async = require("async");

var masterIndex = {
	"A1": {"division": "Akutmedicin", "name": "Den akut medvetslöse patienten"},
	"A2": {"division": "Akutmedicin", "name": "Chock"},
	"A3": {"division": "Akutmedicin", "name": "Anafylaxi"},
	"A4": {"division": "Akutmedicin", "name": "Akutmedicin på vårdcentral och andra vårdenheter"},
	"A5": {"division": "Akutmedicin", "name": "Akuta svåra infektioner – initial behandling"},
	"A6": {"division": "Akutmedicin", "name": "Förgiftningar – Antidotbehandling"},
	"B1": {"division": "Mage - Tarm", "name": "Sjukdomar i matstrupe, magsäck och tolvfingertarm"},
	"B2": {"division": "Mage - Tarm", "name": "Leversjukdomar"},
	"B3": {"division": "Mage - Tarm", "name": "Gallvägs- och pankreassjukdomar"},
	"B4": {"division": "Mage - Tarm", "name": "Inflammatoriska tarmsjukdomar"},
	"B5": {"division": "Mage - Tarm", "name": "Tarmkanalens funktionsrubbningar"},
	"B6": {"division": "Mage - Tarm", "name": "Infektioner i mag-tarmkanalen"},
	"B7": {"division": "Mage - Tarm", "name": "Kolorektala sjukdomar"},
	"C1A": {"division": "Pediatrik", "name": "Krav vid utveckling av läkemedel till barn"},
	"C1B": {"division": "Pediatrik", "name": "Läkemedelsbehandling till barn"},
	"C1": {"division": "Pediatrik", "name": "Vanliga problem under småbarnsåren"},
	"C1C": {"division": "Pediatrik", "name": "Vaccination av barn och ungdomar"},
	"C2": {"division": "Nutrition", "name": "Övervikt och fetma"},
	"C3": {"division": "Nutrition", "name": "Vitaminer, mineraler och spårämnen"},
	"C4": {"division": "Nutrition", "name": "Enteral och parenteral nutrition"},
	"V2": {"division": "Nutrition", "name": "Läkemedelstillförsel till patienter med enteral nutrition"},
	"D1": {"division": "Blod", "name": "Anemier"},
	"D2": {"division": "Blod", "name": "Venös tromboembolism och medel mot trombos"},
	"D3": {"division": "Blod", "name": "Blödningstillstånd"},
	"E1": {"division": "Hjärta - Kärl", "name": "Ischemisk hjärtsjukdom"},
	"E2": {"division": "Hjärta - Kärl", "name": "Hjärtsvikt"},
	"E3": {"division": "Hjärta - Kärl", "name": "Hjärtrytmrubbningar"},
	"E4": {"division": "Hjärta - Kärl", "name": "Blodfettsrubbningar"},
	"E5": {"division": "Hjärta - Kärl", "name": "Hypertoni"},
	"E6": {"division": "Hjärta - Kärl", "name": "Cerebrovaskulära sjukdomar"},
	"E7": {"division": "Hjärta - Kärl", "name": "Perifera artärsjukdomar"},
	"F1": {"division": "Hud", "name": "Hudsjukdomar"},
	"F2": {"division": "Hud", "name": "Bensår, fotsår hos diabetiker och trycksår"},
	"G1": {"division": "Nefrologi - Urologi", "name": "Sten- och tumörsjukdomar i urinvägarna"},
	"G2": {"division": "Nefrologi - Urologi", "name": "Urininkontinens"},
	"G3": {"division": "Nefrologi - Urologi", "name": "Urinvägsinfektioner"},
	"G4": {"division": "Nefrologi - Urologi", "name": "Njursjukdomar"},
	"G5": {"division": "Nefrologi - Urologi", "name": "Sjukdomar i manliga genitalia"},
	"H1": {"division": "Sexuellt överförbara sjukdomar", "name": "Sexuellt överförbara sjukdomar"},
	"I1-2": {"division": "Gynekologi", "name": "Sjukdomar och läkemedel under graviditet och amning"},
	"I3": {"division": "Gynekologi", "name": "Allmän gynekologi"},
	"I4": {"division": "Gynekologi", "name": "Antikonception och aborter"},
	"J1": {"division": "Onkologi", "name": "Farmakologisk behandling av maligna tumörer"},
	"J2": {"division": "Onkologi", "name": "Hematologiska maligniteter"},
	"J3": {"division": "Onkologi", "name": "Sjukdomar i bröstkörteln"},
	"J4": {"division": "Onkologi", "name": "Lungcancer"},
	"K1": {"division": "Endokrinologi", "name": "Diabetes mellitus"},
	"K2A": {"division": "Endokrinologi", "name": "Osteoporos och frakturprevention"},
	"K2B": {"division": "Endokrinologi", "name": "Rubbningar i kalciumomsättningen"},
	"K3": {"division": "Endokrinologi", "name": "Tyreoideasjukdomar"},
	"K4": {"division": "Endokrinologi", "name": "Kortikosteroider och hypofyshormoner"},
	"L1": {"division": "Antibiotika och reseprofylax", "name": "Antibiotika och resistens"},
	"L2": {"division": "Antibiotika och reseprofylax", "name": "Råd och profylax vid resa"},
	"M1": {"division": "Andningsvägar", "name": "Astma och KOL"},
	"M2": {"division": "Andningsvägar", "name": "Luftvägsinfektioner hos barn och vuxna"},
	"M3": {"division": "Andningsvägar", "name": "Tuberkulos"},
	"N1": {"division": "Andningsvägar", "name": "Öron-, näs- och halssjukdomar"},
	"N2": {"division": "Andningsvägar", "name": "Munhålans sjukdomar"},
	"O1": {"division": "Ögon", "name": "Ögonsjukdomar"},
	"P1": {"division": "Allergiska och immunologiska tillstånd", "name": "Allergiska och immunologiska tillstånd"},
	"P1A": {"division": "Allergiska och immunologiska tillstånd", "name": "Transplantationsimmunologi och organtransplantationer"},
	"P2": {"division": "Rörelseapparaten", "name": "Reumatiska sjukdomar"},
	"P3": {"division": "Rörelseapparaten", "name": "Rygg- och nackbesvär"},
	"Q1": {"division": "Smärta", "name": "Smärta och smärtbehandling"},
	"Q2": {"division": "Smärta", "name": "Palliativ vård"},
	"R1": {"division": "Neurologi", "name": "Allmän neurologi och multipel skleros"},
	"R2": {"division": "Neurologi", "name": "Huvudvärk"},
	"R3": {"division": "Neurologi", "name": "Yrsel"},
	"R4": {"division": "Neurologi", "name": "Epilepsi"},
	"R5": {"division": "Neurologi", "name": "Parkinsons sjukdom"},
	"R6": {"division": "Neurologi", "name": "Porfyri och läkemedel"},
	"S1": {"division": "Psykiatri", "name": "Sömnstörningar"},
	"S2": {"division": "Psykiatri", "name": "Ångest och oro"},
	"S3": {"division": "Psykiatri", "name": "Förstämningssyndrom"},
	"S4": {"division": "Psykiatri", "name": "Ätstörningar"},
	"S5": {"division": "Psykiatri", "name": "Psykoser"},
	"S6": {"division": "Psykiatri", "name": "Utvecklings- och neuropsykiatriska störningar"},
	"S7": {"division": "Psykiatri", "name": "Demens"},
	"T1": {"division": "Beroendetillstånd", "name": "Tobaksberoende"},
	"T2": {"division": "Beroendetillstånd", "name": "Alkohol – riskbruk, missbruk och beroende"},
	"T3": {"division": "Beroendetillstånd", "name": "Narkotikaberoende"},
	"X2": {"division": "Läkemedelsanvändning", "name": "Kliniskt farmakologiska principer"},
	"Y1": {"division": "Läkemedelsanvändning", "name": "Läkemedelsbehandling hos äldre"},
	"V1": {"division": "Läkemedelsanvändning", "name": "Behandling med hyperbar oxygen (HBO)"},
	"U11": {"division": "Läkemedelsanvändning", "name": "Kostnadseffektivitetens betydelse vid prioritering av läkemedel"},
	"X1": {"division": "Läkemedelsanvändning", "name": "Evidensbaserad läkemedelsvärdering"},
	"X5": {"division": "Läkemedelsanvändning", "name": "Växtbaserade läkemedel och naturläkemedel"},
	"X3": {"division": "Läkemedelsanvändning", "name": "Läkemedelsbiverkningar"},
	"X7": {"division": "Läkemedelsanvändning", "name": "Läkemedel i miljön"},
	"X4": {"division": "Läkemedelsanvändning", "name": "Läkemedel hos personer med utvecklingsstörning"},
	"T4": {"division": "Läkemedelsanvändning", "name": "Doping inom idrotten och i samhället"},
	"U28": {"division": "Läkemedelsanvändning", "name": "Olagliga läkemedel"},
	"Y2": {"division": "Läkemedelsanvändning", "name": "Trafik, riskfyllt arbete och läkemedel"},
	"U19": {"division": "Regelverket och IT-stöd", "name": "Godkännande av läkemedel"},
	"U20": {"division": "Regelverket och IT-stöd", "name": "Läkemedelsförmånerna"},
	"U21": {"division": "Regelverket och IT-stöd", "name": "Receptskrivningsregler"},
	"U23": {"division": "Regelverket och IT-stöd", "name": "Särskilda läkemedel"},
	"U25": {"division": "Regelverket och IT-stöd", "name": "När godkända läkemedel saknas – licensförskrivning, extempore och andra alternativ"},
	"V3": {"division": "Regelverket och IT-stöd", "name": "Dosdispenserade läkemedel"}, 
	"U7": {"division": "Regelverket och IT-stöd", "name": "Den gemensamma elektroniska patientjournalen"},
	"U27": {"division": "Regelverket och IT-stöd", "name": "Elektronisk recepthantering"},
	"U26": {"division": "Regelverket och IT-stöd", "name": "Läkemedelsförteckningen"}
};

//var oldChapterPath = __dirname + "/../../_site/chapters/l2_inf_reseprofylax_2013fm10.html";
//var oldChapterPath = __dirname + "/../../_site/chapters/b2_mag_lever_2013fm10.html";
//var oldChapterPath = __dirname + "/../../_site/chapters/g4_nef_njursjukdomar_2013fm10.html";
//var oldChapterPath = __dirname + "/../../_site/chapters/r5_neu_parkinson_2013fm10.html";
//var oldChapterPath = __dirname + "/../../_site/chapters/a1_aku_akutmedv_2013fm10.html";
//var oldChapterPath = __dirname + "/../../_site/chapters/b1_mag_strupesacktarm_2013fm10.html";
//var oldChapterPath = __dirname + "/../../_site/chapters/p2_ror_reumsjukdom_2013fm10.html";

var $;
var savedText = [];


var q = async.queue(function (contentPath, callback) {
    
	migrateChapter(contentPath, function(err, data) {
		if (err) {
			console.log(err);
			return callback(err);
		} else {
			
			//console.log("All done: " + data);
			callback(null, data);
		}
	});

}, 1);


// assign a callback
q.drain = function() {
    console.log('All items have been processed');
}

// add some items to the queue

var files = fs.readdirSync(__dirname + "/../../_site/chapters/");
files = files.filter(function(item) {
	return (
		item.indexOf(".html") > -1 &&
		item.indexOf("_") > -1
//		item.indexOf("a5") > -1
	);
});


for (var i = 0; i < files.length; i++) {

	q.push(__dirname + "/../../_site/chapters/" + files[i], function(err, contentPath) {
		//if (err)
	    console.log('Finished processing ' + contentPath);
	});

}

function migrateChapter(oldChapterPath, callback) {

	//console.log(oldChapterPath);

	var oldPageName = oldChapterPath.split("/").pop().replace(".html", "");
	
	var chapterIdentifier = oldPageName.split("_")[0].toUpperCase();

	var index = masterIndex[chapterIdentifier];
	var chapterDivision = index.division.toLowerCase();
	
	chapterDivision = chapterDivision.replace(/å/g, "a").replace(/ä/g, "a").replace(/ö/g, "o").replace(/–/g, "-").replace(/\s-\s/g, "-").replace(/\s+/g, "_").replace(/\,/g, "").replace(/([^a-z0-9_]+)/gi, '-');
	var niceChapterName = index.name;
	var chapterName = index.name.toLowerCase();
	chapterName = chapterName.replace(/å/g, "a").replace(/ä/g, "a").replace(/ö/g, "o").replace(/–/g, "-").replace(/\s-\s/g, "-").replace(/\s+/g, "_").replace(/\,/g, "").replace(/([^a-z0-9_]+)/gi, '-');
	
	chapterName = chapterName + ".json";
	var chapterDir = "/kapitel/" + chapterDivision + "/";
	
	//TODO: Create dir
	var dir = path.join(contentModel.baseDir, chapterDir);
	
	//return callback(null, dir);
	
	wrench.mkdirSyncRecursive(dir, 0777);
	
	var newPath = chapterDir + chapterName;
	
	//return callback(null, newPath);

	//Create page

	//console.log("Checking: " + newPath);
	contentModel.existsContent(newPath, function(err, exists) {

		if (err) {
			callback(err);
		} else {
			if (exists) {
				contentModel.removePage(newPath, function(err) {
					if (err) {
						callback(err);
					} else {
						contentModel.createPage(chapterName, "chapter", chapterDir, function(err) {

							if (err) {
								callback(err);
							} else {
								var content = migrate(oldChapterPath);

								contentModel.getContent(newPath, function(err, data) {
									
									if (err) {
										callback(err);
									} else {
										data.title = niceChapterName + " | Läkemedelsboken";

										//Find author names
										var authors = [];
										for (var i = 0; i < content.length; i++) {
											var item = content[i];
											if (item.type === "author") {
												authors.push(item);
											}
										}

										var authorNames = [];
										if (authors.length > 0) {
											for (var i = 0; i < authors.length; i++) {
												var author = authors[i];
												authorNames.push(author.content.firstname + " " + author.content.surname);
											}
										}
										
										if (authorNames.length > 0) {
											data.createdBy = authorNames.join(", ");
										}

										data.content = content;
										data.components.leftcolumn.content = "/components/default-left-menu.json";
									
										data.replacesUrl = "/" + oldChapterPath.split("/").pop();
									
										contentModel.setContent(newPath, data, false, function(err) {


											if (err) {
												return callback(err);
											}
										
											contentModel.publishPage(newPath, function(err) {

												if (err) {
													return callback(err);
												} else {
													return callback(null, newPath);
												}
											});
										});
									}
								});
							
							}
						});
					}
				});
			} else {
				contentModel.createPage(chapterName, "chapter", chapterDir, function(err) {
					if (err) {
						callback(err);
					} else {
						var content = migrate(oldChapterPath);

						contentModel.getContent(newPath, function(err, data) {
							if (err) {
								callback(err);
							} else {
								data.title = niceChapterName + " | Läkemedelsboken";

								//Find author names
								var authors = [];
								for (var i = 0; i < content.length; i++) {
									var item = content[i];
									if (item.type === "author") {
										authors.push(item);
									}
								}

								var authorNames = [];
								if (authors.length > 0) {
									for (var i = 0; i < authors.length; i++) {
										var author = authors[i];
										authorNames.push(author.content.firstname + " " + author.content.surname);
									}
								}
								
								if (authorNames.length > 0) {
									data.createdBy = authorNames.join(", ");
								}

								data.content = content;
								data.components.leftcolumn.content = "/components/default-left-menu.json";

								data.replacesUrl = "/" + oldChapterPath.split("/").pop();

								contentModel.setContent(newPath, data, false, function(err) {
									if (err) {
										return callback(err);
									}
									contentModel.publishPage(newPath, function(err) {
										if (err) {
											return callback(err);
										} else {
											return callback(null, newPath);
										}
									});
								
								});
							}
						});

					}
				});
			}
		}

	});
} 

function migrate(oldPath) {

	console.log("Migrating content: " + path.normalize(oldPath));

	var oldChapterContent = fs.readFileSync(oldPath, "utf8");

	$ = cheerio.load(oldChapterContent);

	//Switch icons
	$("i.icon-arrow-right.icon-white").each(function(index, element) {
		$(this).attr("class", "fa fa-arrow-right fa-white");
	});

	var main = $("div#main");
	
	//Remove loading indicator
	main.find("#loading").remove();
	
	//Remove the summary
	var summaryHeader = null;
	main.find("h2").each(function(index, element) {
		if ($(element).text().indexOf("Terapirekommendationer / Faktarutor etc.") > -1) {
			summaryHeader = $(element);
			return false;
		}
	});
	//var summaryHeader =  main.find("h2").first();
	
	if (summaryHeader !== null) {
		var summary = summaryHeader.next();
	
		summary.remove();
		summaryHeader.remove();
	}
	
	var allContent = [];

	//Find the authors
	var authors = $("p.authors").first().html();
	
	//Remove from DOM
	$("p.authors").remove();
	
	//Remove disclosure from DOM
	$("div.authorsDisclosure").remove();
	
	authors = authors.split("<br>");
	
	for (var i = 0; i < authors.length; i++) {
		var author = authors[i].trim();
		
		if (author.length > 0) {

			//Keep foot notes and reference links, convert to pure text
			author = $(translateHtml("<p>" + author + "</p>")).text().trim();

			var firstName = "";
			var surName = "";
			var name = "";
			var description = "";
			
			if (author.indexOf(",") > -1) {
				var authorParts = author.split(",");
				name = authorParts.shift().trim();
				description = authorParts.join(",").trim();
				
			} else {
				name = author.trim();
			}
			
			if (name !== "") {
				if (name.indexOf(" ") > -1) {
					name = name.split(" ");
					firstName = name.shift().trim();
					surName = name.join(" ").trim()
				}
				
				//Save the author
				//console.log("\"" + firstName + "\" \"" + surName + "\", \"" + description + "\"");
				
				var name = contentModel.getGUID();
	
				//Load template for type
				var contentTypes = contentModel.getContentTypes();
				var contentType = contentTypes["author"].getDefaultType();

				if (contentType === undefined) {
					throw new Error("Content type: author does not exist.");
				}

				contentType.id = name;
				contentType.name = name;
				
				contentType.content.firstname = firstName;
				contentType.content.surname = surName;
				contentType.content.description = description;
				
				allContent.push(contentType);
				
			}
		}
	}
	

	var nodes = main.contents();

	nodes.each(function(index, item) {

		if (item.type === "text") {

			item.data = item.data.replace(/\n/g, "").replace(/\t/g, "").replace(/\r/g, "");

			if (item.data.length > 0) {
				savedText.push(translateHtml($("<span class=\"remove\">" + item.data + "</span>")));
			}

		} else if (item.type === "tag") {

			var $item = $(item);

			if ($item.hasClass("narrow")) {

				saveText(allContent);
				allContent.push(getTableNarrow($item));

			} else if ($item.hasClass("facts")) {

				saveText(allContent);
				allContent.push(getFacts($item));

			} else if ($item.hasClass("references") && $item[0].name === "ol") {

				saveText(allContent);
				allContent.push(getReferences($item));

			} else if ($item.hasClass("wide")) {

				saveText(allContent);
				allContent.push(getTableWide($item));

			} else if ($item.hasClass("figure")) {

				saveText(allContent);
				allContent.push(getFigure($item));

			} else if ($item.hasClass("therapy-recommendations")) {

				saveText(allContent);
				allContent.push(getTherapy($item));

			} else if ($item.hasClass("pageFootnote")) {

				saveText(allContent);
				allContent.push(getPageFootnote($item));

			} else {
			
				//console.log($item[0].name);
			
				var footNotes = null;

				if ($item.find(".pageFootnote").length > 0) {
					//Get the foot notes
					footNotes = $item.find(".pageFootnote");
					//Remove them from the current context
					$item.find(".pageFootnote").remove();
				}

				savedText.push(translateHtml($.html($item)));

				if (footNotes !== null && footNotes.length > 0) {
					saveText(allContent);

					footNotes.each(function(i, e) {
						//Save each foot note
						allContent.push(getPageFootnote($(this)));
					})
				}

			}
			
		} else {
			console.log("Unknown item: ", item);
		}

	});
	
	saveText(allContent);
	
	savedText = [];
	
	return allContent;
}

function saveText(allContent) {
	if (savedText.length > 0) {
		var allText = savedText.join("");
		savedText = [];

		var name = contentModel.getGUID();
	
		//Load template for type
		var contentTypes = contentModel.getContentTypes();
		var contentType = contentTypes["text"].getDefaultType();

		if (contentType === undefined) {
			throw new Error("Content type: " + contentTypeName + " does not exist.");
		}

		contentType.id = name;
		contentType.name = name;
		contentType.content = allText;
		
		allContent.push(contentType);

	}
}

function getReferences($item) {
	var name = contentModel.getGUID();
	
	//Load template for type
	var contentTypes = contentModel.getContentTypes();
	var contentType = contentTypes["references"].getDefaultType();

	if (contentType === undefined) {
		throw new Error("Content type: references does not exist.");
	}

	contentType.id = name;
	contentType.name = name;
	
	var itemsHtml = "";
	
	$item.find("li").each(function(index, element) {
		itemsHtml += "<li id=\"reference_" + (index + 1) + "\">" + $(this).html() + "</li>\n";
	});
	
	contentType.content = "<ol class=\"references\">" + itemsHtml + "</ol>";
	
	return contentType;
}

function getFigure($item) {

	var name = contentModel.getGUID();
	
	//Load template for type
	var contentTypes = contentModel.getContentTypes();
	var contentType = contentTypes["figure"].getDefaultType();

	if (contentType === undefined) {
		throw new Error("Content type: figure does not exist.");
	}

	contentType.id = name;
	contentType.name = name;

	var number = parseInt($item.attr("id").replace("figure_", ""));
	contentType.content.number = number;

	var id = $item.find("h4").first().attr("id");
	contentType.content.id = id;
	
	var text = translateHtml($item.find("p.figureText").html());
	contentType.content.text = text;

	//Move images around
	var image = $item.find("div.figureImage").first().find("div").first().attr("data-src").replace("/opt/", "/").replace("_small", "")
	
	var currentBaseImagePath = path.join(__dirname, "..", "..", "_site", "chapters", image);

	contentType.content.image = "/images/" + image;

	//Copy the image to /images/[image]
	var splitImagePath = image.split(path.sep);
	splitImagePath.pop();
	var dirOfImage = splitImagePath.join(path.sep);
	
	var dirToCreate = path.join(imageController.baseDir, "images", dirOfImage);
	
	wrench.mkdirSyncRecursive(dirToCreate, 0777);
	
	var targetFile = path.join(imageController.baseDir, "images", image);
	
	fs.writeFileSync(targetFile, fs.readFileSync(currentBaseImagePath));

	var outputDir = path.join(imageController.baseDir, "..", "output", "static", "images", image);

	wrench.mkdirSyncRecursive(outputDir, 0777);
	
	//Resize
	imageController.createImageSizes(targetFile, outputDir, false, function(err){
		if (err) {
			console.log(err);
		}
	});
	
	return contentType;
}


function getPageFootnote($item) {

	var name = contentModel.getGUID();
	
	//Load template for type
	var contentTypes = contentModel.getContentTypes();
	var contentType = contentTypes["pagefootnote"].getDefaultType();

	if (contentType === undefined) {
		throw new Error("Content type: pagefootnote does not exist.");
	}

	contentType.id = name;
	contentType.name = name;

	var number = parseInt($item.find("legend").first().text().replace("Fotnot ", ""));
	
	if (number === undefined) {
		number = 1;
	}

	contentType.content.number = number;
	
	var text = "";

	//Remove the legend from the text
	$item.find("legend").first().remove();
	
	text = translateHtml($item.html());
	
	contentType.content.text = text;
	
	return contentType;
}


function getTherapy($item) {

	var name = contentModel.getGUID();
	
	//Load template for type
	var contentTypes = contentModel.getContentTypes();
	var contentType = contentTypes["therapy"].getDefaultType();

	if (contentType === undefined) {
		throw new Error("Content type: therapy does not exist.");
	}

	contentType.id = name;
	contentType.name = name;

	//The title is the second h4
	var title = $item.find("h4").first();
	var id = "";

	var number = parseInt($item.find("table").first().attr("id").replace("therapy_", ""));
	
	if (number === undefined) {
		number = 1;
	}

	contentType.content.number = number;
	
	if (title.length === 0) {
		title = "";
	} else {
		id = $(title).attr("id");
		title = translateHtml($(title).html().replace("Terapirekommendationer – ", ""));
	}

	contentType.content.title = title;
	contentType.content.id = id;

	var table = $item.find("table").first();
	table.find("tr").first().remove();
	
	var hasTableBody = (table.find("tbody").first().length === 1);

	var text = "";
	
	if (hasTableBody) {
		text = "<table>" + translateHtml(table.html()) + "</table>";
	} else {
		text = "<table><tbody>" + translateHtml(table.html()) + "</tbody></table>";
	}
	
	contentType.content.text = text;
	
	return contentType;
}

function getTableNarrow($item) {

	var name = contentModel.getGUID();
	
	//Load template for type
	var contentTypes = contentModel.getContentTypes();
	var contentType = contentTypes["tablenarrow"].getDefaultType();

	if (contentType === undefined) {
		throw new Error("Content type: tablenarrow does not exist.");
	}

	contentType.id = name;
	contentType.name = name;

	//The title is the second h4
	var title = $item.find("h4").first();
	var id = "";

	var number = parseInt($item.find("table").first().attr("id").replace("table_", ""));
	
	if (number === undefined) {
		number = 1;
	}

	contentType.content.number = number;
	
	if (title.length === 0) {
		title = "";
	} else {
		id = $(title).attr("id");
		title = translateHtml($(title).html().replace("Tabell " + number + ". ", ""));
	}

	contentType.content.title = title;
	contentType.content.id = id;


	var table = $item.find("table").first();
	table.find("tr").first().remove();
	//table.find("h4").first().remove();
	
	var hasTableBody = (table.find("tbody").first().length === 1);

	var text = "";
	
	if (hasTableBody) {
		text = "<table>" + translateHtml(table.html()) + "</table>";
	} else {
		text = "<table><tbody>" + translateHtml(table.html()) + "</tbody></table>";
	}
	
	contentType.content.text = text;
	
	return contentType;
}

function getTableWide($item) {

	var name = contentModel.getGUID();
	
	//Load template for type
	var contentTypes = contentModel.getContentTypes();
	var contentType = contentTypes["tablewide"].getDefaultType();

	if (contentType === undefined) {
		throw new Error("Content type: tablewide does not exist.");
	}

	contentType.id = name;
	contentType.name = name;

	//The title is the second h4
	var title = $item.find("h4").first();
	var id = "";

	var number = parseInt($item.find("table").first().attr("id").replace("table_", ""));
	
	if (number === undefined) {
		number = 1;
	}

	contentType.content.number = number;
	
	if (title.length === 0) {
		title = "";
	} else {
		id = $(title).attr("id");
		title = translateHtml($(title).html().replace("Tabell " + number + ". ", ""));
	}

	contentType.content.title = title;
	contentType.content.id = id;


	var table = $item.find("table").first();
	table.find("tr").first().remove();
	//table.find("h4").first().remove();
	
	var hasTableBody = (table.find("tbody").first().length === 1);

	var text = "";
	
	if (hasTableBody) {
		text = "<table>" + translateHtml(table.html()) + "</table>";
	} else {
		text = "<table><tbody>" + translateHtml(table.html()) + "</tbody></table>";
	}
	
	contentType.content.text = text;
	
	return contentType;
}


function getFacts($item) {
	var name = contentModel.getGUID();
	
	//Load template for type
	var contentTypes = contentModel.getContentTypes();
	var contentType = contentTypes["facts"].getDefaultType();

	if (contentType === undefined) {
		throw new Error("Content type: facts does not exist.");
	}

	contentType.id = name;
	contentType.name = name;

	//The title is the second h4
	var title = $item.find("h4").eq(1);
	var id = "";
	
	if (title.length === 0) {
		title = "";
	} else {
		id = $(title).attr("id");
		title = translateHtml($(title).html());
	}

	contentType.content.title = title;
	contentType.content.id = id;

	var number = parseInt($item.find("table").first().attr("id").replace("facts_", ""));
	
	if (number === undefined) {
		number = 1;
	}

	contentType.content.number = number;

	var table = $item.find("table").first();
	table.find("tr").first().remove();
	table.find("h4").first().remove();
	
	var hasTableBody = (table.find("tbody").first().length === 1);

	var text = "";
	
	if (hasTableBody) {
		text = "<table>" + translateHtml(table.html()) + "</table>";
	} else {
		text = "<table><tbody>" + translateHtml(table.html()) + "</tbody></table>";
	}
	
	contentType.content.text = text;
	
	return contentType;
}

function translateHtml(html) {

	var _$ = cheerio.load(html);

	//Remove anchors around inline generica names and other links
	_$(".inlineGenerica, .factsLink, .figureLink, .tableLink").each(function() {
		_$(this).replaceWith(_$(this).text());
	});

	//Reference
	_$(".inlineReference").each(function() {
		_$(this).replaceWith("(" + _$(this).attr("data-referencenumber") + ")");
	});

	//Internal link
	_$(".pageLink").each(function() {

		var oldHref = _$(this).attr("href");

		if (oldHref.indexOf(".html") > -1) {

			var oldPageName = oldHref.split("/").pop().split(".html")[0];

			var chapterIdentifier = oldPageName.split("_")[0].toUpperCase();

			var index = masterIndex[chapterIdentifier];

			if (index !== undefined) {

				var chapterDivision = index.division.toLowerCase();

				chapterDivision = chapterDivision.replace(/å/g, "a").replace(/ä/g, "a").replace(/ö/g, "o").replace(/–/g, "-").replace(/\s-\s/g, "-").replace(/\s+/g, "_").replace(/\,/g, "").replace(/([^a-z0-9_]+)/gi, '-');
				var niceChapterName = index.name;
				var chapterName = index.name.toLowerCase();
				chapterName = chapterName.replace(/å/g, "a").replace(/ä/g, "a").replace(/ö/g, "o").replace(/–/g, "-").replace(/\s-\s/g, "-").replace(/\s+/g, "_").replace(/\,/g, "").replace(/([^a-z0-9_]+)/gi, '-');

				chapterName = chapterName + ".html";
		
				var slug = oldHref.split(".html");
				if (slug.length === 2) {
					slug = slug.pop();
				} else {
					slug = "";
				}
		
				var newHref = "/kapitel/" + chapterDivision + "/" + chapterName + slug;
		
				_$(this).attr("href", newHref);
			
			} else {
				console.log("Could not find index for: " + oldHref); 
			}
			
		}

	});

	//Page foot note item
	_$(".pageFootnoteItem").each(function() {
		_$(this).replaceWith("[" + _$(this).find("sup.hiddenNoteNumber").first().text() + "]");
	});

	_$("span.remove").each(function() {
		_$(this).replaceWith(_$(this).html());
	});

	return _$.html();
}

