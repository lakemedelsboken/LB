var readStyle = "style-newspaper";
var readSize = "size-large";
var readMargin = "margin-wide";
var readability;

//The code for the actual bookmark href
/*
javascript:(function(){if(window.lbBookmarklet!==undefined){lbBookmarklet();}else{document.body.appendChild(document.createElement('script')).src='http://www.lakemedelsboken.se/bookmarklets/injectgenericas/js/injectgenericas.js?';}})();
*/

(function(){

	var minimumJQuery = "1.11.0";
	var preferredJQuery = "1.11.0";

	if (window.jQuery === undefined || window.jQuery.fn.jquery < minimumJQuery) {
		var done = false;
		var script = document.createElement("script");
		script.src = "http://ajax.googleapis.com/ajax/libs/jquery/" + preferredJQuery + "/jquery.min.js";
		script.onload = script.onreadystatechange = function(){
			if (!done && (!this.readyState || this.readyState == "loaded" || this.readyState == "complete")) {
				
				done = true;
				initLBBookmarklet();
			}
		};
		document.getElementsByTagName("head")[0].appendChild(script);
	} else {
		initLBBookmarklet();
	}
	
	function initLBBookmarklet() {
		(window.lbBookmarklet = function() {

			initClickOver();

			function log(message) {
				if (console && console.log) {
					console.log(message);
				}
			}
			
			function getNewContent($body, callback) {

				//Remove inline scripts
				$body.find("script").remove();

				var data = $body.html();
				
				//Send data to lb webservice
				// Assign handlers immediately after making the request,
				// and remember the jqxhr object for this request
				
				var sendData = encodeURIComponent(data);
				log("Sending " + sendData.length + " chars");
				
				var jqxhr = $.getJSON("http://www.lakemedelsboken.se/api/v1/injectgenericas?content=" + sendData + "&callback=?", function(data) {
					//console.log( data );
					callback(null, data.content);
				})
				.fail(function( jqxhr, textStatus, error ) {
					var err = textStatus + ", " + error;
					callback(err);
					//console.log( "Request Failed: " + err );
				});
				
			}
			
			log("Running");

			//Perform analysis to find main content
			var articleContent = readability.grabArticle(false);
			var $body = null;
			
			if (articleContent !== null) {
				$body = $(articleContent)
			}
			
			//log($body);

			if ($body !== null && $body.length === 1 && $body.attr("data-old-html") === undefined) {
				var html = $body.html();
				$body.attr("data-old-html", html);
				log("Saved " + html.length + " chars to attribute 'data-old-html'");

				$body.on("click", "a.inlineGenerica", handleGenericas);

				$("head").append('<link rel="stylesheet" href="http://www.lakemedelsboken.se/bookmarklets/injectgenericas/css/injectgenericas.css" id="injectGenericasStyles">');

				//Display loading box
				var loadBox = $("<div style=\"display: none;z-index: 10000;position: fixed;top: 10px;left: 10px;background: #fff;width: 200px;text-align: center;color: #000;font-size: 14px;text-decoration: none;font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;border: solid 1px black;padding: 10px;-webkit-border-radius: 4px 4px 4px 4px;-moz-border-radius: 4px 4px 4px 4px;border-radius: 4px 4px 4px 4px;\">Letar efter substansnamn...</div>");

				$("body").append(loadBox);
				loadBox.show("fast");
				//var oldBackgroundColor = $body.css("backgroundColor");
				//$body.css("backgroundColor", "#fafafa");
				
				getNewContent($body, function(err, data) {
					if (err) {
						//Remove loading box
						loadBox.html("Lyckades inte hitta substanser");
						setTimeout(function() {
							loadBox.hide("fast");
						}, 2000);
						log(err);
					} else {
						//Remove loading box
						loadBox.html("Färdig.");
						setTimeout(function() {
							loadBox.hide("fast");
						}, 1000);
						//Switch content
						$body.html(data);
					}
					//$body.css("backgroundColor", oldBackgroundColor);

				});
				
			} else if ($body !== null && $body.length === 1 && $body.attr("data-old-html") !== undefined) {
				//Restore everything, currently not working because of current readability implementation
				$body.html($body.attr("data-old-html"));
				$body.removeAttr("data-old-html");
				var styles = $("head").find("#injectGenericasStyles");
				if (styles.length) {
					styles.remove();
				}
				$body.off("click", "a.inlineGenerica", handleGenericas);
				
				log("Restored to normal");

			} else if ($body === null || $body.length === 0) {
				log("No body tag was found");
			} else {
				log("Something went wrong");
			}

			var lb = {
				tipCounter: 0,
				getATCItems: function(parentId, callback) {
					var out = {atcCode: parentId};
					$.getJSON("http://www.lakemedelsboken.se/api/v1/atctree?parentid=" + encodeURIComponent(parentId) + "&callback=?", function(results) {
						out.data = results;
						callback(null, out);
					}).error(function(jqXHR, status, error) {
						callback("Kunde inte hitta rubriker", out);
					});
				}
			};
			

			function handleGenericas(event) {
				
				log("handleGenericas");
				//event.preventDefault();
				
				var atcCodes = $(this).attr("data-atcid");

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
					var content = "";
					for (var i=0; i < atcCodes.length; i++) {
						var atcCode = atcCodes[i];
						content += "<h6 class=\"" + atcCode + "\">" + atcTitles[i].replace(/\-\-/g, " - ").replace(/_/g, " ") + "</h6><ul class=\"" + atcCode + " nav nav-tabs nav-stacked\"><li class=\"loading\"><a href=\"#\"><i class=\"icon icon-refresh icon-spin\"></i> Hämtar rubriker...</a></ul>";
					}
			
					var title = "Preparatlista";

					title += '<button type="button" class="close" data-dismiss="clickover">&times;</button>'

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
							for (var i=0; i < atcCodes.length; i++) {
								var atcCode = atcCodes[i];

								lb.getATCItems(atcCode, function(err, results) {
									var currentATCMenu = $("ul." + results.atcCode);
									currentATCMenu.find(".loading").remove();
									if (err) {
										currentATCMenu.append("<li><a href=\"#\"><i class=\"icon icon-info-sign\"></i> Kunde inte hitta rubriker</a></li>");
									} else {
										for (var i = 0; i < results.data.length; i++) {

											var item = results.data[i];
											if (item.hasChildren) {
												currentATCMenu.append("<li id=\"" + tipId + "_" + item.id + "\"><a target=\"_blank\" href=\"http://www.lakemedelsboken.se/atc/" + item.id + "\" data-indentation=\"0\" class=\"atcCodeInPopover\"><i class=\"icon icon-plus-sign-alt\"></i><i class=\"icon icon-angle-down pull-right\"></i> <strong>" + item.text + "</strong></a></li>");
											} else if (item.children && item.children.length > 0) {
												for (var j = 0; j < item.children.length; j++) {
													var productItem = item.children[j];
													var images = "";
													if (productItem.images) {
														for (var x=0; x < productItem.images.length; x++) {
															images += "<img src=\"http://www.lakemedelsboken.se" + productItem.images[x] + "\" class=\"img-polaroid pull-right\" style=\"width: 15px; height: 15px; margin-right: 5px;\" />";
														}
													}
													var productInfo = productItem.text.split(",");
													//productInfo.shift();

													if (j === 0) {
														productInfo[0] = "<strong>" + productInfo[0] + "</strong>";
													} else {
														//productInfo.shift();
													}

													productInfo = productInfo.join(",");

													var extraIndent = 0;
													if (j > 0) {
														//extraIndent = 25;
													}
												
													currentATCMenu.append("<li" + (productItem.noinfo === true ? " class=\"ui-state-disabled\"" : "") + "><a target=\"_blank\" href=\"http://www.lakemedelsboken.se/?imo=true&nplId=" + productItem.id + "\" data-product-id=\"" + productItem.id + "\" class=\"inlineProduct\" " + ((extraIndent > 0) ? " style=\"padding-left: " + extraIndent + "px;\"" : "") + ">" + images + productInfo + "</a></li>");
												}
											} else {
												//console.log(item);
											}

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
										$("#" + tipId).find(".popover-content").html("<h5><i class=\"icon icon-info-sign\"></i> Tyvärr hittades inga preparat för denna rubrik</h5>");
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

			
		})();
	}
	
	function initClickOver() {

		function log(message) {
			if (console && console.log) {
				console.log(message);
			}
		}

		log("initClickOver");

		var dbg = function(s) {
			if(typeof console !== 'undefined')
				console.log("Readability: " + s);
		};

		/*
		 * Readability. An Arc90 Lab Experiment. 
		 * Website: http://lab.arc90.com/experiments/readability
		 * Source:  http://code.google.com/p/arc90labs-readability
		 *
		 * Copyright (c) 2009 Arc90 Inc
		 * Readability is licensed under the Apache License, Version 2.0.
		**/
		log("Setting readability");
		readability = {
			version:     '0.5.1',
			emailSrc:    'http://lab.arc90.com/experiments/readability/email.php',
			kindleSrc:   'http://lab.arc90.com/experiments/readability/kindle.php',
			iframeLoads: 0,
			frameHack:   false, /**
			                     * The frame hack is to workaround a firefox bug where if you
								 * pull content out of a frame and stick it into the parent element, the scrollbar won't appear.
								 * So we fake a scrollbar in the wrapping div.
								**/
			bodyCache:  null,   /* Cache the body HTML in case we need to re-use it later */
	
			/**
			 * All of the regular expressions in use within readability.
			 * Defined up here so we don't instantiate them repeatedly in loops.
			 **/
			regexps: {
				unlikelyCandidatesRe:   /combx|comment|disqus|foot|header|menu|meta|nav|rss|shoutbox|sidebar|sponsor/i,
				okMaybeItsACandidateRe: /and|article|body|column|main/i,
				positiveRe:             /article|body|content|entry|hentry|page|pagination|post|text/i,
				negativeRe:             /combx|comment|contact|foot|footer|footnote|link|media|meta|promo|related|scroll|shoutbox|sponsor|tags|widget/i,
				divToPElementsRe:       /<(a|blockquote|dl|div|img|ol|p|pre|table|ul)/i,
				replaceBrsRe:           /(<br[^>]*>[ \n\r\t]*){2,}/gi,
				replaceFontsRe:         /<(\/?)font[^>]*>/gi,
				trimRe:                 /^\s+|\s+$/g,
				normalizeRe:            /\s{2,}/g,
				killBreaksRe:           /(<br\s*\/?>(\s|&nbsp;?)*){1,}/g,
				videoRe:                /http:\/\/(www\.)?(youtube|vimeo)\.com/i
			},

			/**
			 * Runs readability.
			 * 
			 * Workflow:
			 *  1. Prep the document by removing script tags, css, etc.
			 *  2. Build readability's DOM tree.
			 *  3. Grab the article content from the current dom tree.
			 *  4. Replace the current DOM tree with the new one.
			 *  5. Read peacefully.
			 *
			 * @return void
			 **/
			init: function(preserveUnlikelyCandidates) {
				preserveUnlikelyCandidates = (typeof preserveUnlikelyCandidates == 'undefined') ? false : preserveUnlikelyCandidates;

				if(document.body && !readability.bodyCache)
					readability.bodyCache = document.body.innerHTML;
		
				readability.prepDocument();
		
				/* Build readability's DOM tree */
				var overlay        = document.createElement("DIV");
				var innerDiv       = document.createElement("DIV");
				var articleTools   = readability.getArticleTools();
				var articleTitle   = readability.getArticleTitle();
				var articleContent = readability.grabArticle(preserveUnlikelyCandidates);
				var articleFooter  = readability.getArticleFooter();

				/**
				 * If we attempted to strip unlikely candidates on the first run through, and we ended up with no content,
				 * that may mean we stripped out the actual content so we couldn't parse it. So re-run init while preserving
				 * unlikely candidates to have a better shot at getting our content out properly.
				**/
				if(readability.getInnerText(articleContent, false) == "")
				{
					if(!preserveUnlikelyCandidates) {
						document.body.innerHTML = readability.bodyCache;
						return readability.init(true);				
					}
					else
					{
						articleContent.innerHTML = "<p>Sorry, readability was unable to parse this page for content. If you feel like it should have been able to, please <a href='http://code.google.com/p/arc90labs-readability/issues/entry'>let us know by submitting an issue.</a></p>";
					}
				}

				overlay.id              = "readOverlay";
				innerDiv.id             = "readInner";

				/* Apply user-selected styling */
				//document.body.className = readStyle;
				overlay.className       = readStyle;
				innerDiv.className      = readMargin + " " + readSize;

				/* Glue the structure of our document together. */
				articleContent.appendChild( articleFooter  );
				      innerDiv.appendChild( articleTitle   );
				      innerDiv.appendChild( articleContent );
				       overlay.appendChild( articleTools   );
				       overlay.appendChild( innerDiv       );

				/* Clear the old HTML, insert the new content. */
				document.body.innerHTML = "";
				document.body.insertBefore(overlay, document.body.firstChild);

				if(readability.frameHack)
				{
					var readOverlay = document.getElementById('readOverlay');
					readOverlay.style.height = '100%';
					readOverlay.style.overflow = 'auto';
				}

			},

			/**
			 * Get the article tools Element that has buttons like reload, print, email.
			 *
			 * @return void
			 **/
			getArticleTools: function () {
				var articleTools = document.createElement("DIV");

				articleTools.id        = "readTools";
				articleTools.innerHTML = "\
					<a href='#' onclick='return window.location.reload()' title='Reload original page' id='reload-page'>Reload Original Page</a>\
					<a href='#' onclick='javascript:window.print();' title='Print page' id='print-page'>Print Page</a>\
					<a href='#' onclick='readability.emailBox(); return false;' title='Email page' id='email-page'>Email Page</a>\
					<a href='#' onclick='readability.kindleBox(); return false;' title='Send to Amazon Kindle' id='kindle-page'>Send to Kindle</a>\
				";

				return articleTools;
			},
	
			/**
			 * Get the article title as an H1. Currently just uses document.title,
			 * we might want to be smarter in the future.
			 *
			 * @return void
			 **/
			getArticleTitle: function () {
				var articleTitle = document.createElement("H1");
				articleTitle.innerHTML = document.title;
		
				return articleTitle;
			},

			/**
			 * Get the footer with the readability mark etc.
			 *
			 * @return void
			 **/
			getArticleFooter: function () {
				var articleFooter = document.createElement("DIV");

				articleFooter.id = "readFooter";
				articleFooter.innerHTML = "\
					<a href='http://lab.arc90.com/experiments/readability'><img src='http://lab.arc90.com/experiments/readability/images/footer-readability.png'></a>\
					<a href='http://www.arc90.com'><img src='http://lab.arc90.com/experiments/readability/images/footer-arc90.png'></a>\
					<a href='http://www.twitter.com/arc90' class='footer-twitterLink'>Follow us on Twitter &raquo;</a>\
			                <div class='footer-right' >\
			                        <span class='version'>Readability version " + readability.version + "</span>\
							</div>\
				";

				return articleFooter;
			},
	
			/**
			 * Prepare the HTML document for readability to scrape it.
			 * This includes things like stripping javascript, CSS, and handling terrible markup.
			 * 
			 * @return void
			 **/
			prepDocument: function () {
				/**
				 * In some cases a body element can't be found (if the HTML is totally hosed for example)
				 * so we create a new body node and append it to the document.
				 */
				if(document.body === null)
				{
					body = document.createElement("body");
					try {
						document.body = body;		
					}
					catch(e) {
						document.documentElement.appendChild(body);
					}
				}

				var frames = document.getElementsByTagName('frame');
				if(frames.length > 0)
				{
					var bestFrame = null;
					var bestFrameSize = 0;
					for(var frameIndex = 0; frameIndex < frames.length; frameIndex++)
					{
						var frameSize = frames[frameIndex].offsetWidth + frames[frameIndex].offsetHeight;
						var canAccessFrame = false;
						try {
							frames[frameIndex].contentWindow.document.body;
							canAccessFrame = true;
						} catch(e) {}
				
						if(canAccessFrame && frameSize > bestFrameSize)
						{
							bestFrame = frames[frameIndex];
							bestFrameSize = frameSize;
						}
					}

					if(bestFrame)
					{
						var newBody = document.createElement('body');
						newBody.innerHTML = bestFrame.contentWindow.document.body.innerHTML;
						newBody.style.overflow = 'scroll';
						document.body = newBody;
				
						var frameset = document.getElementsByTagName('frameset')[0];
						if(frameset)
							frameset.parentNode.removeChild(frameset);
					
						readability.frameHack = true;
					}
				}

				/* If we're using a typekit style, inject the JS for it. */
				if (readStyle == "style-classy") {
					var typeKitScript  = document.createElement('script');
					typeKitScript.type = "text/javascript";
					typeKitScript.src  = "http://use.typekit.com/sxt6vzy.js";

					document.body.appendChild(typeKitScript);

					/**
					 * Done as a script elem so that it's ensured it will activate
					 * after typekit is loaded from the previous script src.
					**/
					var typeKitLoader  = document.createElement('script');
					typeKitLoader.type = "text/javascript";

					var typeKitLoaderContent = document.createTextNode('try{Typekit.load();}catch(e){}');
					typeKitLoader.appendChild(typeKitLoaderContent);
					document.body.appendChild(typeKitLoader);
				}

				/* remove all scripts that are not readability */
				var scripts = document.getElementsByTagName('script');
				for(i = scripts.length-1; i >= 0; i--)
				{
					if(typeof(scripts[i].src) == "undefined" || scripts[i].src.indexOf('readability') == -1)
					{
						scripts[i].parentNode.removeChild(scripts[i]);			
					}
				}

				/* remove all stylesheets */
				for (var k=0;k < document.styleSheets.length; k++) {
					if (document.styleSheets[k].href != null && document.styleSheets[k].href.lastIndexOf("readability") == -1) {
						document.styleSheets[k].disabled = true;
					}
				}

				/* Remove all style tags in head (not doing this on IE) - TODO: Why not? */
				var styleTags = document.getElementsByTagName("style");
				for (var j=0;j < styleTags.length; j++)
					if (navigator.appName != "Microsoft Internet Explorer")
						styleTags[j].textContent = "";

				/* Turn all double br's into p's */
				/* Note, this is pretty costly as far as processing goes. Maybe optimize later. */
				document.body.innerHTML = document.body.innerHTML.replace(readability.regexps.replaceBrsRe, '</p><p>').replace(readability.regexps.replaceFontsRe, '<$1span>')
			},

			/**
			 * Prepare the article node for display. Clean out any inline styles,
			 * iframes, forms, strip extraneous <p> tags, etc.
			 *
			 * @param Element
			 * @return void
			 **/
			prepArticle: function (articleContent) {
				readability.cleanStyles(articleContent);
				readability.killBreaks(articleContent);

				/* Clean out junk from the article content */
				readability.clean(articleContent, "form");
				readability.clean(articleContent, "object");
				readability.clean(articleContent, "h1");
				/**
				 * If there is only one h2, they are probably using it
				 * as a header and not a subheader, so remove it since we already have a header.
				***/
				if(articleContent.getElementsByTagName('h2').length == 1)
					readability.clean(articleContent, "h2");
				readability.clean(articleContent, "iframe");

				readability.cleanHeaders(articleContent);

				/* Do these last as the previous stuff may have removed junk that will affect these */
				readability.cleanConditionally(articleContent, "table");
				readability.cleanConditionally(articleContent, "ul");
				readability.cleanConditionally(articleContent, "div");

				/* Remove extra paragraphs */
				var articleParagraphs = articleContent.getElementsByTagName('p');
				for(i = articleParagraphs.length-1; i >= 0; i--)
				{
					var imgCount    = articleParagraphs[i].getElementsByTagName('img').length;
					var embedCount  = articleParagraphs[i].getElementsByTagName('embed').length;
					var objectCount = articleParagraphs[i].getElementsByTagName('object').length;
			
					if(imgCount == 0 && embedCount == 0 && objectCount == 0 && readability.getInnerText(articleParagraphs[i], false) == '')
					{
						articleParagraphs[i].parentNode.removeChild(articleParagraphs[i]);
					}
				}

				try {
					articleContent.innerHTML = articleContent.innerHTML.replace(/<br[^>]*>\s*<p/gi, '<p');		
				}
				catch (e) {
					dbg("Cleaning innerHTML of breaks failed. This is an IE strict-block-elements bug. Ignoring.");
				}
			},
	
			/**
			 * Initialize a node with the readability object. Also checks the
			 * className/id for special names to add to its score.
			 *
			 * @param Element
			 * @return void
			**/
			initializeNode: function (node) {
				node.readability = {"contentScore": 0};			

				switch(node.tagName) {
					case 'DIV':
						node.readability.contentScore += 5;
						break;

					case 'PRE':
					case 'TD':
					case 'BLOCKQUOTE':
						node.readability.contentScore += 3;
						break;
				
					case 'ADDRESS':
					case 'OL':
					case 'UL':
					case 'DL':
					case 'DD':
					case 'DT':
					case 'LI':
					case 'FORM':
						node.readability.contentScore -= 3;
						break;

					case 'H1':
					case 'H2':
					case 'H3':
					case 'H4':
					case 'H5':
					case 'H6':
					case 'TH':
						node.readability.contentScore -= 5;
						break;
				}

				node.readability.contentScore += readability.getClassWeight(node);
			},
	
			/***
			 * grabArticle - Using a variety of metrics (content score, classname, element types), find the content that is
			 *               most likely to be the stuff a user wants to read. Then return it wrapped up in a div.
			 *
			 * @return Element
			**/
			grabArticle: function (preserveUnlikelyCandidates) {
				/**
				 * First, node prepping. Trash nodes that look cruddy (like ones with the class name "comment", etc), and turn divs
				 * into P tags where they have been used inappropriately (as in, where they contain no other block level elements.)
				 *
				 * Note: Assignment from index for performance. See http://www.peachpit.com/articles/article.aspx?p=31567&seqNum=5
				 * TODO: Shouldn't this be a reverse traversal?
				**/
				for(var nodeIndex = 0; (node = document.getElementsByTagName('*')[nodeIndex]); nodeIndex++)
				{
					/* Remove unlikely candidates */
					if (!preserveUnlikelyCandidates) {
						var unlikelyMatchString = node.className + node.id;
						if (unlikelyMatchString.search(readability.regexps.unlikelyCandidatesRe) !== -1 &&
						    unlikelyMatchString.search(readability.regexps.okMaybeItsACandidateRe) == -1 &&
							node.tagName !== "BODY")
						{
							dbg("Removing unlikely candidate - " + unlikelyMatchString);
							//node.parentNode.removeChild(node);
							//nodeIndex--;
							continue;
						}				
					}

					/* Turn all divs that don't have children block level elements into p's */
					/*
					if (node.tagName === "DIV") {
						if (node.innerHTML.search(readability.regexps.divToPElementsRe) === -1)	{
							dbg("Altering div to p");
							var newNode = document.createElement('p');
							try {
								newNode.innerHTML = node.innerHTML;				
								node.parentNode.replaceChild(newNode, node);
								nodeIndex--;
							}
							catch(e)
							{
								dbg("Could not alter div to p, probably an IE restriction, reverting back to div.")
							}
						}
						else
						{
							// EXPERIMENTAL
							for(var i = 0, il = node.childNodes.length; i < il; i++) {
								var childNode = node.childNodes[i];
								if(childNode.nodeType == Node.TEXT_NODE) {
									dbg("replacing text node with a p tag with the same content.");
									var p = document.createElement('p');
									p.innerHTML = childNode.nodeValue;
									p.style.display = 'inline';
									p.className = 'readability-styled';
									childNode.parentNode.replaceChild(p, childNode);
								}
							}
						}
					}
					*/
				}

				/**
				 * Loop through all paragraphs, and assign a score to them based on how content-y they look.
				 * Then add their score to their parent node.
				 *
				 * A score is determined by things like number of commas, class names, etc. Maybe eventually link density.
				**/
				var allParagraphs = document.getElementsByTagName("p");
				var candidates    = [];

				for (var j=0; j	< allParagraphs.length; j++) {
					var parentNode      = allParagraphs[j].parentNode;
					var grandParentNode = parentNode.parentNode;
					var innerText       = readability.getInnerText(allParagraphs[j]);

					/* If this paragraph is less than 25 characters, don't even count it. */
					if(innerText.length < 25)
						continue;

					/* Initialize readability data for the parent. */
					if(typeof parentNode.readability == 'undefined')
					{
						readability.initializeNode(parentNode);
						candidates.push(parentNode);
					}

					/* Initialize readability data for the grandparent. */
					if(typeof grandParentNode.readability == 'undefined')
					{
						readability.initializeNode(grandParentNode);
						candidates.push(grandParentNode);
					}

					var contentScore = 0;

					/* Add a point for the paragraph itself as a base. */
					contentScore++;

					/* Add points for any commas within this paragraph */
					contentScore += innerText.split(',').length;
			
					/* For every 100 characters in this paragraph, add another point. Up to 3 points. */
					contentScore += Math.min(Math.floor(innerText.length / 100), 3);
			
					/* Add the score to the parent. The grandparent gets half. */
					parentNode.readability.contentScore += contentScore;
					grandParentNode.readability.contentScore += contentScore/2;
				}

				/**
				 * After we've calculated scores, loop through all of the possible candidate nodes we found
				 * and find the one with the highest score.
				**/
				var topCandidate = null;
				for(var i=0, il=candidates.length; i < il; i++)
				{
					/**
					 * Scale the final candidates score based on link density. Good content should have a
					 * relatively small link density (5% or less) and be mostly unaffected by this operation.
					**/
					candidates[i].readability.contentScore = candidates[i].readability.contentScore * (1-readability.getLinkDensity(candidates[i]));

					dbg('Candidate: ' + candidates[i] + " (" + candidates[i].className + ":" + candidates[i].id + ") with score " + candidates[i].readability.contentScore);

					if(!topCandidate || candidates[i].readability.contentScore > topCandidate.readability.contentScore)
						topCandidate = candidates[i];
				}

				//FIX:
				if (topCandidate !== null) {
					dbg('Top Candidate: ' + topCandidate + " (" + topCandidate.className + ":" + topCandidate.id + ") with score " + topCandidate.readability.contentScore);

					return topCandidate;
				} else {
					return null;
				}

				/**
				 * If we still have no top candidate, just use the body as a last resort.
				 * We also have to copy the body node so it is something we can modify.
				 **/
				if (topCandidate == null || topCandidate.tagName == "BODY")
				{
					topCandidate = document.createElement("DIV");
					topCandidate.innerHTML = document.body.innerHTML;
					document.body.innerHTML = "";
					document.body.appendChild(topCandidate);
					readability.initializeNode(topCandidate);
				}


				/**
				 * Now that we have the top candidate, look through its siblings for content that might also be related.
				 * Things like preambles, content split by ads that we removed, etc.
				**/
				var articleContent        = document.createElement("DIV");
			        articleContent.id     = "readability-content";
				var siblingScoreThreshold = Math.max(10, topCandidate.readability.contentScore * 0.2);
				var siblingNodes          = topCandidate.parentNode.childNodes;
				for(var i=0, il=siblingNodes.length; i < il; i++)
				{
					var siblingNode = siblingNodes[i];
					var append      = false;

					dbg("Looking at sibling node: " + siblingNode + " (" + siblingNode.className + ":" + siblingNode.id + ")" + ((typeof siblingNode.readability != 'undefined') ? (" with score " + siblingNode.readability.contentScore) : ''));
					dbg("Sibling has score " + (siblingNode.readability ? siblingNode.readability.contentScore : 'Unknown'));

					if(siblingNode === topCandidate)
					{
						append = true;
					}
			
					if(typeof siblingNode.readability != 'undefined' && siblingNode.readability.contentScore >= siblingScoreThreshold)
					{
						append = true;
					}
			
					if(siblingNode.nodeName == "P") {
						var linkDensity = readability.getLinkDensity(siblingNode);
						var nodeContent = readability.getInnerText(siblingNode);
						var nodeLength  = nodeContent.length;
				
						if(nodeLength > 80 && linkDensity < 0.25)
						{
							append = true;
						}
						else if(nodeLength < 80 && linkDensity == 0 && nodeContent.search(/\.( |$)/) !== -1)
						{
							append = true;
						}
					}

					if(append)
					{
						dbg("Appending node: " + siblingNode)

						/* Append sibling and subtract from our list because it removes the node when you append to another node */
						articleContent.appendChild(siblingNode);
						i--;
						il--;
					}
				}				

				/**
				 * So we have all of the content that we need. Now we clean it up for presentation.
				**/
				readability.prepArticle(articleContent);
		
				return articleContent;
			},
	
			/**
			 * Get the inner text of a node - cross browser compatibly.
			 * This also strips out any excess whitespace to be found.
			 *
			 * @param Element
			 * @return string
			**/
			getInnerText: function (e, normalizeSpaces) {
				var textContent    = "";

				normalizeSpaces = (typeof normalizeSpaces == 'undefined') ? true : normalizeSpaces;

				if (navigator.appName == "Microsoft Internet Explorer")
					textContent = e.innerText.replace( readability.regexps.trimRe, "" );
				else
					textContent = e.textContent.replace( readability.regexps.trimRe, "" );

				if(normalizeSpaces)
					return textContent.replace( readability.regexps.normalizeRe, " ");
				else
					return textContent;
			},

			/**
			 * Get the number of times a string s appears in the node e.
			 *
			 * @param Element
			 * @param string - what to split on. Default is ","
			 * @return number (integer)
			**/
			getCharCount: function (e,s) {
			    s = s || ",";
				return readability.getInnerText(e).split(s).length;
			},

			/**
			 * Remove the style attribute on every e and under.
			 * TODO: Test if getElementsByTagName(*) is faster.
			 *
			 * @param Element
			 * @return void
			**/
			cleanStyles: function (e) {
			    e = e || document;
			    var cur = e.firstChild;

				if(!e)
					return;

				// Remove any root styles, if we're able.
				if(typeof e.removeAttribute == 'function' && e.className != 'readability-styled')
					e.removeAttribute('style');

			    // Go until there are no more child nodes
			    while ( cur != null ) {
					if ( cur.nodeType == 1 ) {
						// Remove style attribute(s) :
						if(cur.className != "readability-styled") {
							cur.removeAttribute("style");					
						}
						readability.cleanStyles( cur );
					}
					cur = cur.nextSibling;
				}			
			},
	
			/**
			 * Get the density of links as a percentage of the content
			 * This is the amount of text that is inside a link divided by the total text in the node.
			 * 
			 * @param Element
			 * @return number (float)
			**/
			getLinkDensity: function (e) {
				var links      = e.getElementsByTagName("a");
				var textLength = readability.getInnerText(e).length;
				var linkLength = 0;
				for(var i=0, il=links.length; i<il;i++)
				{
					linkLength += readability.getInnerText(links[i]).length;
				}		

				return linkLength / textLength;
			},
	
			/**
			 * Get an elements class/id weight. Uses regular expressions to tell if this 
			 * element looks good or bad.
			 *
			 * @param Element
			 * @return number (Integer)
			**/
			getClassWeight: function (e) {
				var weight = 0;

				/* Look for a special classname */
				if (e.className != "")
				{
					if(e.className.search(readability.regexps.negativeRe) !== -1)
						weight -= 25;

					if(e.className.search(readability.regexps.positiveRe) !== -1)
						weight += 25;				
				}

				/* Look for a special ID */
				if (typeof(e.id) == 'string' && e.id != "")
				{
					if(e.id.search(readability.regexps.negativeRe) !== -1)
						weight -= 25;

					if(e.id.search(readability.regexps.positiveRe) !== -1)
						weight += 25;				
				}

				return weight;
			},
	
			/**
			 * Remove extraneous break tags from a node.
			 *
			 * @param Element
			 * @return void
			 **/
			killBreaks: function (e) {
				try {
					e.innerHTML = e.innerHTML.replace(readability.regexps.killBreaksRe,'<br />');		
				}
				catch (e) {
					dbg("KillBreaks failed - this is an IE bug. Ignoring.");
				}
			},

			/**
			 * Clean a node of all elements of type "tag".
			 * (Unless it's a youtube/vimeo video. People love movies.)
			 *
			 * @param Element
			 * @param string tag to clean
			 * @return void
			 **/
			clean: function (e, tag) {
				var targetList = e.getElementsByTagName( tag );
				var isEmbed    = (tag == 'object' || tag == 'embed');

				for (var y=targetList.length-1; y >= 0; y--) {
					/* Allow youtube and vimeo videos through as people usually want to see those. */
					if(isEmbed && targetList[y].innerHTML.search(readability.regexps.videoRe) !== -1)
					{
						continue;
					}

					targetList[y].parentNode.removeChild(targetList[y]);
				}
			},
	
			/**
			 * Clean an element of all tags of type "tag" if they look fishy.
			 * "Fishy" is an algorithm based on content length, classnames, link density, number of images & embeds, etc.
			 *
			 * @return void
			 **/
			cleanConditionally: function (e, tag) {
				var tagsList      = e.getElementsByTagName(tag);
				var curTagsLength = tagsList.length;

				/**
				 * Gather counts for other typical elements embedded within.
				 * Traverse backwards so we can remove nodes at the same time without effecting the traversal.
				 *
				 * TODO: Consider taking into account original contentScore here.
				**/
				for (var i=curTagsLength-1; i >= 0; i--) {
					var weight = readability.getClassWeight(tagsList[i]);

					dbg("Cleaning Conditionally " + tagsList[i] + " (" + tagsList[i].className + ":" + tagsList[i].id + ")" + ((typeof tagsList[i].readability != 'undefined') ? (" with score " + tagsList[i].readability.contentScore) : ''));

					if(weight < 0)
					{
						tagsList[i].parentNode.removeChild(tagsList[i]);
					}
					else if ( readability.getCharCount(tagsList[i],',') < 10) {
						/**
						 * If there are not very many commas, and the number of
						 * non-paragraph elements is more than paragraphs or other ominous signs, remove the element.
						**/

						var p      = tagsList[i].getElementsByTagName("p").length;
						var img    = tagsList[i].getElementsByTagName("img").length;
						var li     = tagsList[i].getElementsByTagName("li").length-100;
						var input  = tagsList[i].getElementsByTagName("input").length;

						var embedCount = 0;
						var embeds     = tagsList[i].getElementsByTagName("embed");
						for(var ei=0,il=embeds.length; ei < il; ei++) {
							if (embeds[ei].src.search(readability.regexps.videoRe) == -1) {
							  embedCount++;	
							}
						}

						var linkDensity   = readability.getLinkDensity(tagsList[i]);
						var contentLength = readability.getInnerText(tagsList[i]).length;
						var toRemove      = false;

						if ( img > p ) {
						 	toRemove = true;
						} else if(li > p && tag != "ul" && tag != "ol") {
							toRemove = true;
						} else if( input > Math.floor(p/3) ) {
						 	toRemove = true; 
						} else if(contentLength < 25 && (img == 0 || img > 2) ) {
							toRemove = true;
						} else if(weight < 25 && linkDensity > .2) {
							toRemove = true;
						} else if(weight >= 25 && linkDensity > .5) {
							toRemove = true;
						} else if((embedCount == 1 && contentLength < 75) || embedCount > 1) {
							toRemove = true;
						}

						if(toRemove) {
							tagsList[i].parentNode.removeChild(tagsList[i]);
						}
					}
				}
			},

			/**
			 * Clean out spurious headers from an Element. Checks things like classnames and link density.
			 *
			 * @param Element
			 * @return void
			**/
			cleanHeaders: function (e) {
				for (var headerIndex = 1; headerIndex < 7; headerIndex++) {
					var headers = e.getElementsByTagName('h' + headerIndex);
					for (var i=headers.length-1; i >=0; i--) {
						if (readability.getClassWeight(headers[i]) < 0 || readability.getLinkDensity(headers[i]) > 0.33) {
							headers[i].parentNode.removeChild(headers[i]);
						}
					}
				}
			},
	
			/**
			 * Show the email popup.
			 *
			 * @return void
			 **/
			emailBox: function () {
			    var emailContainer = document.getElementById('email-container');
			    if(null != emailContainer)
			    {
			        return;
			    }

			    var emailContainer = document.createElement('div');
			    emailContainer.setAttribute('id', 'email-container');
			    emailContainer.innerHTML = '<iframe src="'+readability.emailSrc + '?pageUrl='+escape(window.location)+'&pageTitle='+escape(document.title)+'" scrolling="no" onload="readability.removeFrame()" style="width:500px; height: 490px; border: 0;"></iframe>';

			    document.body.appendChild(emailContainer);			
			},

			/**
			 * Show the email popup.
			 *
			 * @return void
			 **/
			kindleBox: function () {
			    var kindleContainer = document.getElementById('kindle-container');
			    if(null != kindleContainer)
			    {
			        return;
			    }

			    var kindleContainer = document.createElement('div');
			    kindleContainer.setAttribute('id', 'kindle-container');
			    kindleContainer.innerHTML = '<iframe id="readabilityKindleIframe" name="readabilityKindleIframe" scrolling="no" onload="readability.removeFrame()" style="width:500px; height: 490px; border: 0;"></iframe>';

			    document.body.appendChild(kindleContainer);

				/* Dynamically create a form to be POSTed to the iframe */
				var formHtml =  '<form id="readabilityKindleForm" style="display: none;" target="readabilityKindleIframe" method="post" action="' + readability.kindleSrc + '">\
				                     <input type="hidden" name="bodyContent" id="bodyContent" value="' + readability.htmlspecialchars(document.getElementById('readability-content').innerHTML) + '" />\
								     <input type="hidden" name="pageUrl" id="pageUrl" value="' + readability.htmlspecialchars(window.location) + '" />\
								     <input type="hidden" name="pageTitle" id="pageUrl" value="' + readability.htmlspecialchars(document.title) + '" />\
		                         </form>';

				document.body.innerHTML += formHtml;
				document.forms['readabilityKindleForm'].submit();
			},
	
			/**
			 * Close the email popup. This is a hacktackular way to check if we're in a "close loop".
			 * Since we don't have crossdomain access to the frame, we can only know when it has
			 * loaded again. If it's loaded over 3 times, we know to close the frame.
			 *
			 * @return void
			 **/
			removeFrame: function () {
			    readability.iframeLoads++;
			    if (readability.iframeLoads > 3)
			    {
			        var emailContainer = document.getElementById('email-container');
			        if (null !== emailContainer) {
			            emailContainer.parentNode.removeChild(emailContainer);
			        }

			        var kindleContainer = document.getElementById('kindle-container');
			        if (null !== kindleContainer) {
			            kindleContainer.parentNode.removeChild(kindleContainer);
			        }

			        readability.iframeLoads = 0;
			    }			
			},
	
			htmlspecialchars: function (s) {
				if (typeof(s) == "string") {
					s = s.replace(/&/g, "&amp;");
					s = s.replace(/"/g, "&quot;");
					s = s.replace(/'/g, "&#039;");
					s = s.replace(/</g, "&lt;");
					s = s.replace(/>/g, "&gt;");
				}
	
				return s;
			}
	
		};

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

				var indent = 20;

				var maxRightPosition = ($(window).width() - indent);
				var maxLeftPosition = indent;

				if (this.options.parentElement) {
					indent = 2;
					maxRightPosition = this.options.parentElement.width() - indent;
					maxLeftPosition = indent;
				}

				if ((tp.left + actualWidth) > maxRightPosition) {
					tp.left = maxRightPosition - indent - actualWidth;

					$tip.find(".arrow").css("left", pos.left + (pos.width / 2) - tp.left);

				}

				if (tp.left < maxLeftPosition) {
					tp.left = maxLeftPosition;

					$tip.find(".arrow").css("left", pos.left + (pos.width / 2) - tp.left);
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
		  , template: '<div class="popover"><div class="arrow"></div><div class="popover-inner"><h3 class="popover-title"></h3><div class="popover-content"><p></p></div></div></div>'
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
		      this.options.width  && this.tip().width(  this.options.width  );
		      this.options.height && this.tip().height( this.options.height );

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

		      console.log(dt + ": clickover hide");
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
