var fs = require("fs");
var async = require("async");
var wrench = require("wrench");
var path = require("path");

RegExp.quote = function(str) {
	return str.replace(/([.?*+^$[\]\\(){}-])/g, "\\$1");
};

var argv = require("optimist")
    .usage('Parse Läkemedelsboken 2011-2012 from FrameMaker mif > mifml to html.\nUsage: $0')

    .demand('i')
    .alias('i', 'inputFile')
    .describe('i', 'Input mifml file')

    .default('f', false)
    .alias('f', 'forceImageResizing')
    .describe('f', 'Force images to be resized')

    .default('t', 'browser')
    .alias('t', 'outputType')
    .describe('t', 'Output type [iOS or browser, make sure templates exist in /parser/templates/{outputType}/]')
    .argv;

var sourceFilePath = argv.i;
var forcedImageResizing = argv.f;
var outputType = argv.t.toLowerCase();
var unhandledTags = {};
var handledTags = {};
var $ = null;
var factsNumbers = {};
var usedFactsNumbers = {};

var Parser = {
	isInitialized: false,
	tagHandlers: {},
	formatHandlers: {},
	genericas: null,
	html: [],
	fileName: null,
	chapterIdentifier: "",
	tocId: 0,
	pageFootNotesNumbers: {},
	counters: {
		referenceItems: 0,
		footnoteItems: 0,
		pageFootnoteItems: 0,
		tableFootnoteItems: 0,
		figureItems: 0,
		tableItems: 0,
		therapyItems: 0,
		factsItems: 0
	},
	renderedBoxes: {},
	xrefQueue: [],
	state: {
		tags: [],
		textflow: null,
		format: [],
		fontFormat: null,
		markerFormat: null,
		linkFormat: false,
		table: false,
		figure: false,
		tableFormatSection: false,
		furtherReading: false
	},
	resetState: function() {
		this.state = {
			hierarchy: [],
			textflow: null,
			format: null
		};
	},
	init: function() {
		this.initTagHandlers();
		this.initFormatHandlers();
		this.isInitialized = true;
	},
	initFormatHandlers: function() {
		var self = this;

/*		
		self.formatHandlers["a"] = {
			begin: function(tag, indentation) {
				var $tag = $(tag);
				var href = $tag.attr("href");
				var html = [];
				html.push(indentation + "<a");
				var attributes = {};
				$.each($tag.get(0).attributes, function(i, attrib){
					var name = attrib.name.toLowerCase();
					var value = attrib.value.toLowerCase();
					attributes[name] = value;
					//html.push("\n" + name.toLowerCase() + ": " + value.toLowerCase());
				});

				if (href !== "") {
				
					if (href.indexOf(self.fileName) > -1) {
						//Found link to self, keep the "#[nr]" part
						href = href.replace(self.fileName, "");
					}
				
					if (href.indexOf("#id(") > -1) {
						//Reference to an id
						var tempHref = href.split("#");
						href = tempHref[0];
						tempHref = tempHref[1].substr(3);
						href += "#" + tempHref.replace(")", "").toLowerCase();
					}
				
					html.push(" href=\"" + href + "\"");
				
				}
				if (attributes.hasOwnProperty("class")) {
					if (attributes["class"] === "url") {
						html.push(" class=\"urlLink\" target=\"_new\"");
					} else if (attributes["class"] === "footnote") {
						html.push(" class=\"footnote\"");
					} else if (attributes["class"] === "hypertext") {
						html.push(" class=\"inlineReference\"");
					}
				}

				if (attributes.hasOwnProperty("id")) {
					html.push(" id=\"" + attributes["id"] + "\"");
				}

				html.push(">");
				$.each($tag.get(0).attributes, function(i, attrib){
					var name = attrib.name;
					var value = attrib.value;
					//html.push("\n" + name.toLowerCase() + ": " + value.toLowerCase());
				});
			
				return html.join("");
			},
			end: function(tag, indentation) {
				return "</a>";
			}
		};
*/

		self.formatHandlers["avsnittsrub"] = {
			begin: function(tag, indentation) {
				return indentation + "<h1 class=\"remove\" id=\"" + self.chapterIdentifier + "_" + (++self.tocId) + "\">";
			},
			end: function(tag, indentation) {
				return "</h1>";
			}
		};

		self.formatHandlers["kaprub"] = {
			begin: function(tag, indentation) {
				return indentation + "<h1 id=\"" + self.chapterIdentifier + "_" + (++self.tocId) + "\">";
			},
			end: function(tag, indentation) {
				return "</h1>";
			}
		};

		self.formatHandlers["kaprub_första"] = self.formatHandlers["kaprub"];
		self.formatHandlers["kaprubnn"] = self.formatHandlers["kaprub"];
		self.formatHandlers["kaprubejih"] = self.formatHandlers["kaprub"];


		self.formatHandlers["title"] = {
			begin: function(tag, indentation) {
				return "";
			},
			end: function(tag, indentation) {
				return "";
			}
		};

		self.formatHandlers["authors"] = {
			begin: function(tag, indentation) {
				return indentation + "<p class=\"authors\">";
			},
			end: function(tag, indentation) {
				return "</p>";
			}
		};

		self.formatHandlers["image"] = {
			begin: function(tag, indentation) {
				return indentation + "<img src=\"images/" + $(tag).attr("href") + "\" />";
			},
			end: function(tag, indentation) {
				return "";
			}
		};

		self.formatHandlers["inledning"] = {
			begin: function(tag, indentation) {
				return indentation + "";
			},
			end: function(tag, indentation) {
				return "<h2 id=\"" + self.chapterIdentifier + "_" + (++self.tocId) + "\">Inledning</h2>";
			}
		};

		self.formatHandlers["ingress"] = {
			begin: function(tag, indentation) {
				return indentation + "<p class=\"ingress\">";
			},
			end: function(tag, indentation) {
				var result = "";

				return result + "</p>";
			}
		};

		self.formatHandlers["ingressIndent"] = {
			begin: function(tag, indentation) {
				return indentation + "<p class=\"ingress indent\">";
			},
			end: function(tag, indentation) {
				var result = "";

				return result + "</p>";
			}
		};

		self.formatHandlers["faktatextin"] = {
			begin: function(tag, indentation) {
				return indentation + "<p class=\"indent\">";
			},
			end: function(tag, indentation) {
				var result = "";

				return result + "</p>";
			}
		};

		self.formatHandlers["bread"] = {
			begin: function(tag, indentation) {
				return indentation + "<p>";
			},
			end: function(tag, indentation) {
				var result = "";
				
				return result + "</p>";
			}
		};

		self.formatHandlers["breadin"] = {
			begin: function(tag, indentation) {
				return indentation + "<p class=\"indent\">";
			},
			end: function(tag, indentation) {
				var result = "";
				return result + "</p>";
			}
		};

		self.formatHandlers["rub1"] = {
			begin: function(tag, indentation) {
				return indentation + "<h2 id=\"" + self.chapterIdentifier + "_" + (++self.tocId) + "\">";
			},
			end: function(tag, indentation) {
				return "</h2>";
			}
		};

		self.formatHandlers["rub2"] = {
			begin: function(tag, indentation) {
				return indentation + "<h3 id=\"" + self.chapterIdentifier + "_" + (++self.tocId) + "\">";
			},
			end: function(tag, indentation) {
				return "</h3>";
			}
		};

		self.formatHandlers["rub2efterrub1"] = {
			begin: function(tag, indentation) {
				return indentation + "<h3 id=\"" + self.chapterIdentifier + "_" + (++self.tocId) + "\">";
			},
			end: function(tag, indentation) {
				return "</h3>";
			}
		};

		self.formatHandlers["rub3"] = {
			begin: function(tag, indentation) {
				return indentation + "<h4 id=\"" + self.chapterIdentifier + "_" + (++self.tocId) + "\"><em>";
			},
			end: function(tag, indentation) {
				return "</em></h4>";
			}
		};

		self.formatHandlers["rub3efterrub2"] = {
			begin: function(tag, indentation) {
				return indentation + "<h4 id=\"" + self.chapterIdentifier + "_" + (++self.tocId) + "\"><em>";
			},
			end: function(tag, indentation) {
				return "</em></h4>";
			}
		};

		self.formatHandlers["faktarub2"] = {
			begin: function(tag, indentation) {
				return indentation + "<h5 id=\"" + self.chapterIdentifier + "_" + (++self.tocId) + "\">";
			},
			end: function(tag, indentation) {
				return "</h5>";
			}
		};
		
		self.formatHandlers["brödpunkt"] = {
			begin: function(tag, indentation) {

				var result = "";
				var listAlreadyStarted = false;
				var lastTag = "";

				if (self.html.length > 0) {
					lastTag = self.html[self.html.length - 1];
				}

				if (lastTag.indexOf("</ul>") > -1) {
					lastTag = lastTag.replace("</ul>", "");
					self.html.pop();
					self.html.push(lastTag);
					listAlreadyStarted = true;
				}
				
				//Find number
				var $tag = $(tag);
				var numString = $tag.nextAll("PgfNumString").first();
				
				if (numString.length === 1) {
					if (!listAlreadyStarted) {
						result += "<ul>";
					}
					var num = numString.attr("value").replace("\\t", "");
					if (num !== "•") {
						result += "<li class=\"nobullet\"><strong class=\"itemType\">" + num + " </strong>";
					} else {
						result += "<li>";
					}
					self.hasStartedOrderedList = true;
				} else {
					//Check for PgfIndent
					if ($tag.next()[0].name === "pgf") {
						var pgf = $tag.next();
						var pgfIndent = pgf.find("PgfFIndent, PgfLIndent");
						if (pgfIndent.length > 0) {
							var longest = 0;
							pgfIndent.each(function(i, e) {
								e = $(e);
								var length = parseInt(e.attr("value").replace(" mm", ""));
								if (self.isNumber(length) && length > longest) {
									longest = length;
								}
							});
							if (longest > 0) {
								//We have indentation
								result += "<ul class=\"indent\"><li class=\"nobullet\">";
							} else {
								result += "<ul><li>"
							}
						} else {
							result += "<ul><li>"
						}
					} else {
						result += "<ul><li>"
					}
					
				}
				return indentation + result;
			},
			end: function(tag, indentation) {
				return "</li></ul>";
			}
		};

		self.formatHandlers["brödpunktIndent"] = self.formatHandlers["brödpunkt"];
		self.formatHandlers["brödpunktsista"] = self.formatHandlers["brödpunkt"];
		self.formatHandlers["tabelltextpunkt"] = self.formatHandlers["brödpunkt"];
		self.formatHandlers["faktatextpunkt"] = self.formatHandlers["brödpunkt"];
		self.formatHandlers["brödpunktefterrubrik"] = self.formatHandlers["brödpunkt"];
		self.formatHandlers["brödpunktsistaIndent"] = self.formatHandlers["brödpunkt"];
		self.formatHandlers["tabelltextpunktIndent"] = self.formatHandlers["brödpunkt"];
		self.formatHandlers["faktatextpunktIndent"] = self.formatHandlers["brödpunkt"];
		self.formatHandlers["brödpunktefterrubrikIndent"] = self.formatHandlers["brödpunkt"];

		self.hasStartedOrderedList = false;

		self.formatHandlers["brödnr1"] = {
			begin: function(tag, indentation) {

				var result = "";
				var listAlreadyStarted = false;
				var lastTag = "";

				if (self.html.length > 0) {
					lastTag = self.html[self.html.length - 1];
					if (lastTag.length > 4 && lastTag.indexOf("<br>") === (lastTag.length - 4)) {
						self.html.pop();
						lastTag = lastTag.substr(0, lastTag.length - 4);
						self.html.push(lastTag);
						lastTag = self.html[self.html.length - 1];
					}
				}
				
				if (lastTag.indexOf("</ul>") > -1) {
					lastTag = lastTag.replace("</ul>", "");
					self.html.pop();
					self.html.push(lastTag);
					listAlreadyStarted = true;
				}
				
				
				//Find number
				var $tag = $(tag);
				var numString = $tag.nextAll("PgfNumString").first();
				
				if (numString.length === 1) {
					if (!listAlreadyStarted) {
						result += "<ul class=\"ordered\">";
					}
					result += "<li><strong class=\"itemType\">" + numString.attr("value").replace("\\t", "") + " </strong>";
					self.hasStartedOrderedList = true;
				}
				
				return indentation + result;
			},
			end: function(tag, indentation) {
				if (self.hasStartedOrderedList) {
					return "</li></ul>";
				} else {
					return "";
				}
			}
		};

		self.formatHandlers["brödnrforts"] = self.formatHandlers["brödnr1"];
		self.formatHandlers["brödnrfortssista"] = self.formatHandlers["brödnr1"];
		self.formatHandlers["faktatextnr1"] = self.formatHandlers["brödnr1"];
		self.formatHandlers["faktatextnrforts"] = self.formatHandlers["brödnr1"];
		

		self.formatHandlers["changenewtext"] = {
			begin: function(tag, indentation) {
				return indentation + "<span class=\"updated\">";
			},
			end: function(tag, indentation) {
				return "</span>";
			}
		};

		self.formatHandlers["refrub"] = {
			begin: function(tag, indentation) {
				return indentation + "<h2 id=\"" + self.chapterIdentifier + "_" + (++self.tocId) + "\">Referenser";
			},
			end: function(tag, indentation) {
				return "</h2>";
			}
		};

		self.formatHandlers["faktarub1"] = {
			begin: function(tag, indentation) {
				if (self.state.table && !self.state.tableFormatSection) {
					return indentation + "<h4 id=\"" + self.chapterIdentifier + "_" + (++self.tocId) + "\" class=\"facts skip\">";
				} else {
					return "";
				}
			},
			end: function(tag, indentation) {
				if (self.state.table && !self.state.tableFormatSection) {
					return "</h4>";
				} else {
					return "";
				}
			}
		};

		self.formatHandlers["tabellrekrub"] = {
			begin: function(tag, indentation) {
				if (self.state.table && !self.state.tableFormatSection) {
					return indentation + "<h4 id=\"" + self.chapterIdentifier + "_" + (++self.tocId) + "\" class=\"therapyRecommendations\">Terapirekommendationer – ";
				} else {
					return "";
				}
			},
			end: function(tag, indentation) {
				if (self.state.table && !self.state.tableFormatSection) {
					return "</h4>";
				} else {
					return "";
				}
			}
		};


		self.formatHandlers["tabellrubrik_1sp"] = {
			begin: function(tag, indentation) {
				if (self.state.table && !self.state.tableFormatSection) {
					//console.error("* Tabell " + self.counters.tableItems)
					var tableNumber = $(tag).parent().find("PgfNumString").attr("value");
					if (tableNumber === undefined) {
						tableNumber = "Tabell " + self.counters.tableItems + ". ";
					}
					return indentation + "<h4 id=\"" + self.chapterIdentifier + "_" + (++self.tocId) + "\" class=\"infoTable\">" + tableNumber;
				} else {
					return "";
				}
			},
			end: function(tag, indentation) {
				if (self.state.table && !self.state.tableFormatSection) {
					return "</h4>";
				} else {
					return "";
				}
			}
		};

		self.formatHandlers["tabellrubrik_2sp"] = self.formatHandlers["tabellrubrik_1sp"];

		/*
		self.formatHandlers["tabellrubrik_2sp"] = {
			begin: function(tag, indentation) {
				if (self.state.table && !self.state.tableFormatSection) {
					return indentation + "<h4 id=\"" + self.chapterIdentifier + "_" + (++self.tocId) + "\" class=\"infoTable\">Tabell " + self.counters.tableItems + " – ";
				} else {
					return "";
				}
			},
			end: function(tag, indentation) {
				if (self.state.table && !self.state.tableFormatSection) {
					return "</h4>";
				} else {
					return "";
				}
			}
		};
		*/
		
		self.formatHandlers["tabellkolrub"] = {
			begin: function(tag, indentation) {
				if (self.state.table && !self.state.tableFormatSection) {
					return indentation + "<strong>";
				} else {
					return "";
				}
			},
			end: function(tag, indentation) {
				if (self.state.table && !self.state.tableFormatSection) {
					return "</strong>";
				} else {
					return "";
				}
			}
		};

		self.formatHandlers["tabelltextfet"] = self.formatHandlers["tabellkolrub"];

		
		/*
		self.formatHandlers["reftextnr1list"] = {
			begin: function(tag, indentation) {
				return indentation + "<ol class=\"references\">";
			},
			end: function(tag, indentation) {
				return "</ol>";
			}
		};
		*/
		self.formatHandlers["forvidarelasning"] = {
			begin: function(tag, indentation) {
				self.state.furtherReading = true;
				return indentation + "<h5 id=\"" + self.chapterIdentifier + "_" + (++self.tocId) + "\">För vidare läsning:";
			},
			end: function(tag, indentation) {
				return "</h5>";
			}
		};

		self.formatHandlers["reftextnrfortslist"] = {
			begin: function(tag, indentation) {
				return indentation + "<ol class=\"furtherReading\" start=\"" + (self.counters.referenceItems + 1) + "\">";
			},
			end: function(tag, indentation) {
				return "</ol>";
			}
		};
		/*		
		self.formatHandlers["reftextnr1"] = {
			begin: function(tag, indentation) {
				self.counters.referenceItems++;
				return indentation + "<li id=\"reference_" + self.counters.referenceItems + "\">[referens 1]";
			},
			end: function(tag, indentation) {
				return "</li>";
			}
		};
		*/
		self.formatHandlers["reftextnrforts"] = {
			begin: function(tag, indentation) {
				if (!self.state.furtherReading) {
					self.counters.referenceItems++;
				}

				var result = "";
				var listAlreadyStarted = false;
				var lastTag = "";

				if (self.html.length > 0) {
					lastTag = self.html[self.html.length - 1];
				}

				if (lastTag.indexOf("</ol>") > -1) {
					lastTag = lastTag.replace("</ol>", "");
					self.html.pop();
					self.html.push(lastTag);
					listAlreadyStarted = true;
				}
				
				if (!listAlreadyStarted) {
					result += "<ol class=\"references\">";
				}

				if (self.state.furtherReading) {
					result += "<li>";
				} else {
					result += "<li id=\"reference_" + self.counters.referenceItems + "\">";
				}

				return result;
			},
			end: function(tag, indentation) {
				var result = "";
				if (self.state.markerFormat !== null) {
					result += "</a> ";
					self.state.markerFormat = null;
				}
				result += "</li></ol>";
				return result;
			}
		};

		self.formatHandlers["reftextnr1"] = self.formatHandlers["reftextnrforts"];


		self.formatHandlers["preparat"] = {
			begin: function(tag, indentation) {
				return indentation + "<h2 id=\"" + self.chapterIdentifier + "_" + (++self.tocId) + "\">Preparat";
			},
			end: function(tag, indentation) {
				return "</h2>";
			}
		};

		self.formatHandlers["preprub"] = {
			begin: function(tag, indentation) {
				return indentation + "<h3 id=\"" + self.chapterIdentifier + "_" + (++self.tocId) + "\">";
			},
			end: function(tag, indentation) {
				return "</h3>";
			}
		};
		/*
		self.formatHandlers["preprub-linje"] = {
			begin: function(tag, indentation) {
				return indentation + "<h4 id=\"" + self.chapterIdentifier + "_" + (++self.tocId) + "\">[preparatrubriklinje]";
			},
			end: function(tag, indentation) {
				return "</h4>";
			}
		};
		*/
		self.formatHandlers["prepsubst"] = {
			begin: function(tag, indentation) {
				return indentation + "<h5 id=\"" + self.chapterIdentifier + "_" + (++self.tocId) + "\" class=\"substanceName\">";
			},
			end: function(tag, indentation) {
				return "</h5>";
			}
		};

		self.formatHandlers["prepvara"] = {
			begin: function(tag, indentation) {
				return indentation + "<blockquote class=\"medicine\">";
			},
			end: function(tag, indentation) {
				return "</blockquote>";
			}
		};

		self.formatHandlers["prepfet"] = {
			begin: function(tag, indentation) {
				return indentation + "<strong class=\"medicineName\">";
			},
			end: function(tag, indentation) {
				return "</strong>";
			}
		};

		self.formatHandlers["footnotes"] = {
			begin: function(tag, indentation) {
				return indentation + "<fieldset>";
			},
			end: function(tag, indentation) {
				//Reset the footnote counter for each page
				self.counters.footnoteItems = 0;
				return "</fieldset>";
			}
		};

		/*
		self.formatHandlers["footnote"] = {
			begin: function(tag, indentation) {
				return indentation + "<ol class=\"footnotes\">";
			},
			end: function(tag, indentation) {
				return "</ol>";
			}
		};

		self.formatHandlers["subfootnote"] = {
			begin: function(tag, indentation) {
				self.counters.footnoteItems++;
				return indentation + "<li class=\"footnote\" id=\"footnote_" + self.counters.footnoteItems + "\">";
			},
			end: function(tag, indentation) {
				return "</li>";
			}
		};
		*/
		self.formatHandlers["tk-tecken-kursiv"] = {
			begin: function(tag, indentation) {
				return indentation + "<em>";
			},
			end: function(tag, indentation) {
				return "</em>";
			}
		};

		self.formatHandlers["blue"] = {
			begin: function(tag, indentation) {
				return "";
			},
			end: function(tag, indentation) {
				return "";
			}
		};

		self.formatHandlers["div"] = {
			begin: function(tag, indentation) {
				return "<div>";
			},
			end: function(tag, indentation) {
				return "</div>";
			}
		};
		/*
		self.formatHandlers["figurins"] = {
			begin: function(tag, indentation) {
				return "<h1>Figur";
			},
			end: function(tag, indentation) {
				return "</h1>";
			}
		};
		*/
		
		
	},
	initTagHandlers: function() {
		var self = this;

		self.tagHandlers["body"] = {
			begin: function(tag, indentation) {
				return indentation + "";
			},
			end: function(tag, indentation) {
				return "";
			}
		};

		self.tagHandlers["tabstop"] = {
			begin: function(tag, indentation) {
				if (self.state.textflow === "A") {
					return indentation + "<span class=\"tabstop\"></span>";
				}
			},
			end: function(tag, indentation) {
				return "";
			}
		};

		self.tagHandlers["tbl"] = {
			endTable: true,
			begin: function(tag, indentation) {

				var $tag = $(tag);
				var tableTypeIndex = {
					"Tabell faktaruta": "facts",
					"Tabell smal": "narrow",
					"TabellRekBred": "therapy-recommendations",
					"TabellRekSmal": "therapy-recommendations",
					"Tabell bred": "wide",
					"Tabell med ram": "framed"
				};

				self.state.table = true;
				
				var tableType = $tag.children().filter(function(index, element) {return (element.name.toLowerCase() === "tbltag")});
				
				
				if (tableType !== null && tableType !== undefined && tableType.attr("value") !== undefined) {
					tableType = tableType.attr("value");

					var result = "";
					
					//TODO UNFINISHED: "Tabell smal" can be a facts box
					if ($tag.attr("forceType") !== null && $tag.attr("forceType") !== undefined && $tag.attr("forceType") !== "") {
						tableType = $tag.attr("forceType");
					}


					//console.error("Found table: " + tableType);
					if (tableTypeIndex[tableType] !== undefined) {
						tableType = tableTypeIndex[tableType];

						//Therapy recommendations are sometimes not what they seem to be
						if (tableType === "therapy-recommendations") {
							var tblTitle = $tag.find("TblTitle");
							var pgfTags = tblTitle.find("PgfTag");

							//Find any TabellRubrik_1sp or TabellRubrik_2sp which indicate a normal table
							var isTherapy = true;
							pgfTags.each(function(index, element) {
								var val = $(element).attr("value");
								if (val === "TabellRubrik_1sp" || val === "TabellRubrik_2sp") {
									isTherapy = false;
									return false;
								}
							});
							
							if (!isTherapy) {
								tableType = "wide";
							}
						} else if (tableType === "wide") {
							//Wide tables are sometimes not what they seem to be
							var tblTitle = $tag.find("TblTitle");
							var pgfTags = tblTitle.find("PgfTag");

							//Find any TabellRubrik_1sp or TabellRubrik_2sp which indicate a normal table
							var isTable = true;
							pgfTags.each(function(index, element) {
								var val = $(element).attr("value");
								if (val === "TabellRekRub") {
									isTable = false;
									return false;
								}
							});
							
							if (!isTable) {
								tableType = "therapy-recommendations";
							}
						}


						//End current format before rendering table
						while (self.state.format.length > 0) {
							if (self.formatHandlers[self.state.format[self.state.format.length - 1]] !== undefined) {
								self.html.push(self.formatHandlers[self.state.format[self.state.format.length - 1]].end(tag, indentation));
								//result += self.formatHandlers[self.state.format[self.state.format.length - 1]].end(tag, indentation);
							} else {
								//console.error("Could not find ending formathandler for " + self.state.format[self.state.format.length - 1]);
							}
							self.state.format.pop();
						}
						
						if (tableType.indexOf("facts") > -1) {
							self.counters.factsItems++;

							var number = 0;
							
							var tagCopy = $tag.clone();
							tagCopy.find("Notes").remove();
							
							var allText = tagCopy.text().trim();
							if (allText.substr(0, 1) === "#" && allText.indexOf(";") > -1) {
								number = allText.split(";")[0].replace("#", "").replace(";", "");
								
								//Find the culprit and remove the string
								var findText = "#" + number + ";";
								$tag.find("String").filter(function(index, element) {
									return $(element).text().trim().indexOf(findText) === 0
								}).each(function(index, element) {
									var text = $(element).text();
									$(element).text(text.replace(findText, ""));
								});
							}

							if (number === 0 || usedFactsNumbers[number] !== undefined) {
								number = self.counters.factsItems;
							}

							usedFactsNumbers[number] = true;
														
							//result += "<div class=\"clearfix\"></div><table id=\"facts_" + number + "\" class=\"table table-bordered " + tableType + "\">";
							result += "<div class=\"facts span4 pull-right\"><table id=\"facts_" + number + "\" class=\"table table-bordered facts\">";
							result += "<tr><th colspan=\"42\"><h4 id=\"" + self.chapterIdentifier + "_" + (++self.tocId) + "\" class=\"facts\">Faktaruta " + number + "</h4></th></tr>"
						} else if (tableType.indexOf("narrow") > -1) {
							self.counters.tableItems++;

							//Must be correct number
							var tableNumber = $tag.find("PgfNumString").first().attr("value");
							if (tableNumber === undefined) {
								tableNumber = self.counters.tableItems;
							} else {
								tableNumber = tableNumber.replace("Tabell ", "").split(".")[0];
							}

							result += "<div class=\"narrow span4 pull-right\"><table id=\"table_" + tableNumber + "\" class=\"table table-bordered narrow\">";
						} else if (tableType.indexOf("wide") > -1) {
							self.counters.tableItems++;

							//Must be correct number
							var tableNumber = $tag.find("PgfNumString").first().attr("value");
							if (tableNumber === undefined) {
								tableNumber = self.counters.tableItems;
							} else {
								tableNumber = tableNumber.replace("Tabell ", "").split(".")[0];
							}

							result += "<div class=\"clearfix\"></div><div class=\"wide\"><table id=\"table_" + tableNumber + "\" class=\"table table-bordered wide\">";
						} else if (tableType.indexOf("therapy") > -1) {
							self.counters.therapyItems++;
							result += "<div class=\"clearfix\"></div><div class=\"therapy-recommendations\"><table id=\"therapy_" + self.counters.therapyItems + "\" class=\"table table-bordered therapy-recommendations\">";
						} else {
							console.error("* Unknown tableType: " + tableType);
							result += "<div class=\"clearfix\"></div><div class=\"" + tableType + "\"><table class=\"table table-bordered " + tableType + "\">";
						}
					} else {
						console.error("* Unhandled table type: " + tableType);
					}
				} else {
//					console.error("No table tag.");
					self.tagHandlers["tbl"].endTable = false;
				}

				return result;
			},
			end: function(tag, indentation) {
				self.state.table = false;
				self.counters.tableFootnoteItems = 0;
				if (self.tagHandlers["tbl"].endTable) {
					return "</table></div>";
				} else {
					self.tagHandlers["tbl"].endTable = true;
					return "";
				}
			}
		};

		self.tagHandlers["tblformat"] = {
			begin: function(tag, indentation) {
				self.state.tableFormatSection = true;
				return "";
			},
			end: function(tag, indentation) {
				self.state.tableFormatSection = false;
				return "";
			}
		};


		self.tagHandlers["tbltitle"] = {
			begin: function(tag, indentation) {
				//return "<thead>";
				return "";
			},
			end: function(tag, indentation) {
				//return "</thead>";
				return "";
			}
		};

		self.tagHandlers["tbltitlecontent"] = {
			begin: function(tag, indentation) {
				self.tagHandlers["cell"].skipCells = 10000;
				return "<tr><th colspan=\"42\">";
			},
			end: function(tag, indentation) {
				self.tagHandlers["cell"].skipCells = 0;
				return "</th></tr>";
			}
		};

		self.tagHandlers["row"] = {
			begin: function(tag, indentation) {
				return "<tr>";
			},
			end: function(tag, indentation) {
				return "</tr>";
			}
		};

		self.cellColors = {
			"Black10": " style=\"background-color: #e6e7e8;\"",
			"Black30": " style=\"background-color: #bbbdc0;\"",
			"Svart 35%": " style=\"background-color: #bbbdc0;\"",
			"Black50": " style=\"background-color: #939598; color: #fff;\"",
			"Black70": " style=\"background-color: #6d6e70; color: #fff;\"",
			"Black90": " style=\"background-color: #000; color: #fff;\"",
			"Svart10": " style=\"background-color: #e6e7e8;\"",
			"Svart45": " style=\"background-color: #bbbdc0;\"",
			"Svart60": " style=\"background-color: #939598; color: #fff;\"",
			"Svart75": " style=\"background-color: #6d6e70; color: #fff;\"",
			"Black": " style=\"background-color: #000; color: #fff;\"" 
		};

		self.cellFills = {
			"5": " style=\"background-color: #e6e7e8;\""
		};
		
		self.tagHandlers["cell"] = {
			skipCells: 0,
			begin: function(tag, indentation) {

				var backgroundColor = "";
				
				var $tag = $(tag);
				var cellColor = $tag.find("CellColor");
				
				if (cellColor !== null && cellColor !== undefined && cellColor.attr("value") !== undefined) {
					cellColor = cellColor.attr("value");
					if (self.cellColors[cellColor] === undefined) {
						console.error("* Unhandled cellColor: " + cellColor);
					} else {
						backgroundColor = self.cellColors[cellColor];
					}
				}

				var cellFill = $tag.find("CellFill");
				
				if (cellFill !== null && cellFill !== undefined && cellFill.attr("value") !== undefined) {
					cellFill = cellFill.attr("value");
					if (self.cellFills[cellFill] === undefined) {
						console.error("* Unhandled cellFill: " + cellFill);
					} else {
						backgroundColor = self.cellFills[cellFill];
					}
				}

				if (self.tagHandlers["cell"].skipCells > 0) {
					return "";
				} else {
					return "<td" + backgroundColor + ">";
				}
			},
			end: function(tag, indentation) {
				if (self.tagHandlers["cell"].skipCells > 0) {
					self.tagHandlers["cell"].skipCells = self.tagHandlers["cell"].skipCells - 1;
					return "";
				} else {
					self.tagHandlers["cell"].skipCells = 0;
					return "</td>";
				}
			}
		};

		self.tagHandlers["cellcolumns"] = {
			begin: function(tag, indentation) {
				var $tag = $(tag);
				if ($tag.attr("value") !== undefined && $tag.attr("value") !== null && $tag.attr("value") !== "1") {
					var lastAddedTag = self.html.pop();
					if (lastAddedTag === "<td>") {
						lastAddedTag = "<td colspan=\"" + $tag.attr("value") + "\">";
						self.tagHandlers["cell"].skipCells = (parseInt($tag.attr("value")));
					}
					self.html.push(lastAddedTag);
				}
				return "";
			},
			end: function(tag, indentation) {
				return "";
			}
		};

		self.tagHandlers["figure"] = {
			begin: function(tag, indentation) {

				var result = "";

				//End current format before rendering figure
				while (self.state.format.length > 0) {
					if (self.formatHandlers[self.state.format[self.state.format.length - 1]] !== undefined) {
						//TODO: Perhaps self.html.push instead
						result += self.formatHandlers[self.state.format[self.state.format.length - 1]].end(tag, indentation);
					} else {
						//console.error("Could not find ending formathandler for " + self.state.format[self.state.format.length - 1]);
					}
					self.state.format.pop();
				}

				self.state.figure = true;

				$tag = $(tag);
				//var number = $tag.children().filter(function(index, element) {return (element.name === "PgfNumString");}).attr("value").split(".")[0].replace("Figur ", "");

				var number = $tag.find("PgfNumString").attr("value").split(".")[0].replace("Figur ", "");
				
				var imagesDirName = sourceFilePath.toLowerCase().replace(/\+/g, "-");
				if (imagesDirName.indexOf("/") > -1) {
					imagesDirName = imagesDirName.split("/");
					imagesDirName = imagesDirName[imagesDirName.length - 1];
				}

				imagesDirName = imagesDirName.replace(".mif", "").replace(".mifml", "") + "_images";
				var optImagesDirName = imagesDirName + "/opt"
				result += "<div id=\"figure_" + number + "\" class=\"well figure\">";
//				result += "<img class=\"figureImage\" src=\"" + imagesDirName + "/figur" + number + ".png\" />";

				result += "<div class=\"figureImage\" data-picture data-alt=\"Figur " + number + "\">";
				
				result += "<div data-src=\"" + optImagesDirName + "/figur" + number + "_small.png\"></div>";
				result += "<div data-src=\"" + optImagesDirName + "/figur" + number + "_small_x2.png\"         data-media=\"(min-device-pixel-ratio: 2.0)\"></div>";
				result += "<div data-src=\"" + optImagesDirName + "/figur" + number + "_medium.png\"        data-media=\"(min-width: 481px)\"></div>";
				result += "<div data-src=\"" + optImagesDirName + "/figur" + number + "_medium_x2.png\"     data-media=\"(min-width: 481px) and (min-device-pixel-ratio: 2.0)\"></div>";

				//result += "<div data-src=\"" + imagesDirName + "/figur" + number + "_large.png\"         data-media=\"(min-width: 768px)\"></div>";
				//result += "<div data-src=\"" + imagesDirName + "/figur" + number + "_large_x2.png\"      data-media=\"(min-width: 768px) and (min-device-pixel-ratio: 2.0)\"></div>";

				result += "<div data-src=\"" + optImagesDirName + "/figur" + number + "_large.png\"    data-media=\"(min-width: 980px)\"></div>";
				result += "<div data-src=\"" + optImagesDirName + "/figur" + number + "_large_x2.png\" data-media=\"(min-width: 980px) and (min-device-pixel-ratio: 2.0)\"></div>";
				result += "<div data-src=\"" + optImagesDirName + "/figur" + number + "_huge.png\"    data-media=\"(min-width: 1200px)\"></div>";
				result += "<div data-src=\"" + optImagesDirName + "/figur" + number + "_huge_x2.png\" data-media=\"(min-width: 1200px) and (min-device-pixel-ratio: 2.0)\"></div>";

				result += "<!--[if (lt IE 9) & (!IEMobile)]>";
				result += "<div data-src=\"" + optImagesDirName + "/figur" + number + "_large.png\"></div>";
				result += "<![endif]-->";
				
				result += "<noscript>";
				result += "<img src=\"" + optImagesDirName + "/figur" + number + "_large.png\" alt=\"Figur " + number + "\">";
				result += "</noscript>";
				result += "</div>";
				
				var newImagePath = __dirname + "/../servers/site/chapters/" + imagesDirName + "/figur" + number + ".png";
				
				var optImagesDir = __dirname + "/../servers/site/chapters/" + imagesDirName + "/opt/";
				
				//console.error("Creating dir for optimized images: " + optImagesDir);
				wrench.mkdirSyncRecursive(optImagesDir);
				//console.error("Done.");
				
				if (!fs.existsSync(newImagePath)) {
					//Check if image exists
					var imageName = newImagePath;
					if (imageName.indexOf("/") > -1) {
						imageName = imageName.split("/");
						imageName = imageName[imageName.length - 1];
					}
					console.error("* Missing figure image: " + imageName);
				} else {

					//async.series(
					async.parallel(
						[
							function(callback) {
								resizeImage(newImagePath, 480, "_small", forcedImageResizing, function(err, result) {
									callback(err, result);
								});
							},
							function(callback) {
								resizeImage(newImagePath, 960, "_small_x2", forcedImageResizing, function(err, result) {
									callback(err, result);
								});
							},
							function(callback) {
								resizeImage(newImagePath, 724, "_medium", forcedImageResizing, function(err, result) {
									callback(err, result);
								});
							},
							function(callback) {
								resizeImage(newImagePath, 1448, "_medium_x2", forcedImageResizing, function(err, result) {
									callback(err, result);
								});
							},
							function(callback) {
								resizeImage(newImagePath, 940, "_large", forcedImageResizing, function(err, result) {
									callback(err, result);
								});
							},
							function(callback) {
								resizeImage(newImagePath, 1880, "_large_x2", forcedImageResizing, function(err, result) {
									callback(err, result);
								});
							},
							function(callback) {
								resizeImage(newImagePath, 1170, "_huge", forcedImageResizing, function(err, result) {
									callback(err, result);
								});
							},
							function(callback) {
								resizeImage(newImagePath, 2340, "_huge_x2", forcedImageResizing, function(err, result) {
									callback(err, result);
								});
							}
						], 
						function(err, results) {
							if (err) {
								console.error("* Error:", err);
							} else {
								//console.error("Resized images: \n\t" + results.join("\n\t"));
							}
						}
					);
					
				}
				
				return result;
			},
			end: function(tag, indentation) {
				self.state.figure = false;
				return "</p></div>";
			}
		};

		self.tagHandlers["pgfnumstring"] = {
			begin: function(tag, indentation) {
				$tag = $(tag);
				if (self.state.figure && $tag.attr("value").indexOf("Figur") === 0) {
					return "<h4 id=\"" + self.chapterIdentifier + "_" + (++self.tocId) + "\" class=\"figure\">" + $tag.attr("value");
				}
				return "";
			},
			end: function(tag, indentation) {
				if (self.state.figure && $tag.attr("value").indexOf("Figur") === 0) {
					return "</h4><p class=\"figureText\">";
				}
				return "";
			}
		};

		self.tagHandlers["textflow"] = {
			begin: function(tag, indentation) {
				return "";
			},
			end: function(tag, indentation) {
				self.state.textflow = null;
				return "";
			}
		};

		self.tagHandlers["tftag"] = {
			begin: function(tag, indentation) {
				var $tag = $(tag);
				self.state.textflow = $tag.attr("value");
				return "";
			},
			end: function(tag, indentation) {
				return "";
			}
		};
		
		self.tagHandlers["notes"] = {
			begin: function(tag, indentation) {
				var $tag = $(tag);
				//TODO: Handle notes
//				return "<ul>";
				return "";
			},
			end: function(tag, indentation) {
//				return "</ul>";
				return "";
			}
		};

		self.tagHandlers["atbl"] = {
			begin: function(tag, indentation) {
				var $tag = $(tag);
				//"Tabell med ram" - special case
				if (self.state.textflow === "A") {
					
					//Find correct table
					var tableId = $tag.attr("value");
					var source = $("TblID").filter(function(index, element) {
						return ($(this).attr("value") === tableId);
					});
					if (source.length === 1) {
						var sourceTable = $(source).parent();
						sourceTable.name = "tbl";

						var tblTag = sourceTable.find("TblTag").first();
						if (tblTag !== undefined && tblTag.attr("value") === "Tabell med ram") {
							self.parseTag(sourceTable);
						}
					} else {
						console.error("* Could not find ATbl with id: " + tableId);

					}
				}
				return "";
			},
			end: function(tag, indentation) {
//				if (self.state.textflow === "A") {
//					return "</div>";
//				} else {
					return "";
//				}
			}
		};

		self.tagHandlers["fnote"] = {
			begin: function(tag, indentation) {

				var result = "";
				var $tag = $(tag);

				if (self.state.textflow === "A" && self.state.table && self.tagHandlers["tbl"].endTable) {

					//Inside tables

					var translatedTableFootnoteItems = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t"];

					if ($tag.attr("value") !== undefined && $tag.attr("value") !== "") {
					} else {
						var id = $tag.find("ID").first().attr("value");
						self.counters.tableFootnoteItems++;
						result = "<div class=\"tableFootnote\" id=\"fnote_" + id + "\">" + translatedTableFootnoteItems[self.counters.tableFootnoteItems - 1] + ". ";
					}

				} else if (self.state.textflow === "A") {
					if ($tag.attr("value") !== undefined && $tag.attr("value") !== "") {
						
					} else {
						var id = $tag.find("ID").first().attr("value");
						self.counters.pageFootnoteItems++;
						self.pageFootNotesNumbers[id] = self.counters.pageFootnoteItems;
						result += "<fieldset id=\"" + id + "\" class=\"pageFootnote\"><legend>Fotnot " + self.counters.pageFootnoteItems + "</legend>";
					}
				}
				return result;
			},
			end: function(tag, indentation) {

				var result = "";
				var $tag = $(tag);

				if (self.state.textflow === "A" && self.state.table && self.tagHandlers["tbl"].endTable) {

					if ($tag.attr("value") !== undefined && $tag.attr("value") !== "") {
					
					} else {
						result = "</div>";
					}
				} else if (self.state.textflow === "A") {
					if ($tag.attr("value") !== undefined && $tag.attr("value") !== "") {
						
					} else {
						result += "</fieldset>";
					}
				}
				return result;
			}
		};

		self.tagHandlers["para"] = {
			begin: function(tag, indentation) {

				self.state.format = [];
				
				var result = "";

				if (self.state.textflow === "A" && self.state.table && self.tagHandlers["tbl"].endTable) {
					result = "<p>";
//					result = "<span class=\"tableLine\">";
				}
				return result;
			},
			end: function(tag, indentation) {
				var result = "";
				if (self.state.textflow === "A") {

//					if (self.html[self.html.length - 2].indexOf("janusinfo.se") > -1) {
//						console.error("Ending para, format = " + self.state.format[self.state.format.length - 1]);
//					}

					if (self.state.markerFormat !== null) {
						result += "</a> ";
						self.state.markerFormat = null;
					}

					if (self.state.fontFormat !== null) {
						result += "</span>";
						self.state.fontFormat = null;
					}

					while (self.state.format.length > 0) {
						if (self.formatHandlers[self.state.format[self.state.format.length - 1]] !== undefined) {
							result += self.formatHandlers[self.state.format[self.state.format.length - 1]].end(tag, indentation);
						} else {
							//console.error("Could not find ending formathandler for " + self.state.format[self.state.format.length - 1]);
						}
						self.state.format.pop();
					}
					if (self.state.table && self.tagHandlers["tbl"].endTable) {
						result += "</p>";
					}

				}

				return result;
			}
		};

		self.tagHandlers["pgftag"] = {
			begin: function(tag, indentation) {
				var result = "";
				var $tag = $(tag);
				var currentFormat = $tag.attr("value");
				
				if (self.state.textflow === "A" && currentFormat !== null) {
//					currentFormat = currentFormat.toLowerCase();

					self.state.format.push(currentFormat);

//					console.error(self.state.format);

//					var currentFormat = self.state.format[self.state.format.length - 1];
//					if (currentFormat === null) {
//						console.error("Could not set self.state.format for pgftag");
//					}

//					if (currentFormat === "Body") {
						//self.state.format[self.state.format.length - 1] = null;
//						self.state.format.pop();
//						console.error("Removing body");
//						currentFormat = null;
//					} else {
						var replaceTags = {
							"Författare": "Authors",
							"Bröd": "Bread",
							"BrödIn": "BreadIn",
							"ÄndringNyText": "ChangeNewText",
							"Footnote": "subFootNote"
						};

						if (replaceTags[currentFormat] !== undefined) {
							self.state.format[self.state.format.length - 1] = replaceTags[currentFormat];
						}
						
						self.state.format[self.state.format.length - 1] = self.state.format[self.state.format.length - 1].toLowerCase();
						currentFormat = self.state.format[self.state.format.length - 1];
						
						var addIndentation = false;
						
						var pgf = $tag.siblings("Pgf");
						if (pgf !== undefined) {
							var pgfIndent = pgf.children("PgfFIndent");
							var indent = pgfIndent.attr("value");
							if (indent !== undefined) {
								//console.error(indent);
								indent = parseInt(indent.replace(" mm", ""));
								if (indent > 1) {
									addIndentation = true;
								}
							}
						}
						
						if (addIndentation) {
							currentFormat = currentFormat + "Indent";
						}
						
						if (self.formatHandlers[currentFormat] !== undefined) {
							result = self.formatHandlers[currentFormat].begin(tag, indentation);
						} else if (self.formatHandlers[currentFormat.replace("Indent", "")] !== undefined) {
							result = self.formatHandlers[currentFormat.replace("Indent", "")].begin(tag, indentation);
						} else {
							unhandledTags[currentFormat] = "";
						}
//					}
				}
				return result;
			},
			end: function(tag, indentation) {
				return "";
			}
		};

		self.tagHandlers["paraline"] = {
			lineRest : "",
			begin: function(tag, indentation) {
				var $tag = $(tag);

				if (self.state.textflow === "A") {

					if (self.state.table && self.tagHandlers["cell"].skipCells === 0) {
						self.html.push("<div class=\"tableLine\">");
					}
					

					$tag.children().each(function(index, child) {
						var $child = $(child);
						if (child.name.toLowerCase() === "fnote" && $child.attr("value") !== undefined && $child.attr("value") !== "") {
							//Inject note in flowing text
							if (self.state.table) {
								//tableFootnote
								//var translatedTableFootnoteItems = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t"];
								var id = $child.attr("value");
								//console.error("Render: <a class=\"tableFootnoteLink\" href=\"#fnote_" + id + "\">X</a>");
								self.html.push("<a class=\"tableFootnoteLink\" href=\"#fnote_" + id + "\">X</a>");
								//Push an extra line in order to circumvent line concatenation
								self.html.push("");
							} else {
								
								//pageFootnote
								var id = $child.attr("value");
								//Find note number
								var number = self.pageFootNotesNumbers[id];
								//console.error("Found: <a class=\"btn btn-mini btn-primary pageFootnoteItem\" href=\"#" + id + "\" alt=\"Sidnot\"><i class=\"icon icon-info-sign\"></i><sup class=\"hiddenNoteNumber\">" + number + "</sup></a>");
								self.html.push(" <a class=\"btn btn-mini btn-primary pageFootnoteItem\" href=\"#" + id + "\" alt=\"Sidnot\"><i class=\"icon icon-info-sign\"></i><sup class=\"hiddenNoteNumber\">" + number + "</sup></a>");
								//Push an extra line in order to circumvent line concatenation
								self.html.push("");
							}
						}

						if (child.name.toLowerCase() === "string") {
							if (self.state.fontFormat === "Symbol") {
								self.html.push(self.symbolsToUnicode($child.text()));
							} else {
								//Inject links to generica names
								var modifiedText = self.injectGenericas(self.tagHandlers["paraline"].lineRest + self.htmlEscape($child.text()));

								//Inject table, facts and figure links in text, handle "Faktaruta 1-5" etc...
								modifiedText = self.injectBoxLinks(modifiedText);

								self.html.push(modifiedText);

								/*
								if (self.tagHandlers["paraline"].lineRest !== "") {
									console.error("Using lineRest: " + self.tagHandlers["paraline"].lineRest);
									console.error("Sent: " + self.html[self.html.length -1]);
								}
								*/
								self.tagHandlers["paraline"].lineRest = "";
								if (self.state.linkFormat) {
									//end anchor after string
									var anchor = self.html.pop();
									anchor += "</a> ";
									self.html.push(anchor);
									self.state.linkFormat = false;
								}
							}
						}
						if (child.name.toLowerCase() === "char") {
							var value = $child.attr("value");
							var charHandlers = {
								"HardSpace": "&nbsp;", //&nbsp;
								"EnDash": "&ndash;",
								"EmDash": "&mdash;",
								"EnSpace": "&ensp;",
								"EmSpace": "&emsp;",
								"ThinSpace": "&thinsp;",
								"HardReturn": "<br>",
								"DiscHyphen": "",
								"NoHyphen": "",
								"Tab": "<span class=\"tab\"></span>", //"&nbsp;&nbsp;&nbsp;&nbsp;",
								"SoftHyphen": "&shy;"
							};
							if (charHandlers[value] !== undefined) {
								//Concat split words/lines to increase accuracy of injections based on word
								
								if (!self.state.table && (value === "SoftHyphen" || value === "DiscHyphen")) {
									/*
									var lineBack = self.html.pop().split(" ");
									if (lineBack[lineBack.length - 1] !== "") {
										self.tagHandlers["paraline"].lineRest = lineBack.pop();
										self.html.push(lineBack.join(" ") + " ");
									} else {
										self.html.push(lineBack.join(" "));
									}
									*/

									//Two hyphens after each other, must clear the lineRest
									if (self.tagHandlers["paraline"].lineRest !== "") {
										self.html[self.html.length - 1] += self.tagHandlers["paraline"].lineRest;
										self.tagHandlers["paraline"].lineRest = "";
									}
									
									var lineBack = self.html.pop();
									if (lineBack.indexOf("<") !== 0) {
										//Remove any tags in the previous line
										self.tagHandlers["paraline"].lineRest += self.htmlEscape($("<p>" + lineBack + "</p>").text());
										//console.error("* " + self.htmlEscape(lineBack));
										//self.tagHandlers["paraline"].lineRest += lineBack;
									} else {
										self.html.push(lineBack);
									}

								} else if (self.state.table && value === "SoftHyphen") {
									self.html.push("&shy;");
								} else {
									self.html.push(charHandlers[value]);
								}
							} else {
								console.error("* Unhandled CHAR: " + value);
							}
						}
						
						if (child.name.toLowerCase() === "xref") {
							//Handle cross references
							self.parseXRef(child);
						}

						if (child.name.toLowerCase() === "font") {
							var fontFormatHandlers = {
								"Upphöjt": "<span class=\"super\">",
								"FSuperscript": "<span class=\"super\">",
								"Nedsänkt": "<span class=\"sub\">",
								"FSubscript": "<span class=\"sub\">",
								"Blue": "<span class=\"blue\">",
								"Hyperlink": "<span class=\"blue\">",
								"White": "<span style=\"color: #fff;\">",
								"BroedKursiv": "<span style=\"font-style: italic;\">",
								"BrödKursiv": "<span style=\"font-style: italic;\">",
								"Italic": "<span style=\"font-style: italic;\">",
								"sKursiv": "<span style=\"font-style: italic;\">",
								"TK Tecken kursiv": "<span style=\"font-style: italic;\">",
								"FetFrutiger8,5": "<span style=\"font-weight: bold;\">",
								"TF Tecken fet": "<span style=\"font-weight: bold;\">",
								"Fet_akut": "<span style=\"font-weight: bold;\">",
								"Fet": "<span style=\"font-weight: bold;\">",
								"Bold": "<span style=\"font-weight: bold;\">",
								"Radrubrik": "<br><span style=\"font-weight: bold; font-family: 'Avenir Next', 'Helvetica Neue Ultra Light', 'Helvetica Neue', Helvetica, Arial, sans-serif;\">",
								"PrepFet": "<span style=\"font-weight: bold; font-family: 'Avenir Next', 'Helvetica Neue Ultra Light', 'Helvetica Neue', Helvetica, Arial, sans-serif;\">",
								"PrepFetSpecial": "<span style=\"font-weight: bold; font-family: 'Avenir Next', 'Helvetica Neue Ultra Light', 'Helvetica Neue', Helvetica, Arial, sans-serif;\">",
								"Text i bildFet": "<span style=\"font-weight: bold;\">",
								"FaktaFet": "<span style=\"font-weight: bold;\">",
								"TabellFet": "<span style=\"font-weight: bold;\">",
								//"Symbol": "<span style=\"font-family: symbol,'Standard Symbols L'\">",
								"Symbol": "<span>",
								"Ref": "<span>"
							};
							
							var skippedFormatHandlers = {
								"NoHyphen": true,
								"Black": true,
								"Text i bild": true,
								"Regular": true,
								"Cyan": true,
								"•": "<span>&bull; ",
								"Green": true,
								"Gray-80%": true,
								"Dark Blue": true,
								"Rub1 Char": true,
								"Rub2 Char": true,
								"FaktaRub2 Char": true,
								"Rubrik 2 Char": true,
								"FNormal": true,
								"cwlink_alt2": true,
								"Color8": true,
								"Color9": true,
								"src": true,
								"Intense Emphasis": true,
								"Akut_Text": true,
								"Frutiger LT Std 55 Roman": true,
								"Times New Roman": true,
								"FaktaTextIn Char": true,
								"TU Tecken upphöjd": "<span class=\"super\">",
								"TN Tecken nedsänkt": "<span class=\"sub\">",
								"Ändr röd": "<span style=\"color: red;\">",
								"Ändr Röd": "<span style=\"color: red;\">",
								"Red": "<span style=\"color: red;\">",
								"ÄndringNyText": "<span style=\"color: red;\">",
								"Bolded": "<span style=\"font-weight: bold;\">"
							};

							var font = $child;
							//var formats = {};
							//var arrFormats = [];
							font.children().each(function(index, element) {
								var $element = $(element);
								if (element.name.toLowerCase() === "ffamily" || element.name.toLowerCase() === "ftag" || element.name.toLowerCase() === "fposition" || element.name.toLowerCase() === "fangle" || element.name.toLowerCase() === "fcolor" || element.name.toLowerCase() === "fweight") {

									var value = $element.attr("value");

									if (value === "" && self.state.fontFormat !== null) {
										//Clear old formatting
										if (self.state.markerFormat !== null) {
											self.html.push("</a> ");
											self.state.markerFormat = null;
										}
										self.html.push("</span>");
										self.state.fontFormat = null;
									} else if (value !== null && value !== undefined && fontFormatHandlers[value] !== undefined) {
										//Clear old formatting
										if (self.state.fontFormat !== null) {
											self.html.push("</span>");
											self.state.fontFormat = null;
										}
										self.html.push(fontFormatHandlers[value]);
										self.state.fontFormat = value;
									} else {
										//Clear old formatting
										if (self.state.markerFormat !== null) {
											self.html.push("</a> ");
											self.state.markerFormat = null;
										}
										if (self.state.fontFormat !== null) {
											self.html.push("</span>");
											self.state.fontFormat = null;
										}

										if (value !== "" && skippedFormatHandlers[value] === undefined) {
											console.error("* Unhandled FTAG: " + value);
										}
									}
								}
							});
						}
						if (child.name.toLowerCase() === "marker") {
							var markerFormatHandlers = {
								//"Author": "<a style=\"font-weight: bold; display: block; margin-bottom: 10px;\">",
								"Hypertext": "<a>", //,
//								"Index": "<a class=\"index\">",
								"Cross-Ref": "<a class=\"crossRef\">"
							};

							var marker = $child;
							marker.children().each(function(index, element) {
								var $element = $(element);
								if (element.name.toLowerCase() === "mtypename") {
									var value = $element.attr("value");
									if (value === "" && self.state.markerFormat !== null) {
										self.html.push("</a> ");
										self.state.markerFormat = null;
									} else if (value === "Index" || value === "Cross-Ref") {
										//TODO: Save to index db
										if (self.state.markerFormat !== null) {
											self.html.push("</a> ");
											self.state.markerFormat = null;
										}
										//Handle index
										var indexText = marker.find("MText").attr("value");
										var indexId = marker.find("Unique").attr("value");
										var indexName = "";

										//Cross-Ref sets name
										if (value === "Cross-Ref" && indexText && indexText.indexOf(":") > -1) {
											indexId = indexText.split(":")[0];
										}

										self.html.push("<a class=\"index\" id=\"" + indexId + "\"></a>");

										//TODO: Maybe add name?
										//self.html.push("<a class=\"index\" id=\"" + indexId + "\"" + ((indexName !== "") ? " name=\"" + indexName + "\"" : "") + "></a>");

										//self.html.push("<a class=\"index\" id=\"" + indexId + "\" data-index=\"" + indexText + "\"" + ((indexName !== "") ? " name=\"" + indexName + "\"" : "") + "></a>");
										
										
									} else if (value === "Author") {
										//TODO: Save to author db
										if (self.state.markerFormat !== null) {
											self.html.push("</a> ");
											self.state.markerFormat = null;
										}
										//Handle index
										var indexText = marker.find("MText").attr("value");
										var indexId = marker.find("Unique").attr("value");
										var indexName = "";

										//Cross-Ref sets name
										if (value === "Cross-Ref" && indexText.indexOf(":") > -1) {
											indexId = indexText.split(":")[0];
										}

										self.html.push("<br><a class=\"author\" id=\"" + indexId + "\"></a>");
										//TODO: Maybe add name?
										//self.html.push("<br><a class=\"author\" id=\"" + indexId + "\"" + ((indexName !== "") ? " name=\"" + indexName + "\"" : "") + "></a>");
										
										
									} else if (value !== null && value !== undefined && markerFormatHandlers[value] !== undefined) {
										if (self.state.markerFormat !== null) {
											self.html.push("</a> ");
											self.state.markerFormat = null;
										}
										self.html.push(markerFormatHandlers[value]);
										self.state.markerFormat = value;
									} else {
										if (value !== "") {
											console.error("* Unhandled MTYPENAME: " + value);
										}
									}
								}
								if (element.name.toLowerCase() === "mtext") {
									var value = $element.attr("value");
									if (value.indexOf("message URL ") === 0) {
										var result = self.html.pop();
										result = result.substr(0, result.length - 1) + " href=\"" + value.replace("message URL ", "") + "\" target=\"_blank\">";
										self.html.push(result);
										self.state.linkFormat = true;
										self.state.markerFormat = null;
									}
/*									
									if (self.state.markerFormat === "Cross-Ref" && value.indexOf(":") > -1) {
										var result = self.html.pop();
										result = result.substr(0, result.length - 1) + " name=\"" + value.split(":")[0] + "\">";
										self.html.push(result);
									} 
*/
								}
								
							});
						}
					});
				}
				return "";
			},
			end: function(tag, indentation) {
				var result = "";
				if (self.state.textflow === "A") {
					if (self.state.markerFormat !== null) {
						result += "</a> ";
						self.state.markerFormat = null;
					}

					if (self.state.fontFormat !== null) {
						result += "</span >";
						self.state.fontFormat = null;
					}

					if (self.state.table  && self.tagHandlers["cell"].skipCells === 0) {
						result += "</div>";
					}

				}
				return result;
			}
		};

			
	},
	parseXRef: function(ref) {

		var self = this;
		
		var $ref = $(ref);
		//console.error(ref.children());
		
		var type = $ref.children().filter(function(index, element) {return (element.name.toLowerCase() === "xrefname");}).attr("value");

		//var result = "REF";

		switch (type) {
			case "Ref":
				var sourceText = $ref.children().filter(function(index, element) {return (element.name.toLowerCase() === "xrefsrctext");}).attr("value");
				var sourceFile = $ref.children().filter(function(index, element) {return (element.name.toLowerCase() === "xrefsrcfile");}).attr("value");
				
				//sourceText = sourceText[0] + ":" + sourceText[1] + ":";
				//console.error("Looking for: " + sourceText);
				//var source = $('mtext[value^="' + sourceText + '"]');
				var source = $("MText").filter(function(index, element) {
					return ($(this).attr("value").toLowerCase().indexOf(sourceText.toLowerCase()) > -1);
				});

				//console.error("Handling: " + sourceText);
				
//				console.error(source);
				
				//Figure or table
				if (sourceText.indexOf("FigurNr:") > -1) {
					//TODO: what? console.error($(source).parents("TextFlow"));
					var sourceFigure = $(source).parents("TextFlow").eq(0);
					sourceFigure.name = "figure";

					//var figureNumber = ref.find("XRefSrcText").attr("value").split(":")[2].split(".")[0].replace(" Figur ", "");
					//console.error("Parsing figure: " + figureNumber);

					if (sourceFigure.length === 0) {
						//TODO: Handle refs to figures in other chapters
					} else {
						//Check if already rendered
						if (self.renderedBoxes[sourceText] === undefined) {
							self.renderedBoxes[sourceText] = true;
							self.parseTag(sourceFigure);
						}
					}
					
				} else {

					//console.error("Found: ", source);
					//console.error(sourceText);

					var sourceTable = $(source).parents("Tbl").eq(0);

					if (sourceTable.length === 0) {
						//TODO: Handle refs to tables in other chapters
						//console.error("Length: 0 for: " + sourceText);
					} else {
						sourceTable.name = "tbl";
						if (sourceText.indexOf("FaktaRub") > -1) {
							//Force facts
							$(sourceTable).attr("forceType", "Tabell faktaruta");
						}
						if (!self.state.table) {
							//Check if already rendered
							if (self.renderedBoxes[sourceText] === undefined) {
								self.renderedBoxes[sourceText] = true;
								//console.error("Render: " + sourceText);
								self.parseTag(sourceTable);
							}
						} else {
							if (self.renderedBoxes[sourceText] === undefined) {
								self.xrefQueue.push(ref);
								//console.error("Was already in table state, not rendering: " + sourceText);
							}
						}
					}

				}
				break;
//			case "ORef":
//				var sourceText = ref.children().filter(function(index, element) {return (element.name === "XRefSrcText");}).attr("value").split(":");
//				var sourceFile = ref.children().filter(function(index, element) {return (element.name === "XRefSrcFile");}).attr("value");
//
//				sourceText = sourceText[0] + ":" + sourceText[1] + ":";
//				//console.error("Looking for 2: " + sourceText);
//				//var source = $('mtext[value^="' + sourceText + '"]');
//				var source = $("MText").filter(function(index, element) {
//					return ($(this).attr("value").indexOf(sourceText) > -1);
//				});
//				//Figure or table
//				if (sourceText.indexOf("FigurNr:") > -1) {
//					var sourceFigure = $(source).parents("TextFlow").eq(0);
//					sourceFigure.name = "figure";
//
//					//var figureNumber = ref.find("XRefSrcText").attr("value").split(":")[2].split(".")[0].replace(" Figur ", "");
//					//console.error("Parsing figure: " + figureNumber);
//
//					if (sourceFigure.length === 0) {
//						//TODO: Handle refs to figures in other chapters
//					} else {
//						self.parseTag(sourceFigure);
//					}
//					
//				} else {
//
//					//console.error("Found2: ", source);
//
//					var sourceTable = $(source).parents("Tbl").eq(0);
//
//					if (sourceTable.length === 0) {
//						//TODO: Handle refs to tables in other chapters
//					} else {
//						sourceTable.name = "tbl";
//						if (sourceText.indexOf("FaktaRub") > -1) {
//							//Force facts
//							$(sourceTable).attr("forceType", "Tabell faktaruta");
//						}
//						if (!self.state.table) {
//							self.parseTag(sourceTable);
//						}
//					}
//
//				}
//				break;
			case "Page":
				var sourceText = $ref.children().filter(function(index, element) {return (element.name.toLowerCase() === "xrefsrctext");}).attr("value");
				var sourceFile = $ref.children().filter(function(index, element) {return (element.name.toLowerCase() === "xrefsrcfile");}).attr("value");
			
				if (sourceFile && sourceFile !== "") {
					sourceFile = sourceFile.replace(/\+/g, "-");
					if (sourceFile.indexOf("<c>") > -1) {
						sourceFile = sourceFile.split("<c>");
						sourceFile = sourceFile[sourceFile.length - 1];
						sourceFile = sourceFile.toLowerCase().replace(".fm", ".html");

						var done = false;
						var allowedIterations = 3;
						var iterations = 0;
						var allRemoved = [];

						while (!done) {
							var removedHtml = self.html.pop();
							allRemoved.unshift(removedHtml);
							iterations++;
							if (removedHtml.trim() !== "" && removedHtml.lastIndexOf(", s") === (removedHtml.length - 3)) {
								removedHtml = removedHtml.substr(0, (removedHtml.length - 3));
								self.html.push(removedHtml);
								done = true;
							} else if (removedHtml.trim() !== "" && removedHtml.lastIndexOf(", s ") === (removedHtml.length - 4)) {
								removedHtml = removedHtml.substr(0, (removedHtml.length - 4));
								self.html.push(removedHtml);
								done = true;
							} else if (removedHtml.trim() !== "" && removedHtml.lastIndexOf(" s ") === (removedHtml.length - 3)) {
								removedHtml = removedHtml.substr(0, (removedHtml.length - 3));
								self.html.push(removedHtml);
								done = true;
							} else if (removedHtml.trim() !== "" && removedHtml.lastIndexOf(" s") === (removedHtml.length - 2)) {
								removedHtml = removedHtml.substr(0, (removedHtml.length - 2));
								self.html.push(removedHtml);
								done = true;
							} else if (removedHtml.trim() !== "" && removedHtml.lastIndexOf("s") === (removedHtml.length - 1)) {
								removedHtml = removedHtml.substr(0, (removedHtml.length - 1));
								self.html.push(removedHtml);
								done = true;
							} else if (removedHtml.trim() !== "" && removedHtml.lastIndexOf("s ") === (removedHtml.length - 2)) {
								removedHtml = removedHtml.substr(0, (removedHtml.length - 2));
								self.html.push(removedHtml);
								done = true;
							} else if (removedHtml.trim() !== "" && removedHtml.lastIndexOf("sid ") === (removedHtml.length - 4)) {
								removedHtml = removedHtml.substr(0, (removedHtml.length - 4));
								self.html.push(removedHtml);
								done = true;
							}
							
							if (!done && (iterations >= allowedIterations)) {
								//Defeat
								done = true;
								self.html.push(allRemoved.join(""));
							} 
						}

						//console.error("* Linking out to: " + sourceFile + "#" + sourceText.split(":")[0]);

						self.html.push(" <a href=\"" + sourceFile + "#" + sourceText.split(":")[0] + "\" class=\"btn btn-primary btn-mini pageLink\"><i class=\"icon-arrow-right icon-white\"></i></a>");

					} else {
						console.error("Could not parse link to source file: " + sourceFile);
					}
				} else {
					//console.error("Found page ref, last html = " + self.html[self.html.length - 1]);
					var done = false;
					var allowedIterations = 3;
					var iterations = 0;
					var allRemoved = [];

					while(!done) {
						var removedHtml = self.html.pop();
						allRemoved.unshift(removedHtml);
						iterations++;
						if (removedHtml.trim() !== "" && removedHtml.lastIndexOf(", s") === (removedHtml.length - 3)) {
							removedHtml = removedHtml.substr(0, (removedHtml.length - 3));
							self.html.push(removedHtml);
							done = true;
						} else if (removedHtml.trim() !== "" && removedHtml.lastIndexOf(", s ") === (removedHtml.length - 4)) {
							removedHtml = removedHtml.substr(0, (removedHtml.length - 4));
							self.html.push(removedHtml);
							done = true;
						} else if (removedHtml.trim() !== "" && removedHtml.lastIndexOf(" s ") === (removedHtml.length - 3)) {
							removedHtml = removedHtml.substr(0, (removedHtml.length - 3));
							self.html.push(removedHtml);
							done = true;
						} else if (removedHtml.trim() !== "" && removedHtml.lastIndexOf(" s") === (removedHtml.length - 2)) {
							removedHtml = removedHtml.substr(0, (removedHtml.length - 2));
							self.html.push(removedHtml);
							done = true;
						} else if (removedHtml.trim() !== "" && removedHtml.lastIndexOf("s") === (removedHtml.length - 1)) {
							removedHtml = removedHtml.substr(0, (removedHtml.length - 1));
							self.html.push(removedHtml);
							done = true;
						} else if (removedHtml.trim() !== "" && removedHtml.lastIndexOf("s ") === (removedHtml.length - 2)) {
							removedHtml = removedHtml.substr(0, (removedHtml.length - 2));
							self.html.push(removedHtml);
							done = true;
						} else if (removedHtml.trim() !== "" && removedHtml.lastIndexOf("sid ") === (removedHtml.length - 4)) {
							removedHtml = removedHtml.substr(0, (removedHtml.length - 4));
							self.html.push(removedHtml);
							done = true;
						}
						
						if (!done && (iterations >= allowedIterations)) {
							//Defeat
							done = true;
							self.html.push(allRemoved.join(""));
						} 
						
					}
					self.html.push(" <a href=\"#" + sourceText.split(":")[0] + "\" class=\"btn btn-primary btn-mini pageLink\"><i class=\"icon-arrow-right icon-white\"></i></a>");
				}
				break;
			default:
				console.error("* Unhandled XRef type: " + type);
				
		}

//		return "<div>" + result + "</div>";

	},
	parseFile: function(filePath, callback) {
		var self = this;
		if (!self.isInitialized) throw new Error("parseFile was called before initializing the parser.");
		
		self.fileName = (filePath.indexOf("/") > -1) ? filePath.split("/")[filePath.split("/").length - 1] : filePath;
		
		self.chapterIdentifier = self.fileName.split("_")[0].toLowerCase().replace(/\+/g, "-");
		
		fs.readFile(filePath, "utf8", function(err, xmlData) {
			if (err) throw err;

			//Might come in handy
			xmlData = xmlData.replace(/\\x8c\s/g, "å");
			xmlData = xmlData.replace(/\\x8a\s/g, "ä");
			xmlData = xmlData.replace(/\\x9a\s/g, "ö");

			xmlData = xmlData.replace(/\\x81\s/g, "Å");
			xmlData = xmlData.replace(/\\x80\s/g, "Ä");
			xmlData = xmlData.replace(/\\x85\s/g, "Ö");

			xmlData = xmlData.replace(/\\x8e\s/g, "é");
			xmlData = xmlData.replace(/\\xd3\s/g, "”");

			xmlData = xmlData.replace(/å/g, "å");
			xmlData = xmlData.replace(/ä/g, "ä");
			xmlData = xmlData.replace(/ö/g, "ö");
			xmlData = xmlData.replace(/Å/g, "Å");
			xmlData = xmlData.replace(/Ä/g, "Ä");
			xmlData = xmlData.replace(/Ö/g, "Ö");
			
			xmlData = xmlData.replace("</MIFFile>", "</body></html>");
			xmlData = xmlData.replace("<MIFFile", "<html><body");

			/*
			var replaceTags = {
				"Författare": "Author",
				"Bröd": "Bread",
				"BrödIn": "BreadIn",
				"ÄndringNyText": "ChangeNewText",
				"Footnote": "subFootNote"
			};

			for (oldTag in replaceTags) {
				while (xmlData.indexOf("<" + oldTag + ">") > -1) {
					xmlData = xmlData.replace("<" + oldTag + ">", "<" + replaceTags[oldTag] + ">");
				}
				while (xmlData.indexOf("</" + oldTag + ">") > -1) {
					xmlData = xmlData.replace("</" + oldTag + ">", "</" + replaceTags[oldTag] + ">");
				}
			}
			*/
			
			//console.error("\nInitializing DOM...")
			//var jsdom = require('jsdom');
			//console.error("Finished initializing DOM.\n")

//			console.time("DOMInstance");
			//console.error("Creating DOM instance...")
			//var domInstance = jsdom.jsdom(xmlData);
			//console.error("Finished creating DOM instance.\n")
//			console.timeEnd("DOMInstance");

			//console.error("Creating DOM window...")
			//var window = domInstance.createWindow();
			//console.error("Finished creating DOM window.\n")

			//console.error("Creating Cheerio instance...")
			$ = require("cheerio").load(xmlData);
			//Populate fact numbers

			/*
			var tempFactCounter = 0;
			var tableTags = $("TblTag"); //.filter(function(index, element) { return $(element).attr("value") === "Tabell faktaruta"});
			tableTags.each(function(index, element) {
				if ($(element).attr("value") === "Tabell faktaruta") {
					var table = $(element).parent();
					var tableId = table.find("TblID").first().attr("value");
					if (tableId !== undefined && table.text().trim() !== "" && factsNumbers[tableId] === undefined) {
						tempFactCounter++;
						factsNumbers[tableId] = tempFactCounter;
					}
				}
			});
			
			console.error(factsNumbers);

			var foundNumbers = {};
			var usedNumbers = {};
			var foundNumbersCounter = 0;
			var textFlows = $("TextFlow");
			textFlows.each(function(index, element) {
				var text = $(element).text().trim();
				if (text.length > 0 && text.length < 3 && self.isNumber(text)) { // && usedNumbers[text] === undefined
					foundNumbersCounter++;
					foundNumbers[text] = foundNumbersCounter;
					usedNumbers[text] = true;
				}
			});

			console.error(foundNumbers);

			var atbls = {};
			atblsCounter = 0;
			$("ATbl").each(function(index, element) {
				if ($(element).attr("value") !== undefined && factsNumbers[$(element).attr("value")] !== undefined) {
					atblsCounter++;
					atbls[atblsCounter] = $(element).attr("value");
				}
			});
			
			console.error(atbls);
			*/
			//console.error("Finished creating Cheerio instance.\n")


			//console.error($("frame").length + " nr of frames");

			/*
			var fileNameCounter = 0;
			$("importobjectdata").each(function(index, tag) {
				var imageData = $(tag).attr("value").toString("binary");
				var fileFormat = $(tag).attr("facetName");
				//imageData = unescape(imageData).split("\n");
				//imageData = unescape(imageData).replace(/\\n/g, "").replace(/\\r/g, "").split("\n");

				imageData = imageData.map(function(line) {
					if (line.substr(0, 1) === "&") {
						return line.substr(1);
					} else {
						return line;
					}
				}).join("\n");

				imageData = new Buffer(imageData, "binary");
				var frame = $(tag).parents("frame").eq(0);
				var fileName = "./out/image" + fileNameCounter + "." + fileFormat.toLowerCase();

				console.error("Saving to file: " + fileName);
				fs.writeFileSync(fileName, imageData);

				fileNameCounter++;
			});
			*/
			
			//var resultHtml = self.parseTag($("body"));
			
			//Perform parsing
			//console.error("Body length: " + $("body").length);
			self.parseTag($("body"));
			var resultHtml = self.html.join("");
			
			//console.error(self.html.join("\n"));

			//Cleanup
			var cheerio = require("cheerio").load(resultHtml);

			//Remove KapRub headers
			var h1 = cheerio("h1");
			h1.each(function(index, element) {
				var $h1 = cheerio(element);

				if ($h1.text().trim().indexOf("KapRub") > -1) {
					$h1.remove();
				}
			});


			//Remove .remove class elements
			var toRemove = cheerio(".remove");
			toRemove.each(function(index, element) {
				var remove = cheerio(element);
				remove.remove();
			});

			//Switch element for superscripts
			var supers = cheerio("span.super");
			supers.each(function(index, element) {
				var oldSuper = cheerio(element);
				var newSuper = cheerio("<sup>" + oldSuper.html() + "</sup>");
				oldSuper.replaceWith(newSuper);
			});

			//Remove sup with "1" from h1
			var h1 = cheerio("h1");
			h1.each(function(index, element) {
				var $h1 = cheerio(element);
				$h1.find("sup").each(function(i, e) {
					var $e = cheerio(e);
					if ($e.text() === "1") {
						$e.remove();
					}
				});
			});

			//Replace <br> in headers with space
			var headers = cheerio("h1, h2, h3, h4, h5, h6");
			headers.each(function(index, element) {
				var header = cheerio(element);
				
				//header.find("br").remove();
				//console.error("Before: " + header.html());
				header.html(header.html().replace(/<br>/g, " "));
				//console.error("After: " + header.html());

			});
			//Switch element for subscripts
			var subs = cheerio("span.sub");
			subs.each(function(index, element) {
				var oldSub = cheerio(element);
				var newSub = cheerio("<sub>" + oldSub.html() + "</sub>");
				oldSub.replaceWith(newSub);
			});

			//Move pageFootnotes to after where they are referenced
			var pageFootnotes = cheerio("fieldset.pageFootnote");
			pageFootnotes.each(function(index, element) {
				var $element = cheerio(element);
				var idToFind = $element.attr("id");
				//Find correct passage
				var foundPassage = false;
				var footNoteReferences = cheerio("a.pageFootnoteItem");
				footNoteReferences.each(function(i, e) {
					var $e = cheerio(e);
					if ($e.attr("href") === ("#" + idToFind)) {
						foundPassage = true;
						$element = $element.remove();
						$e.parent().after($element);
					}
				});
				if (!foundPassage) {
					console.error("* Could not find passage for Fnote: " + idToFind);
				}
			});

			//Move tableFootnotes to the bottom of the table
			var tables = cheerio("table");
			tables.each(function(index, element) {
				var $table = cheerio(element);
				var footNotes = $table.find("div.tableFootnote");
				if (footNotes.length > 0) {

					//console.error("Found " + footNotes.length + " footnotes.")

					var content = "";
					footNotes.each(function(i, el) {
						var note = cheerio(el);
						content += cheerio.html(note);
						
						//Find link to this item and change numbering
						var noteLink = cheerio("a.tableFootnoteLink").filter(function(index, element) {
							return (cheerio(element).attr("href") === "#" + note.attr("id"));
						});
						
						if (noteLink.length === 1) {
							noteLink = noteLink.first();
							var character = note.text().split(".")[0].trim();
							if (character.length !== 1) {
								console.error("* Note character length was not 1: " + character);
							}
							
							noteLink.html("<sup>" + character + "</sup>");
							//console.error(cheerio.html(noteLink));
							
						} else {
							console.error("* Could not find link to: " + note.attr("id"));
						}
					});
					
					$table.append("<tr><td colspan=\"42\" class=\"footNotes\">" + content.replace(/<p>/g, "").replace(/<\/p>/g, "") + "</td></tr>");
					footNotes.remove();
				}
			});
			
			
			
			//Remove anchor tags with no attributes of value, and remove "span.blue"
			var anchors = cheerio("a");
			anchors.each(function(index, element) {
				var $element = cheerio(element);
				if ($element.attr("name") === undefined && $element.attr("href") === undefined && $element.attr("class") === undefined && $element.attr("id") === undefined && $element.attr("style") === undefined) {
					$element.replaceWith($element.html());
				} else {
					//Remove span.blue inside anchors
					$element.find("span.blue").each(function(i, e) {
						$e = cheerio(e);
						$e.replaceWith($e.html());
					});
					
					if ($element.parent().hasClass("blue")) {
						$element.parent().replaceWith($element.parent().html());
					}
				}
			});


			//Check all span.blue for refs and switch to correct markup
			var foundReferences = {};

			var blues = cheerio("span.blue");
			blues.each(function(index, element) {
				var $element = cheerio(element);
				var text = $element.text().trim();
				var possibleNumber = text.replace(/\,|\(|\)|–|\–|\s|\./g, "");

				var hasReferenceMarker = (text.indexOf(",") > -1 || text.indexOf("-") > -1 || text.indexOf("–") > -1 || (text.indexOf("(") === 0) && text.indexOf(")") > -1);

				var isReference = (text.length > 2 && text.substr(0, 1) === "(" && text.substr(text.length - 1) === ")") || (hasReferenceMarker && self.isNumber(possibleNumber));

				if (isReference) {
					//Found reference
					text = text.replace(/\./g, "");
					var references = [];
					if (text.indexOf(",") > -1) {
						//references = text.substr(1, text.length - 2).split(",");
						references = text.replace("(", "").replace(")", "").replace(/\–/g, "-").replace(/\s/g, "").split(",");
						//Check for 3-5 in any of the refs
						for (var i = references.length - 1; i >= 0; i--) {
							if (references[i].indexOf("-") > -1 || references[i].indexOf("–") > -1) {
								
								if (references[i].indexOf("-") > -1) {
									//Remove from references
									var inside = references[i];
									references.splice(i, 1);
									var from = inside.split("-")[0];
									var to = inside.split("-")[1];
									if (self.isNumber(from) && self.isNumber(to)) {
										from = parseInt(from);
										to = parseInt(to);
										for (var y=from; y <= to; y++) {
											references.push(y);
										}
									} else {
										console.error("* Could not handle reference 1: " + text);
									}
								}

							
							}
						}
						
					} else if (text.indexOf("-") > -1 || text.indexOf("–") > -1) {
						//Could be "(9-11)" or (9–11) for example
						text = text.replace(/\–/g, "-");
						var inside = text.substr(1, text.length - 2);
						var from = inside.split("-")[0];
						var to = inside.split("-")[1];
						if (self.isNumber(from) && self.isNumber(to)) {
							from = parseInt(from);
							to = parseInt(to);
							for (var i=from; i <= to; i++) {
								references.push(i);
							}
						} else {
							console.error("* Could not handle reference 2: " + text + ", possible number: " + possibleNumber);
						}
					} else {
						//references.push(text.substr(1, text.length - 2));
						references.push(text.replace("(", "").replace(")", "").trim());
					}

					$element.replaceWith("<a class=\"btn btn-mini inlineReference\" href=\"#reference_" + references[0] + "\" data-referencenumber=\"" + references.join(",") + "\">" + references.join(", ") + "</a>");

					//Save found references for when calculating missing references
					for (var i=0; i < references.length; i++) {
						foundReferences[references[i]] = "Found";
					}
				} else if (self.isNumber(text)) {
					//Found page reference - remove from output

					//Check if we are in references
					var possibleListItem = $element.parents("li").first();
					if (possibleListItem.length === 1 && possibleListItem.attr("id") && (possibleListItem.attr("id").indexOf("reference_") === 0)) {
						//Do not remove
					} else {
						//console.error("Removing page number: " + self.htmlEscape(cheerio.html($element)));
						$element.remove();
					}
				} else {
					console.error("* Unhandled blue marker: \"" + $element.text() + "\"");
					$element.replaceWith($element.html());
				}
			});
			
			//Calculate missing references
			var missingReferences = [];
			for (var i=0; i < self.counters.referenceItems; i++) {
				if (foundReferences[(i + 1)] === undefined) {
					missingReferences.push((i + 1));
				}
			}

			//Display missing references
			if (missingReferences.length > 0) {
				//console.error("Found references: ");
				//console.error(foundReferences);
				console.error("* Missing references for: " + missingReferences.join(", "));
			}

			//Move figure text before image
			var figureImages = cheerio(".figureImage");
			figureImages.each(function(index, element) {
				var image = cheerio(element);
				var parent = image.parent();
				image.remove();
				parent.append(image);
			});
			
			//Fix colspan="42"
			var cells = cheerio("td, th");
			cells.each(function(index, element) {
				var cell = cheerio(element);
				if (cell.attr("colspan") == "42") {
					//Find max columns for this table
					var table = cell.parents("table").first();
					var rows = table.find("tr");
					var maxColumns = 0;
					rows.each(function(i, e) {
						var row = cheerio(e);
						var columns = row.find("td").length;
						if (columns > maxColumns) {
							maxColumns = columns;
						}
					});
					
					cell.attr("colspan", maxColumns);
				}
			});
			
			//Remove tableLines if a table only has 1 column
			var th = cheerio("th");
			var foundTables = [];
			//Find tables with 1 column
			th.each(function(i, e) {
				e = cheerio(e);
				if (e.attr("colspan") == "1") {
					var table = e.parents("table").first();
					if (table.length === 1) {
						foundTables.push(table);
					}
				}
			});
			if (foundTables.length > 0) {
				for (var i = 0; i < foundTables.length; i++) {
					var table = foundTables[i];
					//Remove div.tableLine tags
					var tableLines = table.find("div.tableLine");
					tableLines.each(function (i, line) {
						line = cheerio(line);
						var newLineHtml = line.html();
						var oldLineHtml = cheerio.html(line);
						var newHtml = table.html().replace(oldLineHtml, newLineHtml);
						table.html(newHtml);
					});
				}
			}


			//Replace &shy; with - in tableLines inside td:s
			var td = cheerio("td");
			td.each(function(i, e) {
				e = cheerio(e);
				var lines = e.find("div.tableLine");
				lines.each(function(i2, l) {
					l = cheerio(l);
					var newHtml = l.html().replace(/\&shy\;/g, "-");
					l.html(newHtml);
				});
			});

			//Remove initial spaces in tableLines
			var lines = cheerio("div.tableLine");
			lines.each(function(index, element) {
				var $line = cheerio(element);
				if ($line.html().length > 0 && $line.html().substr(0, 1) === " ") {
//					console.error($line.html());
					var newHtml = $line.html().trim();
//					console.error(newHtml);
//					console.error("");
					$line.html(newHtml);
				}
				
				//If no content, add a space
				if ($line.html().trim() === "") {
					$line.html("&nbsp;");
				}
			});

			//Remove empty table rows
			var rows = cheerio("tr");
			rows.each(function(index, element) {
				var $row = cheerio(element);
				var text = $row.text().trim();
				if (text === "") {
					$row.remove();

					/*
					var nextRow = $row.next();
					if (nextRow.length === 1 && nextRow[0].tagName === "tr") {
						var nextText = nextRow.text().trim();

						if (nextText === "") {
							$row.remove();
						}
						
					}
					*/
				}
			});

			
			//Move narrow tables and facts up to nearest header or table
			var smallTables = cheerio("div.facts, div.narrow");
			smallTables.each(function(index, element) {
				var $element = cheerio(element);
				var foundHeaderOrTable = false;
				var allowedIterations = 10;
				var iterationCounter = 0;
				var current = $element;
				while(!foundHeaderOrTable) {
					iterationCounter++;
					var prev = current.prev();
					current = prev;

					if (prev.length > 0) {
						var tagName = prev[0].name;
						var findNames = {
							"h1": true,
							"h2": true,
							"h3": true,
							"h4": true,
							"h5": true,
							"h6": true,
							"table": true
						};
					
						if (findNames[tagName] !== undefined) {
							foundHeaderOrTable = true;
							//Move table after this tag
							prev.after(cheerio.html($element));
							$element.remove();
						}
					} else {
						//Do nothing
						foundHeaderOrTable = true;
					}
					
					if (iterationCounter >= allowedIterations) {
						//Do nothing
						foundHeaderOrTable = true;
					}
				}
			});

			//Create overview of facts, tables, figures and therapyRecommendations
			/*
			var tables = cheerio("table.wide, table.narrow");
			var facts = cheerio("table.facts");
			var figures = cheerio("div.figure");
			var therapyRecommendations = cheerio("table.therapy-recommendations");

			Order:
			Therapy
			Facts
			Tables
			Figures
			*/
			var overview = cheerio("<div></div>");

			var therapiesOverview = cheerio("<ul class=\"thumbnails clearfix overview therapiesOverview\"></ul>");
			var tablesOverview = cheerio("<ul class=\"thumbnails clearfix overview tablesOverview\"></ul>");
			var factsOverview = cheerio("<ul class=\"thumbnails clearfix overview factsOverview\"></ul>");
			var figuresOverview = cheerio("<ul class=\"thumbnails clearfix overview figuresOverview\"></ul>");
			
			var overviews = cheerio("div.facts, div.figure, div.wide, div.narrow, div.therapy-recommendations");

			var therapies = cheerio("table.therapy-recommendations");
			var facts = cheerio("table.facts");
			var tables = cheerio("table.wide, table.narrow");
			var figures = cheerio("div.figure");

			therapies.each(function(index, element) {
				therapiesOverview.append(self.parseOverview(element));
			});

			if (therapies.length > 0) {
				overview.append(therapiesOverview);
				overview.append("<div class=\"clearfix\"></div>");
			} 

			var sortedFacts = [];
			facts.each(function(index, element) {
				var name = $(element).find("h4").first().text().replace("Faktaruta ", "");
				sortedFacts.push({name: name, element: element});
			});

			sortedFacts.sort(function(a, b){
				return a.name - b.name;
			})
			
			for (var i = 0; i < sortedFacts.length; i++) {
				factsOverview.append(self.parseOverview(sortedFacts[i].element));
			}

			if (facts.length > 0) {
				overview.append(factsOverview);
				overview.append("<div class=\"clearfix\"></div>");
			} 

			var sortedTables = [];
			tables.each(function(index, element) {
				var name = $(element).find("h4").first().text().replace("Tabell ", "");
				name = name.split(".")[0];
				sortedTables.push({name: name, element: element});
			});

			sortedTables.sort(function(a, b){
				return a.name - b.name;
			})
			
			for (var i = 0; i < sortedTables.length; i++) {
				tablesOverview.append(self.parseOverview(sortedTables[i].element));
			}

			if (therapies.length > 0) {
			}

			if (tables.length > 0) {
				overview.append(tablesOverview);
				overview.append("<div class=\"clearfix\"></div>");
			}

			var sortedFigures = [];
			figures.each(function(index, element) {
				var name = $(element).find("h4").first().text().replace("Figur ", "");
				name = name.split(".")[0];
				sortedFigures.push({name: name, element: element});
			});

			sortedFigures.sort(function(a, b){
				return a.name - b.name;
			})
			
			for (var i = 0; i < sortedFigures.length; i++) {
				figuresOverview.append(self.parseOverview(sortedFigures[i].element));
			}

			if (sortedFigures.length > 0) {
				overview.append(figuresOverview);
			}
			
			if (overviews.length > 0) {
				cheerio("p.authors").last().after("<h2 class=\"overview\">Tabeller och figurer</h2><div>" + overview.html() + "</div>");
			}

			var blockTags = {
				"div": true,
				"h1": true,
				"h2": true,
				"h3": true,
				"h4": true,
				"h5": true,
				"h6": true,
				"ul": true,
				"ol": true
			};

			//Move strong inside child if it is a block style element
			var strongs = cheerio("strong");
			strongs.each(function(i, e) {
				var strong = cheerio(e);
				if (strong.children().length === 1) {
					
					var firstChild = strong.children().first();
					var tagName = firstChild[0].name;
					
					if (blockTags[tagName] !== undefined) {
						firstChild.html("<strong>" + firstChild.html() + "</strong>");
						strong.replaceWith(cheerio.html(firstChild));
					}
				}
			});
			
			//Remove empty <p>
			var ps = cheerio("p");
			ps.each(function(index, element) {
				var p = cheerio(element);
				if (p.html().trim().length === 0) {
					//Remove empty <p>
					p.remove();
				} else if (p.children().length > 0) {
					//Check if first child is block scope, in that case remove the current <p>
					
					var firstChild = p.children().first();
					var tagName = firstChild[0].name;
					
					
					if (blockTags[tagName] !== undefined) {
						//Remove the p
						p.replaceWith(p.html());
					}
				}
			});

			//Remove tableLine from th
			var lines = cheerio("th").find(".tableLine");
			lines.each(function(i, e) {
				var line = cheerio(e);
				line.replaceWith(line.html());
			});
			
			//Remove empty li:s
			var lis = cheerio("li");
			lis.each(function(i, e) {
				var li = cheerio(e);
				
				if (li.text().trim().length === 0) {
					li.remove();
				}
			});

			//Switch parent item to block on tabstops
			var tabStops = cheerio("span.tabstop");
			tabStops.each(function(i, e) {
				var tab = cheerio(e);
				var parent = tab.parent();
				if (parent.length === 1 && (parent[0].name === "p" || parent[0].name === "div")) {
					//tab.remove();
					var prev = parent.prev();
					if (prev.length === 1 && (prev[0].name === "ul" || prev.hasClass("tabStop"))) {
						parent.replaceWith("<div class=\"tabStop\">" + parent.html() + "</div>");
					}
				} else if (parent.length === 1 && parent[0].name === "li" && (parent.text().trim().substr(0, 1) === "-" || parent.text().trim().substr(0, 1) === "–")) {
					tab.remove();
					parent.attr("class", "tabStop");
				} else if (parent.length === 1 && parent.parent().length === 1 && parent.parent().hasClass("tableFootnote")) {
					tab.replaceWith("&nbsp;&nbsp;&nbsp;&nbsp;");
				} else {
					//tab.remove()
				}
			});
			
			//Get title
			var chapterTitle = cheerio("h1").first().text().trim();
			
			resultHtml = cheerio.html();

			callback(null, resultHtml, chapterTitle);
			
		});
	},
	parseOverview: function(element) {
		var self = this;
		
		var cheerio = require("cheerio");

		element = cheerio(element);
		var item = cheerio("<div class=\"thumbnail\"></div>");
		var caption = cheerio("<div class=\"caption\"></div>");
		var title = cheerio("<h5 class=\"overview\"></h5>");
		var text = cheerio("<p></p>");

		var titleText = element.find("h4").first().clone();
		titleText.find("a.inlineReference").remove();
		titleText.find("sup").remove();
		titleText.find("sub").remove();
		titleText = titleText.text();
		
		var titleSubText = "";

		if (titleText.indexOf(" – ") > -1) {
			var titles = titleText.split(" – ");
			titleText = titles[0];
			titles.shift();
			titleSubText = titles.join(" – ");
		}

		if (titleText.indexOf(". ") > -1) {
			var titles = titleText.split(". ");
			titleText = titles[0];
			titles.shift();
			titleSubText = titles.join(". ");
		}

		var type = "tableLink";

		var icon = "<i class=\"icon icon-th-large\"></i>";

		if (element.hasClass("figure")) {
			titleSubText = element.text().replace(/Figur\s[0-9]+\.\s/, "");
			titleText = titleText.replace(".", "");
			type = "figureLink";
			icon = "<i class=\"icon icon-bar-chart\"></i>";
		}

		if (element.hasClass("facts")) {
			type = "factsLink";
			var factsHeaders = element.find("h4");
			if (factsHeaders.length > 1) {
				titleSubText = factsHeaders.eq(1).text();
			}
			icon = "<i class=\"icon icon-th-list\"></i>";
		}

		if (element.hasClass("therapy-recommendations")) {
			type = "therapyLink";
			icon = "<i class=\"icon icon-info-sign\"></i>";
		}
		
		var width = "span2";
		if (element.hasClass("wide") || element.hasClass("therapy-recommendations")) {
			width = "span4";

			if (titleSubText.length > 100) {
				titleSubText = titleSubText.substr(0, 100) + "...";
			}

		} else {
			if (titleSubText.length > 50) {
				titleSubText = titleSubText.substr(0, 50) + "...";
			}
			
		}

		var link = "<a href=\"#" + element.attr("id") + "\" class=\"" + type + "\" data-numbers=\"" + element.attr("id").replace(/[^0-9]/g, "") + "\">"

		titleText = self.htmlEscape(titleText);
		titleSubText = self.htmlEscape(titleSubText);

		title.append(link + titleText + "</a>");
		text.append(link + titleSubText + "</a>");

		caption.append(icon);
		caption.append(title);
		caption.append(text);
		
		item.append(caption);
		
		return cheerio("<li class=\"" + width + "\"><div class=\"thumbnail " + type + "\" data-numbers=\"" + element.attr("id").replace(/[^0-9]/g, "") + "\">" + item.html() + "</div></li>");
		
	},
	parseTag: function(tag, level) {
		var self = this;
		var $tag = $(tag)[0];
		
		if ($tag === undefined) {
			console.error("* Error tag:", tag);
		} else {

			if (level === undefined) {
				level = 0;
			}

			var indentation = [];
			//for (var i = 0; i < level; i++) {
				//indentation.push("\t");
				//}
			indentation = indentation.join("");
			var tagName = tag.name;
			if (tagName === undefined) {
				tagName = "body";
			}
			tagName = tagName.toLowerCase();

			if (tagName === "tbls") {
				return;
			}

			var existsHandlers = self.tagHandlers.hasOwnProperty(tagName);
			if (!existsHandlers) {
				unhandledTags[tagName] = "";
			} else {
				//console.error("Got tag: " + tagName);
				handledTags[tagName] = "";
			}

			self.state.tags.push(tagName);

			//Begin tag
			if (existsHandlers) {
	//			console.error("Beginning tag \"" + tagName + "\"...")
				var result = self.tagHandlers[tagName].begin(tag, indentation);
				if (result !== "") {
	//				console.error("Finished beginning tag \"" + tagName + "\". " + result)
					self.html.push(result);
				}
			} else {
				//html.push(indentation + "<" + tagName + ">");
			}
			if (existsHandlers) {
				//console.error(indentation + $tag.name);
			
			}

			//console.error($tag);
		
			var children = $tag.children;
			for (var i = 0; i < children.length; i++) {
				//if (i < 2) {
				//	console.error(children[i]);
				//}
				//if (i < 2 && children[i] !== undefined) {
	//				console.error(children[i].type);
					//}
				if (children[i].type === "tag") {
					self.parseTag(children[i], (level + 1));
				}
			}

			/*
			$tag.contents().each(function(i, e) {
				if (!(e.nodeType === 3)) {
					self.parseTag(e, (level + 1));
				} else {
					//Text
	//				var text = $(e).text().replace(/\t/g, ""); //.replace(/\n/g, "");
	//				if (text !== "" && text !== undefined && text !== null) {
	//					html.push(text);
	//				}
				}
			});
	*/
			//End tag
			if (existsHandlers) {
	//			console.error("Ending tag \"" + tagName + "\"...")
			
				var result = indentation + self.tagHandlers[tagName].end(tag, indentation);
				if (result.trim() !== "") {
	//				console.error("Finished ending tag \"" + tagName + "\". " + result);
					self.html.push(result);
				}
			}

			var lastTag = self.state.tags.pop();
			
			if (lastTag === "tbl") {
				if (self.xrefQueue.length > 0) {
					for (var i = 0; i < self.xrefQueue.length; i++) {
						//console.error("Render " + (i + 1));
						//self.xrefQueue[i]
						self.parseXRef(self.xrefQueue[i]);
					}
					self.xrefQueue = [];
				}
				
			}
			
			/*
			while (self.xrefQueue.length > 0) {
				
				var xref = self.xrefQueue.shift();
				self.parseXRef(xref);
			}
			*/
		}
		
	},
	symbolsToUnicode: function(chars) {
		
		var self = this;
		
		//console.error("This: " + chars);

		//From: http://www.snible.org/greek/symb2uni.html

		var table = [
		  63,  63,  63,  63,  63,  63,  63,  63,  63,  63,  63,  63,  63,  63,  63,  63,
		  63,  63,  63,  63,  63,  63,  63,  63,  63,  63,  63,  63,  63,  63,  63,  63,
		  32,  33,8704,  35,8707,  37,  38,8717,  40,  41,8727,  43,  44,8722,  46,  47,
		  48,  49,  50,  51,  52,  53,  54,  55,  56,  57,  58,  59,  60,  61,  62,  63,
		8773, 913, 914, 935, 916, 917, 934, 915, 919, 921, 977, 922, 923, 924, 925, 927,
		 928, 920, 929, 931, 932, 933, 962, 937, 926, 936,  90,  91,8756,  93,8869,  95,
		  63, 945, 946, 967, 948, 949, 966, 947, 951, 953, 981, 954, 955, 956, 957, 959,
		 960, 952, 961, 963, 964, 965, 982, 969, 958, 968, 950, 123, 124, 125, 126,  63,
		  63,  63,  63,  63,  63,  63,  63,  63,  63,  63,  63,  63,  63,  63,  63,  63,
		  63,  63,  63,  63,  63,  63,  63,  63,  63,  63,  63,  63,  63,  63,  63,  63,
		  63, 978,8242,8804,8260,8734, 402,9827,9830,9829,9824,8596,8592,8593,8594,8595,
		  63, 177,8243,8805, 215,8733,8706,8729, 247,8800,8801,8776,8230,  63,  63,8629,
		8501,8465,8476,8472,8855,8853,8709,8745,8746,8835,8839,8836,8834,8838,8712,8713,
		8736,8711, 174, 169,8482,8719,8730,8901, 172,8743,8744,8660,8656,8657,8658,8659,
		9674,9001, 174, 169,8482,8721,  63,  63,  63,  63,  63,  63,  63,  63,  63,  63,
		  63,9002,8747,8992,  63,8993,  63,  63,  63,  63,  63,  63,  63,  63,  63,  63
		];

		var unic = '';
		var htm = '';
		
		for (i = 0; i < chars.length; i++) {
			v = chars.charCodeAt(i) & 0x0fff;
			val = v < table.length ? table[v] : 63;
			unic = unic + String.fromCharCode(val);
			htm = htm + '&#' + val + ';'
		}
		//console.error("Became: " + unic);

		return self.htmlEscape(unic);
	},
	htmlEscape: function(text) {

		return String(text)
			.replace(/&/g, '&amp;')
			.replace(/%/g, '&#37;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');

	},
	injectBoxLinks: function(text) {

		function extractNumbers(number) {
			var numbers = [];
			if (number.indexOf("-") > -1) {
				var start = parseInt(number.split("-")[0]);
				var stop = parseInt(number.split("-")[1]);
				for (var j=start; j <= stop; j++) {
					numbers.push(j);
				}
			} else {
				numbers = [parseInt(number)];
			}
			return numbers;
		}
		
		//Add a space for regex operations
		text = " " + text;

		text = text.replace(/[ (]Figur\s[0-9\-]+/g, function(match) {
			var firstChar = match.substr(0, 1);
			match = match.substr(1);
			var numbers = extractNumbers(match.split(" ")[1]);
			return " <a class=\"btn btn-small figureLink\" href=\"#figure_" + numbers[0] + "\" data-numbers=\"" + numbers.join(",") + "\">" + match + "</a>";
		});

		text = text.replace(/[ (]Tabell\s[0-9\-]+/g, function(match) {
			var firstChar = match.substr(0, 1);
			match = match.substr(1);
			var numbers = extractNumbers(match.split(" ")[1]);
			return " <a class=\"btn btn-small tableLink\" href=\"#table_" + numbers[0] + "\" data-numbers=\"" + numbers.join(",") + "\">" + match + "</a>";
		});

		text = text.replace(/[ (]Faktaruta\s[0-9\-]+/g, function(match) {
			var firstChar = match.substr(0, 1);
			match = match.substr(1);
			var numbers = extractNumbers(match.split(" ")[1]);
			return firstChar + "<a class=\"btn btn-small factsLink\" href=\"#facts_" + numbers[0] + "\" data-numbers=\"" + numbers.join(",") + "\">" + match + "</a>";
		});

		//Remove the added space
		text = text.substr(1);
		return text;
		
	},
	foundGenericas: {},
	injectGenericas: function(text) {
		var self = this;
		
		if (self.genericas === null) {
			self.loadGenericas();
		}

		if (text.trim() !== "") {

			text = " " + text + " ";

			for (var title in self.genericas) {
				var genericaName = title;
				
				var re = new RegExp("[ (/;\[\-]" + RegExp.quote(genericaName.toLowerCase()) + "[^<]", "gi"); 
				text = text.replace(re, function(match) {

					var genericaATC = [];
					var genericaTitles = [];
					var saveGenericaTitles = [];
					
					for (var i=0; i < self.genericas[title].length; i++) {
						genericaATC.push(self.genericas[title][i].id);

						var originalItem = self.getGenericaById(self.genericas[title][i].id);
						if (originalItem !== undefined) {
							genericaTitles.push(self.htmlEscape(originalItem.titlePath).replace(/\s\/\s/g, "<|>").replace(/\(/g, "(|").replace(/\)/g, "|)").replace(/\s/g, "_"));
							saveGenericaTitles.push(originalItem.titlePath + " :: " + originalItem.idPath);
						} else {
							//console.error("Could not find generica for: " + title + " with id: " + self.genericas[title][i].id);
						}
					}

					var href = "/atclist/" + genericaATC.join("-");
					//console.error("Match: \"" + match + "\"");
					var matchedWord = match.substr(1, match.length - 2);
					
					//Save to foundGenericas
					self.foundGenericas[matchedWord] = saveGenericaTitles;
					
					if (genericaTitles.length > 0) {
						var result = match.substr(0, 1) + "<a href=\"" + href + "\" data-atcid=\"" + genericaATC.join(",") + "\" data-atctitles=\"" + genericaTitles.join("##") + "\" class=\"inlineGenerica text\">" + matchedWord + "</a>" + match.substr(match.length - 1);

						if (result.indexOf("klindamycin") > -1) {
							console.error(self.htmlEscape(result));
						}

						return result;
					} else {
						return match.substr(0, 1) + "<span>" + matchedWord + "</span>" + match.substr(match.length - 1);
					}
					//TODO: Perhaps dangerous: data-atc-title=\"" + self.htmlEscape(genericaName) + "\"
				});
			}
			
			text = text.substr(1, text.length - 2);
			text = text.replace(/\<\|\>/g, "--");
			text = text.replace(/\(\|/g, "(");
			text = text.replace(/\|\)/g, ")");

		}


		return text;

	},
	originalGenericas : null,
	getGenericaById: function(id) {
		var self = this;
		var returnItem = undefined;
		
		if (self.originalGenericas === null) {
			self.originalGenericas = JSON.parse(fs.readFileSync(__dirname + "/../npl/atcTree.json"), "utf8");
		}
		for (var i=0; i < self.originalGenericas.length; i++) {
			if (self.originalGenericas[i].id === id) {
				returnItem = self.originalGenericas[i];
				break;
			}
		}
		
		return returnItem;
	},
	loadGenericas: function() {
		var self = this;
		
		var genericas = JSON.parse(fs.readFileSync(__dirname + "/../npl/atcTree.json"), "utf8");
		genericas.shift(); //remove root element

		var blackList = {
			"övrigt": true,
			"kol": true,
			"vitaminer": true,
			"kombinationer": true
		};

		//remove non atc types, exclude short atc-codes and short titles
		genericas = genericas.filter(function(element) {
			if (element.type === "atc" && element.id.length > 3 && element.title.length > 3 && (blackList[element.title.toLowerCase()] === undefined)) {
				var subProducts = self.findProductNamesFromATCCode(element.id);
				return (subProducts.length > 0);
			} else {
				return false;
			}
		});

		//sort with the longest title first
		genericas.sort(function(a, b) {
			return (b.title.length - a.title.length)
		});

		var distilledGenericas = {};

		//add keywords
		var keywords = JSON.parse(fs.readFileSync(__dirname + "/../servers/admin/keywords.json"), "utf8");

		var sortedKeywords = [];

		for (var keyword in keywords) {
			sortedKeywords.push({title: keyword, atc: keywords[keyword].atc});
		}

		//sort with the longest title first
		sortedKeywords.sort(function(a, b) {
			return (b.title.length - a.title.length)
		});

		for (var i=0; i < sortedKeywords.length; i++) {
			if (distilledGenericas[sortedKeywords[i].title.toLowerCase()] === undefined) {
				distilledGenericas[sortedKeywords[i].title.toLowerCase()] = [{id: sortedKeywords[i].atc.split(" ")[0], title: sortedKeywords[i].title, type: "atc"}];
			} else {
				distilledGenericas[sortedKeywords[i].title.toLowerCase()].push({id: sortedKeywords[i].atc.split(" ")[0], title: sortedKeywords[i].title, type: "atc"});
			}
		}

		//create object with keywords for genericas with the same name
		for (var i=0; i < genericas.length; i++) {
			if (distilledGenericas[genericas[i].title.toLowerCase()] === undefined) {
				distilledGenericas[genericas[i].title.toLowerCase()] = [genericas[i]];
			} else {
				/*
				//TODO: Fix: Check if current generica is a descendant of an already added generica
				var alreadyAdded = false;
				for (var j=0; j < distilledGenericas[genericas[i].title.toLowerCase()].length; j++) {
					var item = distilledGenericas[genericas[i].title.toLowerCase()][j];
					if (item.id.indexOf(genericas[i].id) === 0) {
						alreadyAdded = true;
						break;
					}
				}
				if (!alreadyAdded) {
					distilledGenericas[genericas[i].title.toLowerCase()].push(genericas[i]);
				}
				*/
				distilledGenericas[genericas[i].title.toLowerCase()].push(genericas[i]);
			}
		}

		self.genericas = distilledGenericas;

		return;
	},
	isNumber:  function(o) {
	  return ! isNaN (o-0) && o !== null && o !== "" && o !== false;
	},
	findProductNamesFromATCCode: function(atcCode) {
		var result = [];
		var self = this;

		if (self.originalGenericas === null) {
			self.originalGenericas = JSON.parse(fs.readFileSync(__dirname + "/../npl/atcTree.json"), "utf8");
		}

		var atcTree = self.originalGenericas;

		for (var i = 0; i < atcTree.length; i++) {
			if (atcTree[i].parentId === atcCode) {
				if (atcTree[i].type === "product") {
					var productName = atcTree[i].title.split(",")[0].toLowerCase().replace("®", "").split(" ");

					var end = productName.length;
					if (end > 1) {
						end = (end - 1);
					}

					for (var j = 0; j < end; j++) {
						result.push(productName[j]);
					}
				} else if (atcTree[i].type === "atc") {
					result = result.concat(self.findProductNamesFromATCCode(atcTree[i].id));
				}
			}
		}
	
		return result;
	}
	
	
}

//console.error("\nInitializing parser...");
Parser.init();
//console.error("Finished initializing parser.");

//console.error("Opening: " + sourceFilePath);

var niceFileName = sourceFilePath;
if (niceFileName.indexOf("/") > -1) {
	niceFileName = niceFileName.split("/");
	niceFileName = niceFileName[niceFileName.length - 1];
}

var htmlFileName = niceFileName.replace(".mif.mifml", ".html").replace(/\+/g, "-");

console.error("--------------------------------------");
console.error("<a href=\"/" + htmlFileName + "\" target=\"_blank\">" + htmlFileName + "</a>");
console.error("--------------------------------------\n");

Parser.parseFile(sourceFilePath, function(err, result, title) {
	if (err) throw err;

	//console.error("\nParsing finished, sending to stdout...")

	var pdfPath = sourceFilePath.toLowerCase().replace(/\+/g, "-");
	pdfPath = (pdfPath.indexOf("/") > -1) ? pdfPath.split("/")[pdfPath.split("/").length - 1] : pdfPath;
	pdfPath = pdfPath.replace(".mif", "").replace(".mifml", "");
	pdfPath = "/" + pdfPath + "_pdf/" + pdfPath + ".pdf";

	var header = fs.readFileSync(__dirname + "/templates/" + outputType + "/header.html", "utf8");
	header = header.replace("{TITLE}", title + " | Läkemedelsboken");
	header = header.replace("{PDF}", pdfPath);

	var footer = fs.readFileSync(__dirname + "/templates/" + outputType + "/footer.html", "utf8");

	console.log(header);
	console.log(result);
	console.log(footer);

//	console.error("Unhandled tags:");
//	console.error(unhandledTags);
//	console.error("Handled tags:");
//	console.error(handledTags);
	//console.error(Parser.foundGenericas);

	console.error("\nDONE")
	console.error("**************************************");
	
});


var im = require("imagemagick");
var exec = require('child_process').exec;

function resizeImage(imagePath, maxWidth, extension, forceResize, callback) {
	//var maxImageWidth = maxWidth;
	var newDestination = imagePath.replace(".png", extension + ".png");

	if (fs.existsSync(newDestination) && !forceResize) {
		callback(null, "Skipped resize of " + newDestination);
	} else {
		im.identify(imagePath, function(err, features) {
			if (err) { return callback(err); }
			//var maxImageWidth = parseInt((features.width / 2), 10);
			if (maxWidth > features.width) {
				maxWidth = features.width;
			}
			var newWidth = maxWidth;
			var newHeight = parseInt(features.height * (newWidth/features.width), 10);

			//Make sure image is not bigger than 1024*1024*3 for compatibility with iPod Touch 4 and iPhone 3GS
			var maxPixels = 1024*1024*3;

			if (extension.indexOf("_x2") > -1) {
				//Make sure image is not bigger than 1024*1024*5 for compatibility with retina devices
				var maxPixels = 1024*1024*5;
			}

			while((newWidth * newHeight) > maxPixels) {
				var ratio = newWidth / newHeight;
				var oldWidth = newWidth;
				newWidth = newWidth - 5;
				newHeight = parseInt(newHeight * (newWidth/oldWidth), 10);
			}

			im.convert([imagePath, '-resize', newWidth + 'x' + newHeight, 'PNG8:' + newDestination], function(err, stdout) { //, "-colors", "256"
				if (err) { return callback(err); }
				
				var optImageDir = newDestination.split("/");
				var newFileName = optImageDir.pop();
				optImageDir = optImageDir.join("/") + "/opt/";

				wrench.mkdirSyncRecursive(optImageDir);
				
				exec("pngnq -e .png -f -s 1 -d " + optImageDir + " " + newDestination, function (error, stdout, stderr) {
					//console.error('stdout: ' + stdout);
					//console.error('stderr: ' + stderr);
					if (error !== null) {
						//console.error('exec error: ' + error);
					}
					
					exec("pngout -s1 -y " + optImageDir + "/" + newFileName, function (error, stdout, stderr) {
						callback(null, "Resized: " + imagePath + " to " + newWidth + "x" + newHeight + " at " + newDestination);
					});
				});

			});
		});
		
	}

}
