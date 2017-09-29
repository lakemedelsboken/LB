(function() {

	var minimumJQueryMajor = 1;
	var minimumJQueryMinor = 11;
	var preferredJQuery = "1.11.1";

	function log(message) {
		if (console && console.log) {
			console.log("LB: " + message);
		}
	}

	log("Init jQuery check...")

	if (window.jQuery !== undefined) {


		var minJqueryMajor = parseInt(window.jQuery.fn.jquery.split(".")[0]);
		var minJqueryMinor = parseInt(window.jQuery.fn.jquery.split(".")[1]);

		log("Current jQuery version is " + minJqueryMajor + "." + minJqueryMinor);
		
		if (minJqueryMajor < minimumJQueryMajor || (minJqueryMajor <= minimumJQueryMajor && minJqueryMinor < minimumJQueryMinor)) {

			log("Loading jQuery from cdn, version did not match...");

			var done = false;
			var script = document.createElement("script");
			script.src = "http://ajax.googleapis.com/ajax/libs/jquery/" + preferredJQuery + "/jquery.min.js";
			script.onload = script.onreadystatechange = function(){
				if (!done && (!this.readyState || this.readyState == "loaded" || this.readyState == "complete")) {
				
					log("Done loading jQuery.")
					done = true;
					initLBBookmarklet();
				}
			};
			document.getElementsByTagName("head")[0].appendChild(script);
		} else {

			log("jQuery is fine");
			done = true;
			initLBBookmarklet();

		}
	} else {

		log("Loading jQuery from cdn...");

		var done = false;
		var script = document.createElement("script");
		script.src = "http://ajax.googleapis.com/ajax/libs/jquery/" + preferredJQuery + "/jquery.min.js";
		script.onload = script.onreadystatechange = function(){
			if (!done && (!this.readyState || this.readyState == "loaded" || this.readyState == "complete")) {
			
				log("Done loading jQuery.")
				done = true;
				initLBBookmarklet();
			}
		};
		document.getElementsByTagName("head")[0].appendChild(script);
	}
	
	function initLBBookmarklet() {
		(window.lbBookmarklet = function() {

			initClickOver();
			
			$.important();
			
			function getNewBodyContent(callback) {

				var sendData = encodeURIComponent(window.location.href);
				
				log("Using " + sendData + " for server content lookup");
				
				$.getJSON("http://{ENVIRONMENT}/api/v1/injectgenericas/{URL_SELECTOR}/?url=" + sendData + "&apikey={APIKEY}&callback=?", function(data) {
					callback(null, data.content);
				})
				.fail(function(request, textStatus, error) {
					var err = textStatus + ", " + error;
					callback(err);
				});
			}
						
			log("Running");

			//Display loading box
			//var loadBox = $("<div style=\"display: none;z-index: 10000;position: fixed;top: 10px;left: 10px;background: #fff;width: 200px;text-align: center;color: #000;font-size: 14px;text-decoration: none;font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;border: solid 1px black;padding: 10px;-webkit-border-radius: 4px 4px 4px 4px;-moz-border-radius: 4px 4px 4px 4px;border-radius: 4px 4px 4px 4px;\">Försöker hitta huvudinnehåll...</div>");

			//$("body").append(loadBox);
			//loadBox.show("fast");

			//loadBox.html("Letar efter substansnamn...")
			log("Searching for substances...");
				
			getNewBodyContent(function(err, data) {
				if (err) {
					//Remove loading box
					//loadBox.html("Lyckades inte hitta substanser");
					log("Could not find any substances.");
					//setTimeout(function() {
					//	loadBox.hide("fast");
					//}, 2000);
					log(err);
				} else if (data === "") {
					log("Answer from server was empty.");
				} else {
					//Remove loading box
					//loadBox.html("Färdig.");
					//setTimeout(function() {
					//	loadBox.hide("fast");
					//}, 1000);
					
					//Attach handlers
					$("body").on("click", "a.inlineGenerica", handleGenericas);
					$("body").on("click", "a.atcCodeInPopover", handleAtcCodeInPopover);
					$("head").append('<link rel="stylesheet" href="http://{ENVIRONMENT}/api/v1/injectgenericas/lb.injectgenericas.css" id="injectGenericasStyles">');

					//Switch content
					var selectedElement = $("{SELECTOR}");

					if (selectedElement.length > 0) {
						selectedElement = selectedElement.first();
						selectedElement.html(data);
						log("Done loading substances.");
					}

				}
			});
				

			var lb = {
				tipCounter: 0,
				getATCItems: function(parentId, callback) {
					var out = {atcCode: parentId};
					$.getJSON("http://{ENVIRONMENT}/api/v1/atctree?parentid=" + encodeURIComponent(parentId) + "&callback=?", function(results) {
						out.data = results;
						callback(null, out);
					}).error(function() { //jqXHR, status, error
						callback("Kunde inte hitta rubriker", out);
					});
				},
				getBoxSearch: function(medName, callback) {
					var out = [];
					$.getJSON("http://{ENVIRONMENT}/api/v1/contentsearch?search=" + encodeURIComponent(medName) + "&callback=?", function(results) {
						out = results;
						callback(null, out);
					}).error(function() { //jqXHR, status, error
						callback("Preparatet kunde inte hittas", out);
					});
				},
				getIcon: function() { //type
					return "";
				}
			};
			

			function handleGenericas(event) {
				
				log("handleGenericas");
				//event.preventDefault();
				
				var atcCodes = $(this).attr("data-atcid");
				var medName = $(this).text();

				if (atcCodes.indexOf(",") > -1) {
					atcCodes = atcCodes.split(",");
				} else {
					atcCodes = [atcCodes];
				}

				var atcTitles = $(this).attr("data-atctitles");

				if (atcTitles.indexOf("##") > -1) {
					atcTitles = atcTitles.split("##");
				} else {
					atcTitles = [atcTitles];
				}

				if ($(this).attr("data-original-title") === undefined) {
					var popoverPlacement = "bottom";
					var content = "<div class=\"lb\"><div class=\"lb\" style=\"float: left !important; width: 47% !important;\"><h4 class=\"lb\">Preparat</h4>";
					for (var i=0; i < atcCodes.length; i++) {
						var atcCode = atcCodes[i];
						content += "<h6 class=\"lb " + atcCode + "\">" + atcTitles[i].replace(/\-\-/g, " - ").replace(/_/g, " ") + "</h6><ul class=\"lb " + atcCode + " nav nav-tabs nav-stacked\"><li class=\"lb loading\"><a class=\"lb\" href=\"#\"><i class=\"lb icon icon-refresh icon-spin\"></i> Hämtar rubriker...</a></ul>";
					}
			
					content += "</div><div class=\"lb\" style=\"float: left !important; width: 47% !important; margin-left: 5% !important;\"><h4 class=\"lb\">Innehåll</h4><ul class=\"lb search-" + atcCodes.join("") + " nav nav-tabs nav-stacked\"><li class=\"lb loading\"><a class=\"lb\" href=\"#\"><i class=\"lb icon icon-refresh icon-spin\"></i> Söker...</a></ul></div>";
					var title = "Preparatinformation från <a class=\"lb\" href=\"http://{ENVIRONMENT}\" target=\"_blank\">Läkemedelsboken</a>";

					title += '<button type="button" class="lb close" data-dismiss="clickover">&times;</button>'

					lb.tipCounter++;
					var tipId = "tip_" + lb.tipCounter;

					var popoverWidth = 500;

					if ($(document).width() < popoverWidth - 30) {
						popoverWidth = $(document).width() - 30;
					}

					$(this).clickover({
						placement: popoverPlacement,
						content: content, 
						animation: true,
						title: title,
						width: popoverWidth + "px",
						html: true,
						allow_multiple: true,
						tip_id: tipId,
						esc_close: 0,
						onShown: function() {
							var completionCounter = 0;
							
							//Search in information boxes
							lb.getBoxSearch(medName, function(err, results) {
								var currentTherapyMenu = $("ul.search-" + atcCodes.join(""));
								currentTherapyMenu.find(".loading").remove();
								if (err) {
									currentBoxMenu.append("<li class=\"lb\"><a class=\"lb\" href=\"#\"><i class=\"lb icon icon-info-sign\"></i> Sökningen misslyckades</a></li>");
								} else {
									//currentTherapyMenu.find(".loading").remove();
									if (results.length === 0) {
										currentTherapyMenu.append("<li class=\"lb\"><a class=\"lb\" href=\"#\"><i class=\"lb icon icon-info-sign\"></i> Substansen nämns inte i några informationsrutor</a></li>");
										currentTherapyMenu.menu("refresh");
									} else {
										
										if (results.length > 5) {
											results.length = 5;
										}
										
										for (var i = 0; i < results.length; i++) {

											var item = results[i];

											var titlePath = (item.titlePath_HL !== undefined) ? item.titlePath_HL : item.titlePath;
											if (titlePath.indexOf(" && ") > -1) {
												titlePath = titlePath.split(" && ");
												titlePath.pop();
												titlePath = titlePath.join(" &#187; ");
											}

											var title = (item.title_HL !== undefined) ? item.title_HL : item.title;
							
											currentTherapyMenu.append($("<li class=\"lb\"><a class=\"lb boxSearchResult\" target=\"_blank\" href=\"http://{ENVIRONMENT}/" + item.chapter + "?search=&iso=false&imo=false&nplId=null&id=" + item.id + "\"><i class=\"lb icon " + lb.getIcon(item.type) + "\"></i> <strong class=\"lb\">" + title + "</strong><br class=\"lb\"><small class=\"lb\">" + titlePath + "</small><div class=\"lb\">" + item.content_HL + "</div></a></li>")); 

										}

										//currentTherapyMenu.menu("refresh");

									}
								}
								//console.log(results);
							});

							//Find ATC list items
							for (var i=0; i < atcCodes.length; i++) {
								var atcCode = atcCodes[i];

								lb.getATCItems(atcCode, function(err, results) {
									var currentATCMenu = $("ul." + results.atcCode);
									currentATCMenu.find(".loading").remove();
									if (err) {
										currentATCMenu.append("<li class=\"lb\"><a class=\"lb\" href=\"#\"><i class=\"lb icon icon-info-sign\"></i> Kunde inte hitta rubriker</a></li>");
									} else {
										
										var noInfoItems = "";
										
										for (var i = 0; i < results.data.length; i++) {

											var item = results.data[i];
											if (item.hasChildren) {
												currentATCMenu.append("<li class=\"lb\" id=\"" + tipId + "_" + item.id + "\"><a target=\"_blank\" href=\"http://{ENVIRONMENT}/atc/" + item.id + "\" data-indentation=\"0\" class=\"lb atcCodeInPopover\"><i class=\"lb icon icon-plus-sign-alt\">+</i><i class=\"lb icon icon-angle-down pull-right\"></i> <strong class=\"lb\">" + item.text + "</strong></a></li>");
											} else if (item.children && item.children.length > 0) {
												for (var j = 0; j < item.children.length; j++) {
													var productItem = item.children[j];
													var images = "";
													if (productItem.images) {
														for (var x=0; x < productItem.images.length; x++) {
															images += "<img src=\"http://{ENVIRONMENT}" + productItem.images[x] + "\" class=\"lb img-polaroid pull-right\" style=\"width: 15px !important; height: 15px !important; margin-right: 5px !important;\" />";
														}
													}
													var productInfo = productItem.text.split(",");
													//productInfo.shift();

													if (j === 0) {
														productInfo[0] = "<strong class=\"lb\">" + productInfo[0] + "</strong>";
													} else {
														//productInfo.shift();
													}

													productInfo = productInfo.join(",");

													var extraIndent = 0;
													//if (j > 0) {
														//extraIndent = 25;
														//}
												
													if (productItem.noinfo === true) {
														noInfoItems += "<li" + (productItem.noinfo === true ? " class=\"lb ui-state-disabled\"" : " class=\"lb\"") + "><a target=\"_blank\" href=\"http://{ENVIRONMENT}/?imo=true&nplId=" + productItem.id + "\" data-product-id=\"" + productItem.id + "\" class=\"lb inlineProduct\" " + ((extraIndent > 0) ? " style=\"padding-left: " + extraIndent + "px !important;\"" : "") + ">" + images + productInfo + "</a></li>";
													} else {
														currentATCMenu.append("<li" + (productItem.noinfo === true ? " class=\"lb ui-state-disabled\"" : " class=\"lb\"") + "><a target=\"_blank\" href=\"http://{ENVIRONMENT}/?imo=true&nplId=" + productItem.id + "\" data-product-id=\"" + productItem.id + "\" class=\"lb inlineProduct\" " + ((extraIndent > 0) ? " style=\"padding-left: " + extraIndent + "px !important;\"" : "") + ">" + images + productInfo + "</a></li>");
													}
												}
											} else {
												//console.log(item);
											}

										}
										
										if (noInfoItems.length > 0) {
											currentATCMenu.append(noInfoItems);
										}
									
										if (results.data.length === 0) {
										
											$("h6." + results.atcCode).remove();
											currentATCMenu.remove();
										} else {
											//currentATCMenu.menu("refresh");
										}

									}
									++completionCounter;
								
									if (completionCounter === atcCodes.length) {
										//On completion
										onCompletedAtcCodes();
									}
								});
								function onCompletedAtcCodes() {
									//Display message when the popover is empty
									if ($("#" + tipId).find("h6").length === 0) {
										$("#" + tipId).find(".popover-content").html("<h5 class=\"lb\"><i class=\"lb icon icon-info-sign\"></i> Tyvärr hittades inga preparat för denna rubrik</h5>");
									}
								}
							}
					
						}
					});

					var that = this;

					setTimeout(function() {
						$(that).click();
					}, 10);

				}

				event.preventDefault();
				//event.cancelBubble();
		
			}

			function handleAtcCodeInPopover(event) {
				event.preventDefault();
				event.stopPropagation();

				var currentAnchor = $(this);
	
				if (currentAnchor.attr("data-already-loaded") !== undefined) {
					//Close sub menu

					var id = currentAnchor.parent().attr("id");
					//var parentMenu = $("#" + id).parents("ul.ui-menu");

					var indentationLevel = parseInt(currentAnchor.attr("data-indentation"));
		
					//Find proceeding items with higher indentation level and remove
					currentAnchor.parent().nextAll().each(function(index, element) {
						var firstAnchor = $(element).find("a").first();
						if (firstAnchor.attr("data-indentation") !== undefined && parseInt(firstAnchor.attr("data-indentation")) > indentationLevel) {
							$(element).remove();
						} else {
							return false;
						}
					});
		
					//Remove attribute data-already-loaded
					currentAnchor.removeAttr("data-already-loaded");

					//Set icon
					currentAnchor.find("i.icon-minus-sign-alt").removeClass("icon-minus-sign-alt").addClass("icon-plus-sign-alt").html("+");

					//parentMenu.menu("refresh");
		
					//parentMenu.menu("focus", null, currentAnchor.parent());
		
					return;
				} else {
					currentAnchor.attr("data-already-loaded", "true");

					var id = currentAnchor.parent().attr("id");
					var atcCode = id.split("_");
					atcCode = atcCode[atcCode.length - 1];
					var tipId = id.split("_");
					tipId.pop();
					tipId = tipId.join("_");
	
					//console.log(atcCode);
					//console.log(tipId);
					//var parentMenu = $("#" + id).parents("ul.ui-menu");

					//Display loading indicator
					currentAnchor.find("i.icon-plus-sign-alt").removeClass("icon-plus-sign-alt").addClass("icon-refresh");
					currentListItem = currentAnchor.parent();

					var indentationLevel = parseInt(currentAnchor.attr("data-indentation"));
					var indentationPixels = ((indentationLevel + 1) * 25) + "px"; 

					//Fetch info
					lb.getATCItems(atcCode, function(err, results) {
						currentAnchor.find("i.icon-refresh").removeClass("icon-refresh").addClass("icon-minus-sign-alt").html("-");
						if (err) {
							currentAnchor.find("i.icon-minus-sign-alt").removeClass("icon-minus-sign-alt").addClass("icon-info-sign").html("(i)");
							var oldText = currentAnchor.text();
							currentAnchor.find("strong").text("Kunde inte hämta information för \"" + oldText + "\"");
			
							//parentMenu.menu("refresh");
						} else {
							var content = "";
							var noInfoItems = "";
							for (var i = 0; i < results.data.length; i++) {

								var item = results.data[i];
								if (item.hasChildren) {
									content += "<li class=\"lb\" id=\"" + tipId + "_" + item.id + "\"><a target=\"_blank\" href=\"http://{ENVIRONMENT}/atc/" + item.id + "\" data-indentation=\"" + (indentationLevel + 1) + "\" class=\"lb atcCodeInPopover\" style=\"padding-left: " + indentationPixels + " !important;\"><i class=\"lb icon icon-plus-sign-alt\">+</i><i class=\"icon icon-angle-down pull-right\"></i> <strong class=\"lb\">" + item.text + "</strong></a></li>";
								} else if (item.children && item.children.length > 0) {
									//content += "<li><a style=\"padding-left: " + indentationPixels + ";\"><strong>" + item.text + "</strong></a></li>";
					
									for (var j = 0; j < item.children.length; j++) {
										var productItem = item.children[j];
						
										var images = "";
										if (productItem.images) {
											for (var x=0; x < productItem.images.length; x++) {
												images += "<img src=\"http://{ENVIRONMENT}" + productItem.images[x] + "\" class=\"lb img-polaroid pull-right\" style=\"width: 15px !important; height: 15px !important; margin-right: 5px !important;\" />";
											}
										}
						
										var productInfo = productItem.text.split(",");
										if (j === 0) {
											productInfo[0] = "<strong class=\"lb\">" + productInfo[0] + "</strong>";
										} else {
											//productInfo.shift();
										}

										productInfo = productInfo.join(",");
						
										var extraIndent = 0;
										//if (j > 0) {
											//extraIndent = 25;
											//}

										if (productItem.noinfo === true) {
											noInfoItems += "<li" + (productItem.noinfo === true ? " class=\"lb ui-state-disabled\"" : " class=\"lb\"") + "><a target=\"_blank\" href=\"http://{ENVIRONMENT}/?imo=true&nplId=" + productItem.id + "\" data-product-id=\"" + productItem.id + "\" class=\"lb inlineProduct\" data-indentation=\"" + (indentationLevel + 1) + "\" style=\"padding-left: " + (parseInt(indentationPixels) + extraIndent) + "px !important;\">" + images + productInfo + "</a></li>"; 
										} else {
											content += "<li" + (productItem.noinfo === true ? " class=\"lb ui-state-disabled\"" : " class=\"lb\"") + "><a target=\"_blank\" href=\"http://{ENVIRONMENT}/?imo=true&nplId=" + productItem.id + "\" data-product-id=\"" + productItem.id + "\" class=\"lb inlineProduct\" data-indentation=\"" + (indentationLevel + 1) + "\" style=\"padding-left: " + (parseInt(indentationPixels) + extraIndent) + "px !important;\">" + images + productInfo + "</a></li>";
										}
									}

					
								} else {
									//console.log(item);
								}
							}

							content += noInfoItems
							
							
							if (content !== "") {
								currentListItem.after(content);
							} else {
								currentListItem.after("<li class=\"lb\"><a class=\"lb\" style=\"padding-left: " + indentationPixels + " !important;\"><i class=\"lb icon icon-info-sign\"></i> Det finns inga underliggande preparat</a></li>");
							}
							//parentMenu.menu("refresh");
			
							//parentMenu.menu("focus", null, currentListItem);
						}
					});

				}
	
			}

			
		})();
	}
	
	function initClickOver() {

		function log(message) {
			if (console && console.log) {
				console.log("LB: ", message);
			}
		}

		/*!
		* !important
		*   github.com/premasagar/important/
		*
		*//*
		css !important manipulator (jQuery plugin)

		by Premasagar Rose
		dharmafly.com

		license
		opensource.org/licenses/mit-license.php
        
		v0.1

		*//*
		creates methods
		jQuery.important()
		jQuery(elem).important()
        
		optionally modified the native jQuery CSS methods: css(), width(), height(), animate(), show() and hide(), allowing an optional last argument of boolean true, to pass the request through the !important function
    
		use jQuery.important.noConflict() to revert back to the native jQuery methods, and returns the overriding methods
    
		reference
		http://www.w3.org/TR/CSS2/syndata.html#tokenization

		*/
		(function($){
			'use strict';

			// create CSS text from property & value, optionally inserting it into the supplied CSS rule
			// e.g. declaration('width', '50%', 'margin:2em; width:auto;');
			function cssDeclaration(property, value, rules){ // if value === null, then remove from style; if style then merge with that
    
				// return a regular expression of a declaration, with the backreferences as the CSS property and the value
				function regexDeclaration(property){
					return new RegExp('(?:^|\\s|;)(' + property + ')\\s*:\\s*([^;]*(?:;|$))', 'i');
				}
				function find(property, rules){
					var match = rules.match(regexDeclaration(property));
					if (match){
						// a bit inelegant: remove leading semicolon if present
						match[0] = match[0].replace(/^;/, '');
					}
					return match;
				}
    
				var oldDeclaration, newDeclaration, makeImportant;
        
				rules = rules || '';
				oldDeclaration = find(property, rules);
            
				if (value === null){
					newDeclaration = '';
				}
				else if (typeof value === 'string'){
					newDeclaration = property + ':' + value + ' !important;';
				}
        
				if (oldDeclaration){
					if (typeof value === 'boolean'){
						makeImportant = value;
						newDeclaration = $.important(property + ':' + oldDeclaration[2], makeImportant);
					}
					rules = rules.replace(oldDeclaration[0], newDeclaration);
				}
        
				else if (typeof newDeclaration !== 'undefined'){
					rules = $.trim(rules);
					if (rules !== ''){
						if (rules.slice(-1) !== ';'){
							rules += ';';
						}
						rules += ' ';
					}
					rules += newDeclaration;
				}
				return rules;
			}
    
    
			// Add !important to CSS rules if they don't already have it
			function toImportant(rulesets, makeImportant){
				// Cache regular expression
				var re = toImportant.re;
				if (!re){
					re = toImportant.re =
					/\s*(! ?important)?[\s\r\t\n]*;/g;
					// TODO: Make this regexp handle missing semicolons at the end of a ruleset
				}
				if (makeImportant === false){
					return rulesets.replace(re, ';');
				}
				return rulesets.replace(re, function($0, $1){
					return $1 ? $0 : ' !important;';
				});
			}
    
			function htmlStylesToImportant(html, makeImportant){
				// Cache regular expression
				var re = htmlStylesToImportant.re;
				if (!re){
					re = htmlStylesToImportant.re =
					/(?=<style[^>]*>)([\w\W]*?)(?=<\/style>)/g;
				}
				return html.replace(re, function($0, rulesets){
					return toImportant(rulesets, makeImportant);
				});
			}
    
			// **
    
			var
				important = false,
				original = {},
				controller = {},
			replacement = $.each(
				{
					css:
					function(property, value){
						var
							rulesHash = {},
							elem = $(this),
							rules = elem.attr('style');	                    
	                    
						// Create object, if arg is a string
						if (typeof property === 'string'){
							// CSS lookup
							if (typeof value === 'undefined'){
								return original.css.apply(this, arguments);
							}
	                    
							rulesHash[property] = value;
						}
						else if (typeof property === 'object'){
							rulesHash = property;
						}
						else {
							return elem;
						}
						$.each(rulesHash, function(property, value){
							rules = cssDeclaration(property, value, rules);
						});
						return elem.attr('style', rules);
					}
                    
					// TODO: other methods to be supported
					/*,
	            
					width: function(){},
					height: function(){},
					show: function(){},
					hide: function(){},
					animate: function(){}
					*/
				},
	        
				function(method, fn){
					original[method] = $.fn[method];
					fn.overridden = true; // for detecting replacementn state
	        
					controller[method] = function(){
						var
							args = $.makeArray(arguments),
							lastArg = args[args.length-1],
							elem = $(this);
	                
						// boolean true passed as the last argument
						if (lastArg === true){
							return fn.apply(elem, args.slice(0,-1));
						}
						// $.important() === true && boolean false not passed
						else if (important && lastArg !== false){
							return fn.apply(elem, args);
						}
						// apply original, native jQuery method
						return original[method].apply(elem, args);
					};
				}
			);
	
			// Override the native jQuery methods with new methods
			$.extend($.fn, controller);
    
			// jQuery.important
			$.important = $.extend(
				function(){
					var
						args = $.makeArray(arguments),
						makeImportant, cacheImportant;
            
					if (typeof args[0] === 'string'){
						if (typeof args[1] === 'undefined' || typeof args[1] === 'boolean'){
							makeImportant = (args[1] !== false);
                    
							return (/<\w+.*>/).test(args[0]) ?
							htmlStylesToImportant(args[0], makeImportant) :
							toImportant(args[0], makeImportant);
						}
					}
            
					// If a function is passed, then execute it while the !important flag is set to true
					else if ($.isFunction(args[0])){
						cacheImportant = important;
						$.important.status = important = true;
						args[0].call(this);
						$.important.status = important = cacheImportant;
					}
            
					else if (typeof args[0] === 'undefined' || typeof args[0] === 'boolean'){
						$.important.status = important = (args[0] !== false);
					}
            
					return important;
				},
				{
					status: important,
        
					// release native jQuery methods back to their original versions and return overriding methods
					noConflict: function(){
						$.each(original, function(method, fn){
							$.fn[method] = fn;
						});
						return replacement;
					},
            
					declaration: cssDeclaration
				}
			);
	    
	
			// jQuery(elem).important()
			$.fn.important = function(method){
				var
					elem = $(this),
					args = $.makeArray(arguments).concat(true),
					nodeName = elem.data('nodeName'),
					property, makeImportant, fn, oldStyleElem, newStyleInsert, newStyleInsertVerb;
                
				// .css() is the default method, e.g. $(elem).important({border:'1px solid red'});
				if (typeof method === 'undefined' || typeof method === 'boolean'){
					// special behaviour for specific elements
					if (!nodeName){
						nodeName = elem.attr('nodeName').toLowerCase();
						elem.data('nodeName', nodeName);
					}
					// style elements
					if (nodeName === 'style'){
						makeImportant = (method !== false);
                
						elem.html(
							toImportant(elem.html(), makeImportant)
						);
                
						var stylesheet = elem.attr('sheet');
						if (stylesheet && stylesheet.cssRules){
							$.each(stylesheet.cssRules, function(i, rule){
								if (rule.type === CSSRule.STYLE_RULE){
									rule.style.cssText = $.important(rule.style.cssText, makeImportant);
								}
							});
						}
					}
					else {
						elem.attr(
							'style',
							$.important(elem.attr('style'), method)
						);
					}
					return elem;
				}
				else if (typeof method === 'object'){
					args.unshift('css');
					return elem.important.apply(this, args);
				}
				else if (typeof method === 'string'){
					if ($.isFunction(controller[method])){
						args = args.slice(1);
						controller[method].apply(elem, args);
					}
					// switch the !important statement on or off for a particular property in an element's inline styles - but instead of elem.css(property), they should directly look in the style attribute
					// e.g. $(elem).important('padding');
					// e.g. $(elem).important('padding', false);
					else if (typeof args[1] === 'undefined' || typeof args[1] === 'boolean'){
						property = method;
						makeImportant = (args[1] !== false);

						elem.attr(
							'style',
							cssDeclaration(property, makeImportant, elem.attr('style'))
						);
					}
				}
				// pass a function, which will be executed while the !important flag is set to true
				/* e.g.
				elem.important(function(){
				$(this).css('height', 'auto');
				});
				*/
				else if ($.isFunction(method)){
					fn = method;
					$.important.call(this, fn);
				}
               
				return elem;
			};
		}(window.jQuery));

/*
    NOTES:
    http://dev.w3.org/csswg/cssom/#dom-cssstyledeclaration-getpropertypriority
    $('style')[0].sheet.cssRules[0].style.getPropertyPriority('color');
    cssText on style object possible
*/

		/* ===========================================================
		* bootstrap-tooltip.js v2.0.1
		* http://twitter.github.com/bootstrap/javascript.html#tooltips
		* Inspired by the original jQuery.tipsy by Jason Frame
		* ===========================================================
		* Copyright 2012 Twitter, Inc.
		*
		* Licensed under the Apache License, Version 2.0 (the "License");
		* you may not use this file except in compliance with the License.
		* You may obtain a copy of the License at
		*
		* http://www.apache.org/licenses/LICENSE-2.0
		*
		* Unless required by applicable law or agreed to in writing, software
		* distributed under the License is distributed on an "AS IS" BASIS,
		* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
		* See the License for the specific language governing permissions and
		* limitations under the License.
		* ========================================================== */

		!function( $ ) {

			"use strict"

			/* TOOLTIP PUBLIC CLASS DEFINITION
			* =============================== */

			var Tooltip = function ( element, options ) {
				this.init('tooltip', element, options)
			}

			Tooltip.prototype = {

				constructor: Tooltip

				, init: function ( type, element, options ) {
					var eventIn
						, eventOut

						this.type = type
						this.$element = $(element)
						this.options = this.getOptions(options)
						this.enabled = true

					if (this.options.trigger != 'manual') {
						eventIn  = this.options.trigger == 'hover' ? 'mouseenter' : 'focus'
						eventOut = this.options.trigger == 'hover' ? 'mouseleave' : 'blur'
						this.$element.on(eventIn, this.options.selector, $.proxy(this.enter, this))
						this.$element.on(eventOut, this.options.selector, $.proxy(this.leave, this))
					}

					this.options.selector ?
					(this._options = $.extend({}, this.options, { trigger: 'manual', selector: '' })) :
					this.fixTitle()
				}

				, getOptions: function ( options ) {
					options = $.extend({}, $.fn[this.type].defaults, options, this.$element.data())

					if (options.delay && typeof options.delay == 'number') {
						options.delay = {
							show: options.delay
							, hide: options.delay
						}
					}

					return options
				}

				, enter: function ( e ) {
					var self = $(e.currentTarget)[this.type](this._options).data(this.type)

					if (!self.options.delay || !self.options.delay.show) {
						self.show()
					} else {
						self.hoverState = 'in'
						setTimeout(function() {
							if (self.hoverState == 'in') {
								self.show()
							}
						}, self.options.delay.show)
					}
				}

				, leave: function ( e ) {
					var self = $(e.currentTarget)[this.type](this._options).data(this.type)

					if (!self.options.delay || !self.options.delay.hide) {
						self.hide()
					} else {
						self.hoverState = 'out'
						setTimeout(function() {
							if (self.hoverState == 'out') {
								self.hide()
							}
						}, self.options.delay.hide)
					}
				}

				, show: function () {
					var $tip
						, inside
						, pos
						, actualWidth
						, actualHeight
						, placement
						, tp

					if (this.hasContent() && this.enabled) {
						$tip = this.tip()
						this.setContent()

						if (this.options.animation) {
							$tip.addClass('fade')
						}

						placement = typeof this.options.placement == 'function' ?
						this.options.placement.call(this, $tip[0], this.$element[0]) :
						this.options.placement

						inside = /in/.test(placement)

						var parent = document.body;

						if (this.options.parentElement) {
							parent = $(this.options.parentElement);
						}

						$tip
						.remove()
						.css({ top: 0, left: 0, display: 'block' })
						.appendTo(inside ? this.$element : parent)

						pos = this.getPosition(inside)

						if (this.options.parentElement) {
							pos.top = this.$element.position().top + this.options.parentElement.scrollTop();
							pos.left = this.$element.position().left;
						}


						actualWidth = $tip[0].offsetWidth
						actualHeight = $tip[0].offsetHeight

						switch (inside ? placement.split(' ')[1] : placement) {
						case 'bottom':
							tp = {top: (pos.top + pos.height) + "px", left: (pos.left + pos.width / 2 - actualWidth / 2) + "px"}
							break
						case 'top':
							tp = {top: (pos.top - actualHeight) + "px", left: (pos.left + pos.width / 2 - actualWidth / 2) + "px"}
							break
						case 'left':
							tp = {top: (pos.top + pos.height / 2 - actualHeight / 2) + "px", left: (pos.left - actualWidth) + "px"}
							break
						case 'right':
							tp = {top: (pos.top + pos.height / 2 - actualHeight / 2) + "px", left: (pos.left + pos.width) + "px"}
							break
						}

						var indent = 20;

						var maxRightPosition = ($(window).width() - indent);
						var maxLeftPosition = indent;

						if (this.options.parentElement) {
							indent = 2;
							maxRightPosition = this.options.parentElement.width() - indent;
							maxLeftPosition = indent;
						}

						if ((parseInt(tp.left) + parseInt(actualWidth)) > maxRightPosition) {
							tp.left = (maxRightPosition - indent - actualWidth) + "px";

							$tip.find(".arrow").css("left", (pos.left + (pos.width / 2) - parseInt(tp.left)) + "px");

						}

						if (parseInt(tp.left) < maxLeftPosition) {
							tp.left = maxLeftPosition + "px";

							$tip.find(".arrow").css("left", (pos.left + (pos.width / 2) - parseInt(tp.left)) + "px");
						}

						$tip
						.css(tp)
						.addClass(placement)
						.addClass('in')
					}
				}

				, setContent: function () {
					var $tip = this.tip()
						$tip.find('.tooltip-inner').html(this.getTitle())
						$tip.removeClass('fade in top bottom left right')
				}

				, hide: function () {
					var that = this
						, $tip = this.tip()

						$tip.removeClass('in')

					function removeWithAnimation() {
						var timeout = setTimeout(function () {
							$tip.off($.support.transition.end).remove()
						}, 500)

						$tip.one($.support.transition.end, function () {
							clearTimeout(timeout)
							$tip.remove()
						})
					}

					$.support.transition && this.$tip.hasClass('fade') ?
					removeWithAnimation() :
					$tip.remove()
				}

				, fixTitle: function () {
					var $e = this.$element
					if ($e.attr('title') || typeof($e.attr('data-original-title')) != 'string') {
						$e.attr('data-original-title', $e.attr('title') || '').removeAttr('title')
					}
				}

				, hasContent: function () {
					return this.getTitle()
				}

				, getPosition: function (inside) {
					return $.extend({}, (inside ? {top: 0, left: 0} : this.$element.offset()), {
						width: this.$element[0].offsetWidth
						, height: this.$element[0].offsetHeight
					})
				}

				, getTitle: function () {
					var title
						, $e = this.$element
						, o = this.options

						title = $e.attr('data-original-title')
						|| (typeof o.title == 'function' ? o.title.call($e[0]) :  o.title)

						title = title.toString().replace(/(^\s*|\s*$)/, "")

						return title
				}

				, tip: function () {
					return this.$tip = this.$tip || $(this.options.template)
				}

				, validate: function () {
					if (!this.$element[0].parentNode) {
						this.hide()
						this.$element = null
						this.options = null
					}
				}

				, enable: function () {
					this.enabled = true
				}

				, disable: function () {
					this.enabled = false
				}

				, toggleEnabled: function () {
					this.enabled = !this.enabled
				}

				, toggle: function () {
					this[this.tip().hasClass('in') ? 'hide' : 'show']()
				}

			}


			/* TOOLTIP PLUGIN DEFINITION
			* ========================= */

			$.fn.tooltip = function ( option ) {
				return this.each(function () {
					var $this = $(this)
						, data = $this.data('tooltip')
						, options = typeof option == 'object' && option
						if (!data) $this.data('tooltip', (data = new Tooltip(this, options)))
							if (typeof option == 'string') data[option]()
				})
			}

			$.fn.tooltip.Constructor = Tooltip

			$.fn.tooltip.defaults = {
				animation: true
				, delay: 0
				, selector: false
				, placement: 'top'
				, trigger: 'hover'
				, title: ''
				, parentElement: false
				, template: '<div class="tooltip"><div class="tooltip-arrow"></div><div class="tooltip-inner"></div></div>'
			}

		}( window.jQuery );

		/* ===========================================================
		* bootstrap-popover.js v2.0.1
		* http://twitter.github.com/bootstrap/javascript.html#popovers
		* ===========================================================
		* Copyright 2012 Twitter, Inc.
		*
		* Licensed under the Apache License, Version 2.0 (the "License");
		* you may not use this file except in compliance with the License.
		* You may obtain a copy of the License at
		*
		* http://www.apache.org/licenses/LICENSE-2.0
		*
		* Unless required by applicable law or agreed to in writing, software
		* distributed under the License is distributed on an "AS IS" BASIS,
		* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
		* See the License for the specific language governing permissions and
		* limitations under the License.
		* =========================================================== */


		!function( $ ) {

			"use strict"

			var Popover = function ( element, options ) {
				this.init('popover', element, options)
			}

			/* NOTE: POPOVER EXTENDS BOOTSTRAP-TOOLTIP.js
			========================================== */

			Popover.prototype = $.extend({}, $.fn.tooltip.Constructor.prototype, {

				constructor: Popover

				, setContent: function () {
					var $tip = this.tip()
						, title = this.getTitle()
						, content = this.getContent()

						$tip.find('.popover-title')[ $.type(title) == 'object' ? 'append' : 'html' ](title)
						$tip.find('.popover-content > *')[ $.type(content) == 'object' ? 'append' : 'html' ](content)

						$tip.removeClass('fade top bottom left right in')
				}

				, hasContent: function () {
					return this.getTitle() || this.getContent()
				}

				, getContent: function () {
					var content
						, $e = this.$element
						, o = this.options

						content = $e.attr('data-content')
						|| (typeof o.content == 'function' ? o.content.call($e[0]) :  o.content)

						content = content.toString().replace(/(^\s*|\s*$)/, "")

						return content
				}

				, tip: function() {
					if (!this.$tip) {
						this.$tip = $(this.options.template)
					}
					return this.$tip
				}

			})


			/* POPOVER PLUGIN DEFINITION
			* ======================= */

			$.fn.popover = function ( option ) {
				return this.each(function () {
					var $this = $(this)
						, data = $this.data('popover')
						, options = typeof option == 'object' && option
						if (!data) $this.data('popover', (data = new Popover(this, options)))
							if (typeof option == 'string') data[option]()
				})
			}

			$.fn.popover.Constructor = Popover

			$.fn.popover.defaults = $.extend({} , $.fn.tooltip.defaults, {
				placement: 'right'
				, content: ''
				, template: '<div class="lb popover cleanslate"><div class="lb arrow"></div><div class="lb popover-inner"><h3 class="lb popover-title"></h3><div class="lb popover-content"><p class="lb"></p></div></div></div>'
			})

		}( window.jQuery );

		/* ==========================================================
		* bootstrapx-clickover.js
		* https://github.com/lecar-red/bootstrapx-clickover
		* version: 1.0
		* ==========================================================
		*
		* Based on work from Twitter Bootstrap and 
		* from Popover library http://twitter.github.com/bootstrap/javascript.html#popover
		* from the great guys at Twitter.
		*
		* Untested with 2.1.0 but should worked with 2.0.x
		*
		* ========================================================== */
		!function($) {
			"use strict"

			/* class definition */
			var Clickover = function ( element, options ) {
				// local init
				this.cinit('clickover', element, options );
			}

			Clickover.prototype = $.extend({}, $.fn.popover.Constructor.prototype, {

				constructor: Clickover

				, cinit: function( type, element, options ) {

					//log("cinit");
					this.attr = {};

					// choose random attrs instead of timestamp ones
					this.attr.me = ((Math.random() * 10) + "").replace(/\D/g, '');
					//this.attr.click_event_ns = "click." + this.attr.me + " touchstart." + this.attr.me;
					this.attr.click_event_ns = "click." + this.attr.me; // + " touchstart." + this.attr.me;

					if (!options) options = {};

					options.trigger = 'manual';

					// call parent
					this.init( type, element, options );

					// setup our own handlers
					this.$element.on( 'click', this.options.selector, $.proxy(this.clickery, this) );

					// soon add click hanlder to body to close this element
					// will need custom handler inside here
				}
				, clickery: function(e) {
					// clickery isn't only run by event handlers can be called by timeout or manually
					// only run our click handler and  
					// need to stop progration or body click handler would fire right away
					if (e) {
						e.preventDefault();
						e.stopPropagation();
					}

					// set popover's dim's
					this.options.width  && this.tip().css("width",  this.options.width  );
					this.options.height && this.tip().css("height", this.options.height );

					// set popover's tip 'id' for greater control of rendering or css rules
					this.options.tip_id     && this.tip().attr('id', this.options.tip_id );

					// add a custom class
					this.options.class_name && this.tip().addClass(this.options.class_name);

					// we could override this to provide show and hide hooks 
					this[ this.isShown() ? 'hide' : 'show' ]();

					// if shown add global click closer
					if ( this.isShown() ) {
						var that = this;

						// close on global request, exclude clicks inside clickover
						this.options.global_close &&
						$('body').on( this.attr.click_event_ns, function(e) {
							if ( !that.tip().has(e.target).length ) { that.clickery(); }
						});

						this.options.esc_close && $(document).bind('keyup.clickery', function(e) {
							if (e.keyCode == 27) { that.clickery(); }
							return;
						});

						// first check for others that might be open
						// wanted to use 'click' but might accidently trigger other custom click handlers
						// on clickover elements 
						!this.options.allow_multiple &&
						$('[data-clickover-open=1]').each( function() { 
							$(this).data('clickover') && $(this).data('clickover').clickery(); });

							// help us track elements w/ open clickovers using html5
							this.$element.attr('data-clickover-open', 1);

							// if element has close button then make that work, like to
							// add option close_selector
							this.tip().on('click', '[data-dismiss="clickover"]', $.proxy(this.clickery, this));

							// trigger timeout hide
							if ( this.options.auto_close && this.options.auto_close > 0 ) {
								this.attr.tid = 
								setTimeout( $.proxy(this.clickery, this), this.options.auto_close );  
							}

							// provide callback hooks for post shown event
							typeof this.options.onShown == 'function' && this.options.onShown.call(this);
							this.$element.trigger('shown');
						}
						else {
							this.$element.removeAttr('data-clickover-open');

							this.options.esc_close && $(document).unbind('keyup.clickery');

							$('body').off( this.attr.click_event_ns ); 

							if ( typeof this.attr.tid == "number" ) {
								clearTimeout(this.attr.tid);
								delete this.attr.tid;
							}

							// provide some callback hooks
							typeof this.options.onHidden == 'function' && this.options.onHidden.call(this);
							this.$element.trigger('hidden');
						}
					}
					, isShown: function() {
						return this.tip().hasClass('in');
					}
					, resetPosition: function() {
						var $tip
							, inside
							, pos
							, actualWidth
							, actualHeight
							, placement
							, tp

						if (this.hasContent() && this.enabled) {
							$tip = this.tip()

							placement = typeof this.options.placement == 'function' ?
							this.options.placement.call(this, $tip[0], this.$element[0]) :
							this.options.placement

							inside = /in/.test(placement)

							pos = this.getPosition(inside)

							actualWidth = $tip[0].offsetWidth
							actualHeight = $tip[0].offsetHeight

							switch (inside ? placement.split(' ')[1] : placement) {
							case 'bottom':
								tp = {top: pos.top + pos.height, left: pos.left + pos.width / 2 - actualWidth / 2}
								break
							case 'top':
								tp = {top: pos.top - actualHeight, left: pos.left + pos.width / 2 - actualWidth / 2}
								break
							case 'left':
								tp = {top: pos.top + pos.height / 2 - actualHeight / 2, left: pos.left - actualWidth}
								break
							case 'right':
								tp = {top: pos.top + pos.height / 2 - actualHeight / 2, left: pos.left + pos.width}
								break
							}

							$tip.css(tp)
						}
					}
					, debughide: function() {
						var dt = new Date().toString();

						//console.log(dt + ": clickover hide");
						this.hide();
					}
				})

				/* plugin definition */
				/* stolen from bootstrap tooltip.js */
				$.fn.clickover = function( option ) {
					return this.each(function() {
						var $this = $(this)
							, data = $this.data('clickover')
							, options = typeof option == 'object' && option

							if (!data) $this.data('clickover', (data = new Clickover(this, options)))
								if (typeof option == 'string') data[option]()
					})
				}

				$.fn.clickover.Constructor = Clickover

				// these defaults are passed directly to parent classes
				$.fn.clickover.defaults = $.extend({}, $.fn.popover.defaults, {
					trigger: 'manual',
					auto_close:   0, /* ms to auto close clickover, 0 means none */
					global_close: 1, /* allow close when clicked away from clickover */
					esc_close:    1, /* allow clickover to close when esc key is pressed */
					onShown:  null,  /* function to be run once clickover has been shown */
					onHidden: null,  /* function to be run once clickover has been hidden */
					width:  null, /* number is px (don't add px), null or 0 - don't set anything */
					height: null, /* number is px (don't add px), null or 0 - don't set anything */
					tip_id: null,  /* id of popover container */
					class_name: 'clickover', /* default class name in addition to other classes */
					allow_multiple: 0 /* enable to allow for multiple clickovers to be open at the same time */
				})

			}( window.jQuery );
		
		}

})();
