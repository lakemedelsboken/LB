var lb = null;

//var console = {log: function() {}};

(function(window, undefined){

	$.ajaxSetup({cache: false});

	$.ScrollTo.configure({duration: 400});

	lb = {
		animateMenuBackDuration: 200,
		animateMenuForwardDuration: 200,
		preventAutoSearchOnce: false,
		fullScreen: false,
		cachedMenus: {},
		menuStack: [],
		timer: null,
		searchHasFocus : false,
		activeMenu: null,
		isSearchResultsOpen: false,
		medicineSearch: null,
		//titleSearch: null,
		contentSearch: null,
		isMedicineWindowOpen: false,
		clickoverIds: 0,
		nplId: null,
		currentId: null,
		currentChapter: "",
		tipCounter: 0,
		didResize: false,
		switchList: function(list, otherList) {
			var activeItemId = list.attr("aria-activedescendant");

			var listNumber = list.find("a.searchResult").index($("#" + activeItemId));

			var otherListNumber = listNumber;
			var otherListItems = otherList.find("li");

			if ((otherListItems.length - 1) < otherListNumber) {
				otherListNumber = otherListItems.length - 1;
			}
			
			if (otherListNumber > 0) {
				//Find the item and activate
				var newItem = $(otherListItems.get(otherListNumber));
				otherList.focus();
				otherList.menu("focus", null, newItem);
				
			} else {
				otherList.focus();
			}
			
		},
		init: function() {
			var self = this;

			//Make main content z-index higher than sidebar
			if (lb.isMobile.any()) {
				$("#mainContainer").css("position", "relative");
			}
		
			//Override jquery ui menu functions
			$.widget("ui.menu", $.extend({}, $.ui.menu.prototype, {
				expand: function(event){
					event.preventDefault();
					var list = $(event.target);
					var targetId = list.attr("id");

					//if (targetId === "titleSearchResultsList") {
						//self.switchList(list, $("#contentSearchResultsList"));
						//} else 
					if (targetId === "contentSearchResultsList") {
						self.switchList(list, $("#medicineSearchResultsList"));
					} else if (targetId === "medicineSearchResultsList") {
						self.switchList(list, $("#contentSearchResultsList"));
					} else {
						this.select(event);
					}
				},
				collapse: function(event){
					event.preventDefault();

					if (event.keyCode === 27) {
						if (lb.isMedicineWindowOpen) {
							lb.closeMedicineWindow();
						} else if (lb.isSearchResultsOpen) {
							lb.closeSearchResults();
							lb.preventAutoSearchOnce = true;
							$("#search").focus();
						}
						event.stopPropagation();
						event.preventDefault();
					} else {
						var list = $(event.target);
						var targetId = list.attr("id");

						//if (targetId === "titleSearchResultsList") {
							//self.switchList(list, $("#medicineSearchResultsList"));
							//} else 
						if (targetId === "contentSearchResultsList") {
							self.switchList(list, $("#medicineSearchResultsList"));
						} else if (targetId === "medicineSearchResultsList") {
							self.switchList(list, $("#contentSearchResultsList"));
						} else {
							self.goMenuBack();
						}
					}
				}
			
			}));
		
		
			$("#toggleNavigation").on("click", function(event) {
				if ($(this).text().indexOf("Visa") > -1) {
					$("#sideMenu").show();
					$(this).html("<i class=\"icon icon-chevron-up\"></i> Göm meny");
				} else {
					$("#sideMenu").hide();
					$(this).html("<i class=\"icon icon-chevron-down\"></i> Visa meny");
				}
			});
		
			$("body").on("click", "a.inlineGenerica", self.handleGenericas);
			$("body").on("click", "a.inlineProduct", self.handleProduct);
			$("body").on("click", "a.inlineBoxSearch", self.handleBoxSearch);
			$("body").on("click", "a.inlineListProduct", self.updateProductWindow);
			$("body").on("click", "a.inlineReference", self.handleReferences);
			$("body").on("click", ".factsLink", self.handleBoxLinks);
			$("body").on("click", ".figureLink", self.handleBoxLinks);
			$("body").on("click", ".tableLink", self.handleBoxLinks);
			$("body").on("click", ".therapyLink", self.handleBoxLinks);
			$("body").on("click", "a.pageFootnoteItem", self.handlePageFootnoteItems);
			$("body").on("click", "a.atcCodeInPopover", self.handleAtcCodeInPopover);
			$("body").on("click", "a.pdfLink", function(event) {
				ga('send', 'pageview', {'page': $(this).attr("href"), 'title': "PDF: " + $(this).text()});
				ga('send', 'event', 'pdf', $(this).text(), {'nonInteraction': 0});
			});

			//Check if settings button should be shown
			var updatedElements = $("span.updated");
			
			if (updatedElements.length > 0) {
				$("#settings").show();
			} else {
				$("#settings").hide();
			}
			
			//Read cookie for this setting
			var visualizeUpdatedText = $.cookie("visualizeUpdatedText");
			
			if (visualizeUpdatedText === undefined || visualizeUpdatedText === "false") {
				visualizeUpdatedText = false;
			} else {
				visualizeUpdatedText = true;
			}
			
			//Convert text style on load
			if (visualizeUpdatedText && updatedElements.length > 0) {
				updatedElements.addClass("active");
			}

			var checkboxStatus = (visualizeUpdatedText) ? " checked=\"checked\"" : "";

			function setupNewSettingsBox() {
				//Remove the last clickover
				$("#settings").clickover("destroy");

				//Read cookie
				visualizeUpdatedText = $.cookie("visualizeUpdatedText");
		
				//Cleanup
				if (visualizeUpdatedText === undefined || visualizeUpdatedText === "false") {
					visualizeUpdatedText = false;
				} else {
					visualizeUpdatedText = true;
				}

				checkboxStatus = (visualizeUpdatedText) ? " checked=\"checked\"" : "";

				//Setup new clickover for settings
				$("#settings").clickover({
					html: true, 
					title: "Inställningar",
					content: "<div class=\"settings\"><label class=\"checkbox\"><input type=\"checkbox\" id=\"visualizeUpdatedText\"" + checkboxStatus + "> Visa uppdaterad text med röd färg</label></div>",
					placement: "left",
					allow_multiple: true,
					class_name: "settingsBox",
					onHidden: setupNewSettingsBox
				});
				
			}

			//Initiate settings
			$("#settings").clickover({
				html: true, 
				title: "Inställningar",
				content: "<div class=\"settings\"><label class=\"checkbox\"><input type=\"checkbox\" id=\"visualizeUpdatedText\"" + checkboxStatus + "> Visa uppdaterad text med röd färg</label></div>",
				placement: "left",
				allow_multiple: true,
				class_name: "settingsBox",
				onHidden: setupNewSettingsBox
			});

			$("body").on("click", "#visualizeUpdatedText", function(event) {
				var updatedElements = $("span.updated");
				
				if ($(this).prop("checked")) {
					updatedElements.addClass("active");
					$.cookie("visualizeUpdatedText", "true");
				} else {
					updatedElements.removeClass("active");
					$(this).removeAttr("checked");
					$.cookie("visualizeUpdatedText", "false");
				}

				//Reset all clickovers, except settings
				$("[data-original-title]").each(function() {
					if ($(this).attr("id") !== "settings") {
						$(this).clickover("destroy");
					}
				});
				
				/*
				setTimeout(function() {

					
				}, 500);
				*/
				
			});

			//Handlers for product information accordion
			$("#modalMed").on("click", "#toggleAllSections", self.toggleAccordion);

			$("#modalMed").on("click", ".toggleSection", self.toggleSection);
			
			$("body").on("click", ".gotoBoxLink", function(event) {
	            $('[data-clickover-open=1]').each( function() { 
	                $(this).data('clickover') && $(this).data('clickover').clickery(); 
				});
			});

			//Specific events, retained across ajax fetching
			$("#mask").click(function(event) {event.stopPropagation(); self.closeMedicineWindow();});
			$("#searchMask").click(self.closeSearchResults);
			$("#mainContainer").click(self.closeSearchResults);
			$("#fullscreen").click(self.setFullscreen);
			$("#normalscreen").click(self.setNormalscreen);
			//Adapt images on the fly when resizing


			$(window).on("resize", function() {
				lb.didResize = true;
			});

			setInterval(function() {
				if (lb.didResize) {
					lb.didResize = false;

					picturefill();
				}
			}, 1500);


			$("#modalMed").on("click", ".close", function(event) {
				self.closeMedicineWindow();
			});

			$("#modalMed").on("click", "#modalMedTitle", function(event) {
				self.closeMedicineWindow();
			});

			$("#modalMed").on("click", "button#medListToggler", function(event) {
				var toggler = $(this);
				if (toggler.attr("data-open") !== undefined && toggler.attr("data-open") === "true") {
					toggler.attr("data-open", "false");
					$("#medList").hide("fast");
					toggler.html(toggler.html().replace("Göm", "Visa"));
				} else {
					toggler.attr("data-open", "true");
					$("#medList").show("fast");
					toggler.html(toggler.html().replace("Visa", "Göm"));
				}
			});


			lb.zoom = document.documentElement.clientWidth / window.innerWidth;
			
			if (!lb.isMobile.any()) {
				//Non mobile specific
				self.initKeyboardNavigation();
			} else {
				//Mobile specific

				//Choose pictures based on zoom level
				$(window).resize(function() {
				    var zoomNew = document.documentElement.clientWidth / window.innerWidth;
				    if (lb.zoom != zoomNew) {
				        lb.zoom = zoomNew;
						picturefill({zoom: lb.zoom});
				    }
				});

				
			}

			self.initSearch();

			//TODO: Move these event handlers

			//Toogle size of image from fass
			$("#modalMed").on("click", ".medImage", function(event) {
				if ($(this).css("max-width") === "100px") {
					$(this).css("max-width", "100%");
				} else {
					$(this).css("max-width", "100px");
				}
			});
		

			//Restore state
			var state = History.getState();
			var initializeMenu = lb.restoreState(null, state.url);

			//Menu might have been initialized by restoreState
			if (initializeMenu) {
				//Async
				self.initMenu(state);
			}

			//Adapt images to retina
			picturefill(undefined, function() {
				if (lb.currentId !== null) {

					var scrollItem = $("#" + lb.currentId);
					if (scrollItem.length === 1) {
						scrollItem.ScrollTo();
					} else {
						$("body").animate({ scrollTop: 0 }, "fast");
					}
				}
				
				//Ready for scrollspy
				//self.initScrollSpy();
			});

		},
		initScrollSpy: function() {

			//Find headers
			var targets = $("#main").find("h1,h2,h3,h4");
			
			//Remove "Tabeller och figurer"
			targets = targets.filter(function(index, element) {
				return (!$(element).hasClass("overview"));
			});
			
			//var offsets = [];
			
			targets.each(function(index, element) {
				element.top = $(element).position().top;
				//offsets.push(parseInt($(element).position().top));
			});
			
			//offsets.sort(function(a, b) {return a - b;});
			targets.sort(function(a, b) {return a.top - b.top;});
			
		    var didScroll = false;
     
		    $(window).scroll(function() {
		        didScroll = true;
		    });
			
			lb.activeScrollTarget = null;
			
			setInterval(function() {
				if (didScroll) {
					didScroll = false;
					var scrollFromTop = $(document).scrollTop();
					for (i = targets.length; i--;) {
						lb.activeScrollTarget != targets[i]
						&& scrollFromTop >= targets[i].top
						&& (!targets[i + 1] || scrollFromTop <= targets[i + 1].top)
						&& lb.activateScrollTarget(targets[i])
					}
					
				}
			}, 1000);

		},
		activateScrollTarget: function(element) {
			lb.activeScrollTarget = element;
			lb.currentId = $(element).attr("id");

			var chapterName = $.trim($("#mainContainer").find("h1").first().text());
			var state = lb.getState();
			History.replaceState(state, $.trim($(element).text()) + " | " + chapterName + " | Läkemedelsboken", state.toString());
			
		},
		initMenu: function(state, suppressSearch) {
			var self = this;
			
			var menuAnimationDuration = 5;
		
			//Clear old menus
			if (self.menuStack.length > 0) {
				self.activeMenu = null;
				for (var i = self.menuStack.length - 1; i >= 0; i--) {
					self.menuStack[i].hide();
					self.menuStack.pop();
				}
				self.cachedMenus = {};
			}
		
			//Get id from first header as fallback
			var firstItem = $("h1").first();
			var menuId = firstItem.attr("id");
			
			//Render root menu
			//self.addMenu("root", "Läkemedelsboken", "forward", undefined, menuAnimationDuration, true, function() {
			self.addMenu("root", "Läkemedelsboken", "forward", undefined, menuAnimationDuration, true, function() {

				//Render division menu
				var chapterId = null;
				if (menuId && menuId.indexOf("_") > -1) {
					chapterId = menuId.split("_")[0];
				}


				if (chapterId !== null) {
					//Render division menu
					self.addMenu(chapterId, undefined, "forward", "", menuAnimationDuration, true, function() {

						var chapter = undefined;
				
						if (state) {
							var url = state.url;
							if (url.indexOf("#") > -1) {
								url = url.split("#")[0];
							}
							if (url.indexOf("?") > -1) {
								url = url.split("?")[0];
							}
							if (url.indexOf("/") > -1) {
								url = url.split("/");
								url = url[url.length - 1];
							}

							chapter = url;
							
						}

						//Render chapter menu
						self.addMenu(menuId, firstItem.text(), "forward", chapter, menuAnimationDuration, true, function() {
							
							var chapterItem = null;

							if (lb.currentId !== null) {
								var possibleItem = $("#" + lb.currentId);
								if (possibleItem.length === 1) {
									chapterItem = possibleItem;
								}
							}

							if (chapterItem !== null) {
								//Build menu stack from beginning of chapter
								var headers = $("h1[id], h2[id], h3[id], h4[id]");

								var currentIndex = headers.index(chapterItem);
								var currentLevel = parseInt(chapterItem[0].nodeName.toLowerCase().replace("h", ""));
								if (chapterItem.hasClass("facts") || chapterItem.hasClass("figure") || chapterItem.hasClass("therapyRecommendations") || chapterItem.hasClass("infoTable")) {
									currentLevel = currentLevel - 1;
								}
								var stack = [];
								if (currentIndex > 0) {
									for (var i = currentIndex; i >= 1; i--) {
										var headerLevel = parseInt(headers[i].nodeName.toLowerCase().replace("h", ""));
										if (headerLevel < currentLevel) {
											currentLevel = headerLevel;
											stack.unshift($(headers[i]).attr("id"));
										}
									}
								}

								if (suppressSearch) {
									lb.preventAutoSearchOnce = true;
								}

								//TODO: Lots of exits, maybe fix?

								//Render the stack
								
								self.renderMenuStack(stack, chapter, menuAnimationDuration, function() {

									var activeMenuItem = self.activeMenu.find("li").filter(function() { 
										//A bit crude - TODO: Fix for id instead?
										//return $.trim($(this).text()) == $.trim(chapterItem.text());
										return ($(this).find("a").first().attr("href").indexOf(chapterItem.attr("id")) > -1);
									});
								
									if (activeMenuItem.length === 1) {

										if (activeMenuItem.find("a").first().attr("data-has-children") === "true") {

											self.addMenu(chapterItem.attr("id"), chapterItem.text(), "forward", chapter, menuAnimationDuration, true, function() {

												if (lb.currentId !== null) {
													var scrollItem = $("#" + lb.currentId);
													if (scrollItem.length === 1) {
														//scrollItem.ScrollTo();
													} else {
														//$("body").animate({ scrollTop: 0 }, "fast");
													}
												}

												//$("#search").focus();
											
												activeMenuItem = lb.activeMenu.find("li").eq(1);
												activeMenuItem.find("a").addClass("ui-state-focus");
												setTimeout(function() {
													activeMenuItem.find("a").removeClass("ui-state-focus");
													setTimeout(function() {
														activeMenuItem.find("a").addClass("ui-state-focus");
														setTimeout(function() {
															activeMenuItem.find("a").removeClass("ui-state-focus");
														}, 300);
													
													},200);
												}, 300);
											
											});
										
										} else {
											if (lb.currentId !== null) {
												var scrollItem = $("#" + lb.currentId);
												if (scrollItem.length === 1) {
													//scrollItem.ScrollTo();
												} else {
													//$("body").animate({ scrollTop: 0 }, "fast");
												}
											}
											//$("#search").focus();
										
											activeMenuItem.find("a").addClass("ui-state-focus");
											setTimeout(function() {
												activeMenuItem.find("a").removeClass("ui-state-focus");
												setTimeout(function() {
													activeMenuItem.find("a").addClass("ui-state-focus");
													setTimeout(function() {
														activeMenuItem.find("a").removeClass("ui-state-focus");
													}, 300);
												
												},200);
											}, 1000);
										
										}
									} else {

										if (lb.currentId !== null) {

											var scrollItem = $("#" + lb.currentId);

											if (scrollItem.length === 1) {
												//scrollItem.ScrollTo();
											} else {
												//$("body").animate({ scrollTop: 0 }, "fast");
											}
										}
										//$("#search").focus();
									}
								
								});
							} else {
								if (lb.currentId !== null) {
									var scrollItem = $("#" + lb.currentId);
									if (scrollItem.length === 1) {
										scrollItem.ScrollTo();
									} else {
										$("body").animate({ scrollTop: 0 }, "fast");
									}
								}
								//$("#search").focus();
							}
							
						});
					});
				} else {
					$("#search").focus();
				}
			
			});
		},
		renderMenuStack: function(stack, chapter, menuAnimationDuration, callback) {
			var self = this;
			if (stack.length > 0) {
				var id = stack.shift();
				var element = $("#" + id);

				//Remove unwanted chars
				element.find("fieldset").remove();
				element.find("sup.hiddenNoteNumber").remove();

				//console.log(element.text());

				self.addMenu(id, element.text(), "forward", chapter, menuAnimationDuration, true, function() {
					self.renderMenuStack(stack, chapter, menuAnimationDuration, callback);
				});
			} else {
				callback();
			}
		},
		toggleFullscreen: function(event) {

			if (lb.fullScreen) {
				lb.setNormalscreen(event);
			} else {
				lb.setFullscreen(event);
			}
		
			event.preventDefault();
		},
		setFullscreen: function(event) {
			if (!lb.fullScreen) {
				$("#fullscreenIcon").removeClass("icon-resize-full").addClass("icon-refresh");

				$("#sideContainer").addClass("hidden");
				$("#mainContainer").removeClass("offset4 span8").addClass("span10 offset1");
				if ($(window).width() > 767) {
					$("#normalscreen").show();
					//TODO: Show hint for toggling normal screen
					
				}

				setTimeout(function() {
					$("#fullscreenIcon").removeClass("icon-refresh").addClass("icon-resize-full");
				}, 200);

				lb.fullScreen = true;
			}
			if (event) {
				event.preventDefault();
			}
		},
		setNormalscreen: function(event) {
			//TODO: Show hint for toggling full screen
			if (lb.fullScreen) {
				$("#normalscreenIcon").removeClass("icon-resize-small").addClass("icon-refresh");
				$("#mainContainer").removeClass("span10 offset1").addClass("span8 offset4");
				$("#sideContainer").removeClass("hidden");
				$("#normalscreen").hide();
				lb.fullScreen = false;

				setTimeout(function() {
					$("#normalscreenIcon").removeClass("icon-refresh").addClass("icon-resize-small");
				}, 200);

			}
			if (event) {
				event.preventDefault();
			}
		},
		goMenuBack: function() {

			var self = this;
		
			if (self.menuStack.length > 1) {
				//Find previous menu in stack
				var parentMenu = self.menuStack[self.menuStack.length - 2];

				//Remove last from stack
				self.menuStack.pop();
		
				self.animateMenuBackward(parentMenu, lb.animateMenuBackDuration);
			
			}
		},
		addMenu: function(menuId, firstText, direction, chapter, animDuration, skipFocus, next) {
			var self = this;

			if (skipFocus === undefined) {
				skipFocus = false;
			}
		
			if (animDuration === undefined || animDuration === null) {
				animDuration = lb.animateMenuForwardDuration;
			}
		
			if (self.cachedMenus[menuId] === undefined) {
				var newMenu = $("<ul id=\"menu_" + menuId + "\" class=\"nav nav-tabs nav-stacked sideBarNavigation\" />");

				//Add to stack and cache
				self.menuStack.push(newMenu);
				self.cachedMenus[menuId] = newMenu;

				if (chapter !== undefined) {
					newMenu.append($("<li class=\"backItem\"><a href=\"/" + (chapter !== undefined ? chapter : "") + "#back\" class=\"btn menuBack\"><i class=\"icon icon-angle-up\"></i> Tillbaka</a></li>")); 
				} 
				if (firstText !== undefined) {
					newMenu.append($("<li><a class=\"titleItem\" href=\"/" + (chapter !== undefined ? chapter : "") + "#" + menuId + "\"" + ((chapter !== undefined) ? " data-chapter=\"" + chapter + "\"" : " data-chapter=\"\"") + ">" + firstText + "</a></li>")); 
				}
				newMenu.append($("<li class=\"menuLoading\"><a href=\"#\"><i class=\"icon-refresh icon-spin\"></i> Hämtar rubriker...</a></li>")); 

				//Apply jquery-ui-menu magic
				newMenu.menu({select: function(event, ui) {

					event.preventDefault();
					var currentMenuItem = ui.item;
					newMenu.lastActive = currentMenuItem;
					var anchor = currentMenuItem.find("a");
					var openMenuId = null;
					var href = anchor.attr("href");

					if (href.indexOf("#") > -1) {
						openMenuId = href.split("#")[1];
					}
				
					var openMenuText = ui.item.text();

					if (openMenuId === "back") {
					
						self.goMenuBack();
					
					} else {
						if (anchor.hasClass("background")) {
						
							//find the current menu id
							var thisMenuId = currentMenuItem.parent("ul").attr("id");
												
							//close all overlying menus
							for (var i = lb.menuStack.length - 1; i >= 0; i--) {
								if (lb.menuStack[i].attr("id") == thisMenuId) {
									self.activeMenu = lb.menuStack[i];
									break;
								} else {
									//animate menu out
									var newActiveMenu = lb.menuStack[i - 1];
									lb.menuStack.pop();
									lb.animateMenuBackward(newActiveMenu, lb.animateMenuBackDuration);
								}
							}
						
						} else if (anchor.attr("data-has-children") === "true") {
							//Selected a parent - open menu containing children
							self.addMenu(openMenuId, openMenuText, "forward", anchor.attr("data-chapter"));
						} else {
							//Selected an item
							var chapter = anchor.attr("data-chapter");
							var id = openMenuId;

							var currentChapter = lb.currentChapter;
				
							if (currentChapter === "") {
								currentChapter = window.location.href;
							}
				
							if (currentChapter.indexOf(chapter) > -1) {
								//Item in currently open chapter
								//Scroll to correct position
								var scrollItem = $("#" + id);
								if (scrollItem.length === 1) {
									scrollItem.ScrollTo();
								} else {
									$("body").animate({ scrollTop: 0 }, "fast");
								}

								//Set history
								var state = lb.getState(id);
								History.pushState(state, openMenuText + " | Läkemedelsboken", state.toString());

								//TODO: Should not be necessary
								setTimeout(function() {
									if ($(window).width() > 768) {
										self.activeMenu.focus();
										self.activeMenu.menu("focus", null, ui.item);
									}
								}, 300);
							} else {
								//Need to open the chapter
								var state = lb.getState(id);
								History.pushState(state, null, "/" + chapter + state.toString());

								//Inject content with ajax
								lb.openPage(chapter, id, false);
							
							}
						
						}
					}
				}});
			
				//Attach to document
				newMenu.hide();
				$("#sideMenu").append(newMenu);

				var animationDone = false;
				var loadingDone = false;

				//Perform animation and focus, async
				if (direction === "backward") {
					self.animateMenuBackward(newMenu, animDuration);
				} else {
					self.animateMenuForward(newMenu, animDuration, skipFocus, function() {
						animationDone = true;

						//console.log("Animation done, loadingDone: " + loadingDone);
						
						if (animationDone && loadingDone && next !== undefined) {
							//console.log("Continue because animation was lagging");
							next();
						}
					});
				}

				//Fetch index items and add to new menu, async
				lb.getTocMenuItems(menuId, function(err, data) {
					if (err) {
						//console.log(err);
						//Remove loading indicator
						newMenu.find(".menuLoading").remove();
						//Display error message
						newMenu.append($("<li><a href=\"#\"><i class=\"icon icon-info-sign\"></i> Ett fel inträffade, lyckades inte hämta innehållsförteckningen</a></li>")); 
						//Refresh
						newMenu.menu("refresh");
						if (next !== undefined) {
							next();
						}
					} else {

						/*
						if (data.length > 0) {
							//Get id of first item and change titleItem:s link to reflect
							var firstItem = data[0];
							var titleItem = newMenu.find(".titleItem").first();
							if (titleItem.length === 1) {
								titleItem.attr("href", "/" + firstItem.chapter + "#" + firstItem.id);
							}
						}
						*/

						//console.log("Got " + data.length + " items");
						//console.log(data);
						//Create menu from fetched items
						for (var i=0; i < data.length; i++) {
							var item = data[i];
							if (item.headeritem !== undefined) {

								//Get id of first item and change titleItem:s link to reflect
								var firstItem = item;
								var titleItem = newMenu.find(".titleItem").first();
								if (titleItem.length === 1) {
									titleItem.attr("href", "/" + firstItem.chapter + "#" + firstItem.id);
									titleItem.text(item.title)
								} else {
									newMenu.append($("<li><a class=\"titleItem\" href=\"/" + item.chapter + "#" + item.id + "\"" + ((item.chapter !== undefined) ? " data-chapter=\"" + item.chapter + "\"" : " data-chapter=\"\"") + " data-has-children=\"false\">" + item.title + "</a></li>")); 
								}

								//newMenu.append($("<li><a class=\"titleItem\" href=\"/" + chapter + "#" + menuId + "\"" + ((item.chapter !== undefined) ? " data-chapter=\"" + item.chapter + "\"" : " data-chapter=\"\"") + ">" + item.title + "</a></li>")); 
							} else {
								var itemType = item.type;
								if (item.hasChildren) {
									itemType = "parent";
								}
								newMenu.append($("<li><a href=\"/" + item.chapter + "#" + item.id + "\"" + ((item.chapter !== undefined) ? " data-chapter=\"" + item.chapter + "\"" : " data-chapter=\"\"") + " data-has-children=\"" + (item.hasChildren ? "true" : "false") + "\"><i class=\"" + lb.getIcon(itemType) + "\"></i> " + (item.hasChildren ? "<i class=\"icon icon-angle-down pull-right\"></i> " : "") + item.title + "</a></li>")); 
							}
						}

						//Remove loading indicator
						newMenu.find(".menuLoading").remove();
				
						//Refresh
						newMenu.menu("refresh");

						loadingDone = true;

						if (animationDone && loadingDone && next) {
							next();
						}
					}
				});
			} else {
				//Menu had been opened previously, fetch from cache
				var newMenu = self.cachedMenus[menuId];

				$("#sideMenu").append(newMenu);
				self.menuStack.push(newMenu);

				//Animate in
				if (direction === "backward") {
					self.animateMenuBackward(newMenu, animDuration);
					if (next !== undefined) {
						next();
					}
				} else {
					self.animateMenuForward(newMenu, animDuration, skipFocus, function() {
						if (next !== undefined) {
							next();
						}
					});
				}


			}
		
		},
		animateMenuForward: function(newMenu, duration, skipFocus, next) {

			var self = this;

			if (self.activeMenu === null) {
				//First menu, no need to animate
				newMenu.css("bottom", "10px");
				newMenu.show();
				$("#sideMenu").append(newMenu);
				self.activeMenu = newMenu;
				if (next !== undefined) {
					next();
				}
			} else {
			
				//Append to far bottom
				newMenu.css({left: 0, top: $("#sideMenu").height() + 100});

				//Make sure it is visible
				newMenu.show();

				//Save active menu reference
				var oldMenu = self.activeMenu;

				var oldMenuTop = parseInt(oldMenu.css("top"));
				var oldMenuItems = oldMenu.find("li");
				var titleItem = oldMenu.find(".titleItem").first().parent();
				var visibleItemHeight = titleItem.height();

				//Set as current active menu
				self.activeMenu = newMenu;
			
				var titleIndex = oldMenuItems.index(titleItem);
			
				var animationProperties = {};

				var hideDuration = duration;

				//Make sure hiding is a fraction faster than displaying the new menu
				if (hideDuration > 0) {
					hideDuration = hideDuration - 1;
				}

				//Hide old items, except title
				oldMenuItems.each(function(index, element) {
					if (index !== titleIndex) {
						$(element).hide(hideDuration);
						//$(element).css("display", "none");
					}
				});

				//Set title to background
				titleItem.find("a").addClass("background");

				//Number of pixels to draw over the parent menu, from bottom
				var overdraw = 4;

				//Move new menu in
				newMenu.animate({
					top: (oldMenuTop + visibleItemHeight - overdraw)
				}, duration, "linear", function() {
					//Done animating
					newMenu.css("bottom", "10px");
				
					newMenu.focus();
					var focusedItem = newMenu.find(".titleItem").first().parent();
					
					newMenu.menu("focus", null, focusedItem);

					if (next !== undefined) {
						next();
					}
				});
			}
		
		},
		animateMenuBackward: function(newMenu, duration) {

			var self = this;

			if (self.activeMenu === null) {
				//Something went wrong
			} else {

				//Save ref to old menu
				var oldMenu = self.activeMenu;

				//Set newMenu as active menu
				self.activeMenu = newMenu;
			
				oldMenu.animate({
					top: $("#sideMenu").height() + 100
				}, duration, "linear", function() {
					//Done animating, hide the old one for real
					oldMenu.hide();
					oldMenu.detach();
					oldMenu.css("bottom", "auto");
				});

				var newMenuItems = newMenu.find("li");

				//Show the new menu
				newMenuItems.each(function(index, element) {
					$(element).show(duration);
					$(element).find("a").removeClass("background");
				
				});
			
				newMenu.focus();

				if (newMenu.lastActive !== undefined) {
					newMenu.menu("focus", null, newMenu.lastActive);
				}

			}
		
		},
		getTocMenuItems: function(parentId, callback) {
			$.getJSON("/tocitems?id=" + encodeURIComponent(parentId), function(results) {
				callback(null, results);
			}).error(function(jqXHR, status, error) {
				callback("Kunde inte hitta rubriker");
			});
		},
		getTocParentMenuItems: function(childId, callback) {
			$.getJSON("/tocparentitems?id=" + encodeURIComponent(childId), function(results) {
				callback(null, results);
			}).error(function(jqXHR, status, error) {
				callback("Kunde inte hitta rubriker");
			});
		},
		initKeyboardNavigation: function() {

			var self = this;

			$("#search").bind("keydown", "down", function(event) {
				if (self.activeMenu !== null && !self.isSearchResultsOpen) {
					self.activeMenu.focus();
				} else if (self.isSearchResultsOpen) {
					$("#contentSearchResultsList").focus();
				}
				event.preventDefault();
				event.stopPropagation();
			});

			$(document).bind("keydown", "esc", function() {

				if (lb.isMedicineWindowOpen) {
					lb.closeMedicineWindow();
				} else if (lb.isSearchResultsOpen) {
					lb.closeSearchResults();
					$("#search").focus();
				} else if (lb.fullScreen) {
					lb.setNormalscreen();
				}
			});

			lb.activeToggle = null;
			$(document).bind("keydown", "j", function(event) {
				if (!lb.isSearchResultsOpen && !lb.isMedicineWindowOpen) {
					event.stopPropagation();
					event.preventDefault();
					$("html, body").scrollTop($(window).scrollTop() - 50);
				}
			
				if (lb.isMedicineWindowOpen) {
					var toggles = $(".toggleSection");

					if (toggles.length > 0) {
						if (lb.activeToggle === null) {
							toggles.last().focus();
							lb.activeToggle = toggles.last();
						} else {
							var previousToggle = null;
							var prevElement = null;

							toggles.each(function(index, element) {

								if ($(element).attr("href") === lb.activeToggle.attr("href")) {
									return false;
								} else {
									prevElement = $(element);
								}
							
							});

							previousToggle = prevElement;
						
							if (previousToggle === null) {
								previousToggle = toggles.last();
							}
						
							previousToggle.focus();
							//previousToggle.ScrollTo({onlyIfOutside: true});
							//$("#medDisplay").ScrollTo(previousToggle);
							lb.activeToggle = previousToggle;
						}
					}
				}
			});

			$(document).bind("keydown", "k", function(event) {
				if (!lb.isSearchResultsOpen && !lb.isMedicineWindowOpen) {
					event.stopPropagation();
					event.preventDefault();
					$("html, body").scrollTop($(window).scrollTop() + 50);
				}

				if (lb.isMedicineWindowOpen) {
					event.stopPropagation();
					event.preventDefault();
					var toggles = $(".toggleSection");
					if (toggles.length > 0) {
						if (lb.activeToggle === null) {
							toggles.first().focus();
							lb.activeToggle = toggles.first();
						} else {
							var nextToggle = null;
							var foundCurrent = false;
							toggles.each(function(index, element) {
								if (foundCurrent) {
									nextToggle = $(element);
									return false;
								}

								if ($(element).attr("href") === lb.activeToggle.attr("href")) {
									foundCurrent = true;
								}
							});
						
							if (nextToggle === null) {
								nextToggle = toggles.first();
							}
							nextToggle.focus();
							//nextToggle.ScrollTo({onlyIfOutside: true});
							//$("#medDisplay").ScrollTo(nextToggle);
							lb.activeToggle = nextToggle;
						}
					}
				}

			});
		
			$("#medDisplay").bind("keydown", "up down", function(event) {
				if (lb.isMedicineWindowOpen) {
					if ($("#medList").attr("lastActive") !== undefined) {
						$("#medList").focus();
						$("#medList").menu("focus", null, $($("#medList").attr("lastActive")));
					} else {
						$("#medList").focus();
					}
				}
			});
		
		},
		getIcon: function(type) {
			var icons = {
				parent: "icon-bookmark-empty",
				header: "icon-chevron-right",
				infoTable: "icon-th-large",
				facts: "icon-th-list",
				therapyRecommendations: "icon-info-sign",
				figure: "icon-bar-chart",
				division: "icon-bookmark-empty"
			}
			if (icons[type] !== undefined) {
				return icons[type];
			} else {
				return icons["header"];
			}
		},
		getState: function(id) {
			var state = {
				search: $("#search").val(),
				isSearchResultsOpen: lb.isSearchResultsOpen,
				isMedicineWindowOpen: lb.isMedicineWindowOpen,
				nplId: lb.nplId,
				toString: function() {
					var out = "?";

					out += "search=" + encodeURIComponent(this.search);
					out += "&iso=" + this.isSearchResultsOpen;
					out += "&imo=" + this.isMedicineWindowOpen;
					out += "&nplId=" + this.nplId;
				
					if (this.id) {
						out += "&id=" + this.id;
					}

					return out; 
				}
			};
		
			if (id) {
				lb.currentId = id;
				state.id = id;
			} else if (lb.currentId) {
				state.id = lb.currentId;
			}
		
			return state;
		},
		restoreState: function(state, uri, callback) {
			var internalState = {
				search: "",
				isMedicineWindowOpen: false,
				isSearchResultsOpen: false,
				nplId: null,
				id: null
			};
			var otherChapter = null;

			if (uri && uri.indexOf("?") > -1) {

				//Fix IE #{chapter}
				if (uri.indexOf("#") > -1) {
					otherChapter = uri.split("?")[0];
					otherChapter = otherChapter.split("#")[1];
					if (otherChapter && otherChapter.indexOf(".html") === -1) {
						otherChapter = null;
					}
				}

				var parts = uri.split("?");

				parts.shift();
				parts = parts.join("?");
			
				parts = parts.split("&");
			
				for (var i = 0; i < parts.length; i++) {
					if (parts[i].indexOf("=") > -1) {
						var values = parts[i].split("=");
						if (values.length === 2) {
							var key = values[0];
							var value = values[1];
						
							if (value.indexOf("#") > -1) {
								value = value.split("#")[0];
							}
						
							if (key === "search") {
								//search box
								internalState.search = decodeURIComponent(value);
							} else if (key === "imo") {
								//medicine window
								internalState.isMedicineWindowOpen = (value === "true" ? true : false);
							} else if (key === "iso") {
								//search window
								internalState.isSearchResultsOpen = (value === "true" ? true : false);
							} else if (key === "nplId") {
								//current medicine
								internalState.nplId = (value === "null" ? null : value);
							} else if (key === "id") {
								//current place in text
								internalState.id = (value === "null" ? null : value);
							}
						}
					}
				}			
			
			} else if (state) {
				internalState = state;
			}
			

			//Product info, must execute before search
			lb.nplId = internalState.nplId;

			if (internalState.isMedicineWindowOpen && internalState.nplId) {
				lb.handleProduct(null, lb.nplId);
			} else {
				lb.closeMedicineWindow();
			}
		
			//Search
			if (internalState.search && internalState.search !== "") {

				lb.oldSearchValue = internalState.search;
				$("#search").val(internalState.search);

				if (internalState.isSearchResultsOpen) {
					//console.log("restoreState reset prevent");
					lb.preventAutoSearchOnce = false;
					lb.performSearch();
				} else {
					//lb.closeSearchResults();
					lb.preventAutoSearchOnce = true;
				}
			
			}

			if (internalState.id) {
				lb.currentId = internalState.id;
			}

			if (otherChapter) {
				lb.openPage(otherChapter, internalState.id, true);
			} else if (internalState.id) {
				var scrollItem = $("#" + internalState.id);
				if (scrollItem.length === 1) {
					scrollItem.ScrollTo();
				} else {
					$("body").animate({ scrollTop: 0 }, "fast");
				}
			}
		
			//Was another chapter opened in html4 browser? 
			//In that case - make sure initMenu is not called by returning false
			return (otherChapter === null || otherChapter === undefined);
		
		},
		openPage: function(chapter, id, forceMenuUpdate) {
			//Inject content via ajax
			var self = this;
		
			lb.currentChapter = chapter;
		
			if (!id) {
				id = "";
			}

			if (forceMenuUpdate === undefined) {
				forceMenuUpdate = true;
			}

			lb.closeSearchResults();
			$("#search").blur();

			$("#loading").show();

			var documentHtml = function(html){
				// Prepare
				var result = String(html)
					.replace(/<\!DOCTYPE[^>]*>/i, '')
					.replace(/<(html|head|body|title|meta|script)([\s\>])/gi,'<div class="document-$1"$2')
					.replace(/<\/(html|head|body|title|meta|script)\>/gi,'</div>')
				;

				// Return
				return $.trim(result);
			};
		
			$.ajax({
				url: chapter ,
				success: function(data, textStatus, jqXHR){
					var
						$data = $(documentHtml(data)),
						$dataBody = $data.find('.document-body:first'),
						$dataContent = $dataBody.find("#mainContainer").filter(':first'),
						$menuChildren, contentHtml;

					// Fetch the content
					contentHtml = $dataContent.html()||$data.html();

					if (!contentHtml) {
						document.location.href = chapter + "#" + id;
						return false;
					}

					$("#mainContainer").html(contentHtml);
					
					//Fix link to pdf
					var pdf = $("#pdf");
					var newPdf = $dataBody.find("#pdf");
					
					if (pdf.length === 1 && newPdf.length === 1) {
						pdf.attr("href", newPdf.attr("href"));
						pdf.show("fast");
					}
					
					//Check if settings should be visible
					var updatedElements = $("span.updated");
					
					if (updatedElements.length > 0) {
						$("#settings").show("fast");
					} else {
						$("#settings").hide();
					}

					//Read cookie
					var visualizeUpdatedText = $.cookie("visualizeUpdatedText");

					if (visualizeUpdatedText === undefined || visualizeUpdatedText === "false") {
						visualizeUpdatedText = false;
					} else {
						visualizeUpdatedText = true;
					}

					//Convert text style on load
					if (visualizeUpdatedText && updatedElements.length > 0) {
						updatedElements.addClass("active");
					}

					var scrollItem = $("#" + id);
					if (scrollItem.length === 1) {
						scrollItem.ScrollTo();
					} else {
						$("body").animate({ scrollTop: 0 }, "fast");
					}

					$("#loading").hide();

					//Fix navigation menu
					if (forceMenuUpdate) {
						self.initMenu(History.getState(), true);
					}
				
					lb.preventAutoSearchOnce = true;
					$("#search").focus();
				
					picturefill(undefined, function() {

						// Complete the change
						if (scrollItem.length === 1) {
							scrollItem.ScrollTo();
						}

						lb.preventAutoSearchOnce = true;
						$("#search").focus();

						//TODO: Maybe add this again?
						//self.initScrollSpy();
						
					});

					//Update the title
					document.title = $data.find('.document-title:first').text();
					try {
						document.getElementsByTagName('title')[0].innerHTML = document.title.replace('<','&lt;').replace('>','&gt;').replace(' & ',' &amp; ');
					}
					catch ( Exception ) { }
					
					var relativeUrl = chapter;
					
					//Track page request
					ga('send', 'pageview', {'page': chapter, 'title': document.title});

				},
				error: function(jqXHR, textStatus, errorThrown){
						document.location.href = chapter + "#" + id;
						return false;
				}
			});
		},
		oldSearchValue: "",
		initSearch: function() {

			var self = this;
			var search = $("#search");
			var searchResults = $("#searchResults");

			/*
			$("#titleSearchResultsList").menu({select: function(event, ui) {
				event.preventDefault();
				lb.closeSearchResults();
				var anchor = ui.item.find("a");
				if (anchor) {
					var chapter = anchor.attr("href").split("#")[0];
					var id = anchor.attr("href").split("#")[1];

					var currentChapter = lb.currentChapter;
				
					if (currentChapter === "") {
						currentChapter = window.location.href;
					}
				
					if (currentChapter.indexOf(chapter) > -1) {
						if (lb.isMobile.any()) {
							search.blur();
						}
						var scrollItem = $("#" + id);
						if (scrollItem.length === 1) {
							scrollItem.ScrollTo();
						} else {
							$("body").animate({ scrollTop: 0 }, "fast");
						}
					
						lb.closeSearchResults();
						//Set history
						var state = lb.getState(id);
						History.pushState(state, null, state.toString());
					} else {
						var state = lb.getState(id);
						History.pushState(state, null, "/" + chapter + state.toString());
					
						//Inject
						lb.openPage(chapter, id);
					
					}
				}
			}});
			*/

			$("#contentSearchResultsList").menu({select: function(event, ui) {
				event.preventDefault();
				lb.closeSearchResults();
				var anchor = ui.item.find("a").first();

				if (anchor.length === 1) {
					var chapter = anchor.attr("href").split("#")[0];
					
					if (chapter.indexOf("?") > -1) {
						chapter = chapter.split("?")[0];
					}
					
					var id = anchor.attr("href").split("#")[1];

					var currentChapter = lb.currentChapter;
				
					if (currentChapter === "") {
						currentChapter = window.location.href;
					}
					
					if (currentChapter.indexOf(chapter) > -1) {
						if (lb.isMobile.any()) {
							search.blur();
						}

						var scrollItem = $("#" + id);
						if (scrollItem.length === 1) {
							scrollItem.ScrollTo();
						} else {
							$("body").animate({ scrollTop: 0 }, "fast");
						}
					
						lb.closeSearchResults();
						//Set history
						var state = lb.getState(id);
						History.pushState(state, null, state.toString());
					} else {
						var state = lb.getState(id);
						History.pushState(state, null, chapter + state.toString());

						//Inject
						lb.openPage(chapter, id);
					}
				}
			}});
			$("#medicineSearchResultsList").menu({select: function(event, ui) {
				if (event.originalEvent.type === "click") {
				
				} else {
					event.preventDefault();
					ui.item.find("a").click();
				}
			}});

			$("#medList").menu({select: function(event, ui) {

				if (event.originalEvent.type === "click") {
					$("#medList").attr("lastActive", "#" + ui.item.attr("id"));
				} else {
					event.preventDefault();
					ui.item.find("a").click();
					$("#medList").attr("lastActive", "#" + ui.item.attr("id"));
				}

			}});

			$("#searchForm").on("submit", function(event) {
				event.stopPropagation();
				event.preventDefault();

				if (lb.isMobile.any()) {
					search.blur();
				} else {
					search.trigger("change", [true]);
				}
			
			});

			if (!lb.isMobile.any()) {
				search.bind("keydown", "esc", function(event) {

					//console.log("search esc");
					if (lb.isSearchResultsOpen) {
						lb.closeSearchResults();
					} else if (search.val() !== "") {
						search.val("");
						var state = lb.getState();
						History.replaceState(state, "Läkemedelsboken", state.toString());
				
					} else {
						search.blur();
					}
					event.stopPropagation();
					event.preventDefault();
				});


//				$(document).bind("keydown", "1 2 3 4 5 6 7 8 9 0 a b c d e f g h i j k l m n o p q r s t u v w x y z å ä ö", function(event) {
				$(document).bind("keydown", "s", function(event) {

					if (lb.fullScreen) {
						lb.setNormalscreen(event);
					}

					if (lb.isMedicineWindowOpen) {
						lb.closeMedicineWindow(event);
					}
			
					if (!lb.searchHasFocus) {
						event.stopPropagation();
						event.preventDefault();
						$("#search").focus();
					}
				});

				$(document).bind("keydown", "f", function(event) {
					if (!lb.searchHasFocus) {
						event.stopPropagation();
						event.preventDefault();
						lb.toggleFullscreen(event);
					}
				});
			}


			$("#resetSearch").bind("click", function(event) {
				event.preventDefault();
				//event.stopPropagation();
				search.val("");
			
				var state = lb.getState();
				History.replaceState(state, "Läkemedelsboken", state.toString());
			
				search.focus();
			});

			$("#performSearch").bind("click", function(event) {
				event.preventDefault();
				event.stopPropagation();

				$("#searchForm").submit();

			});

			search.bind("keyup click change", function(event, forced) {

				if (lb.preventAutoSearchOnce) {
					lb.preventAutoSearchOnce = false;
					return;
				}

				if (event.keyCode === 27) {
					return;
				}
			
				if (search.val() !== "") {
					$("#performSearch").show();
					$("#resetSearch").show();
				} else {
					$("#performSearch").hide();
					$("#resetSearch").hide();
				}
	
				//console.log(lb.oldSearchValue);
				if ($.trim(search.val()) !== $.trim(lb.oldSearchValue) || forced) {

					//console.log("Old: " + lb.oldSearchValue);
					//console.log("Forced: " + forced);
					
					lb.oldSearchValue = search.val();
					if (search.val() === "") {
						lb.closeSearchResults();
						return;
					}

					self.timer && clearTimeout(self.timer);
					if ($(window).width() >= 768) {
						self.timer = setTimeout(function() {
							//console.log("keyup click change performSearch");
							self.performSearch()
						}, 300);
					} else {
						self.timer = setTimeout(function() {
							//console.log("keyup click change performSearch");
							self.performSearch()
						}, 900);
						
					}
				}
			});

			search.bind("focus", function(event) {

				//console.log("focus");
			
				lb.searchHasFocus = true;

				if (search.val() !== "") {
					$("#performSearch").show();
					$("#resetSearch").show();
				} else {
					$("#performSearch").hide();
					$("#resetSearch").hide();
				}
			
				if ($.trim(search.val()) === "" && !lb.preventAutoSearchOnce) {
					//console.log("search focus closeSearchResults")
					lb.closeSearchResults();
				} else if (!lb.preventAutoSearchOnce) {
					//console.log("search focus openSearchResults performSearch");
					//lb.openSearchResults();
					//lb.performSearch();
				} else if (lb.preventAutoSearchOnce) {
					//console.log("focus reset prevent");
					lb.preventAutoSearchOnce = false;
					lb.closeSearchResults();
				}
				event.stopPropagation();
			
			});

			search.bind("blur", function(event) {
				lb.searchHasFocus = false;
			});
		
			$("#closeSearchResults").click(lb.closeSearchResults);
			$(".searchTitleBar").click(lb.closeSearchResults);
		
		},
		openSearchResults : function() {
			$("#searchResultsNavigation").addClass("visible-phone").removeClass("hidden");
			if ($(window).width() >= 768) {
				$("#searchMask").show();
			}
			$("#searchResults").show();
			lb.isSearchResultsOpen = true;
		},
		closeSearchResults: function() {

			if (lb.isSearchResultsOpen) {
				$("#searchResultsNavigation").removeClass("visible-phone").addClass("hidden");
				$("#searchMask").hide();
				$("#searchResults").hide();
				//if ($(window).width() >= 768) {
					//lb.preventAutoSearchOnce = true;
					//$("#search").focus();
					//}

				document.body.className = document.body.className;

				lb.isSearchResultsOpen = false;

				var state = lb.getState();
				History.pushState(state, "Läkemedelsboken", state.toString());
			}
		},
		performSearch: function() {

			//console.log(lb.preventAutoSearchOnce);

			var search = $("#search");
			var searchValue = $.trim(search.val());

			if (searchValue !== "") {
				/*
				//Show search results
				$("#medicineSearchResults").show();
				$("#titleSearchResults").show();
				$("#contentSearchResults").show();
				*/
				if (lb.medicineSearch !== null) {
					lb.medicineSearch.abort();
				}
				if (lb.contentSearch !== null) {
					lb.contentSearch.abort();
				}

				//if (lb.titleSearch !== null) {
				//	lb.titleSearch.abort();
				//}

				var list = $("#medicineSearchResultsList");
				list.empty();
				list.append($("<li><a href=\"#\"><i class=\"icon-refresh icon-spin\"></i> Söker efter \"" + searchValue + "\"...</a></li>"));
				list.menu("refresh");

				/*
				list = $("#titleSearchResultsList");
				list.empty();
				list.append($("<li><a href=\"#\"><i class=\"icon-refresh icon-spin\"></i> Söker efter \"" + searchValue + "\"...</a></li>"));
				list.menu("refresh");
				*/
				
				list = $("#contentSearchResultsList");
				list.empty();
				list.append($("<li><a href=\"#\"><i class=\"icon-refresh icon-spin\"></i> Söker efter \"" + searchValue + "\"...</a></li>"));
				list.menu("refresh");

				//console.log("performSearch openSearchResults");
				lb.openSearchResults();

				//Set history
				var state = lb.getState();
				History.replaceState(state, "Sök: " + searchValue + " | Läkemedelsboken", state.toString());

				/*
				lb.titleSearch = $.getJSON("/titlesearch?search=" + encodeURIComponent(searchValue), function(results) {

					lb.titleSearch = null;
					if ($.trim(search.val()) === searchValue) {
						var resultsList = $("#titleSearchResultsList");
						resultsList.empty();
						for (var i=0; i < results.length; i++) {
							var titleItem = results[i];
							var titlePath = titleItem.titlePath;
							if (titlePath.indexOf(" && ") > -1) {
								titlePath = titlePath.split(" && ");
								titlePath.pop();
								titlePath = titlePath.join(" &#187; ");
							}
						
							resultsList.append($("<li><a class=\"searchResult\" href=\"/" + titleItem.chapter + "#" + titleItem.id + "\"><i class=\"icon " + lb.getIcon(titleItem.type) + "\"></i> <strong>" + titleItem.title + "</strong><br><small>" + titlePath + "</small></a></li>")); 
						}
						if (results.length === 0) {
							//$("#titleSearchResults").hide();
							resultsList.append($("<li><a href=\"#\"><i class=\"icon icon-ban-circle\"></i> Inga träffar</a></li>"));
						}
						resultsList.menu("refresh");

						ga('send', 'event', 'search', searchValue, {'nonInteraction': 1});
						
					}
				}).error(function(jqXHR, status, error) {
					lb.titleSearch = null;
					if (search.val() !== "") {
						var resultsList = $("#titleSearchResultsList");
						resultsList.empty();
						resultsList.append($("<li><a href=\"#\"><i class=\"icon icon-info-sign\"></i> Sökningen misslyckades<br><small>Var god försök igen lite senare</small></a></li>"));
						resultsList.menu("refresh");
					}
				});
				*/
				lb.medicineSearch = $.getJSON("/medicinesearch?search=" + encodeURIComponent(searchValue), function(results) {
					lb.medicineSearch = null;
					if ($.trim(search.val()) === searchValue) {
						var resultsList = $("#medicineSearchResultsList");
						resultsList.empty();
						for (var i=0; i < results.length; i++) {
							var item = results[i];
							if (item.type === "atc") {
								resultsList.append($("<li id=\"searchResults_" + item.id + "\"><a href=\"/atc/" + item.id + "\" class=\"atcCodeInPopover searchResult\" data-indentation=\"0\" data-atcid=\"" + item.id + "\" data-atctitles=\"" + item.titlePath.replace(/\s\/\s/g, "--").replace(/\s/g, "_") + "\"><i class=\"icon icon-plus-sign-alt\"></i> <strong>" + item.title_HL + "</strong><br><small>" + item.titlePath_HL + "</small></a></li>")); 
							} else if (item.type === "product") {
								//Add images
								var images = "";
								if (item.images !== undefined) {
									for (var x=0; x < item.images.length; x++) {
										images += "<img src=\"" + item.images[x] + "\" class=\"img-polaroid pull-right\" style=\"width: 30px; height: 30px; margin-right: 5px;\" />";
									}
								}
								var title = (item.title_HL !== undefined) ? item.title_HL : item.title;
								if (title.indexOf(", ") > -1) {
									title = title.split(", ");
									title[0] = "<strong>" + title[0] + "</strong>";
									if (title.length >= 3) {

										title[title.length - 1] = "<em>" + title[title.length - 1] + "</em>";

									}
									if (item.parallelimport !== undefined && item.parallelimport !== "") {
										title[title.length - 1] = title[title.length - 1] + " (Parallellimport " + item.parallelimport + ")";
									}
									title = title.join(" <br>");
								}

								var titlePath = (item.titlePath_HL !== undefined) ? item.titlePath_HL : item.titlePath;
								
								resultsList.append($("<li" + (item.noinfo === true ? " class=\"ui-state-disabled\"" : "") + "><a href=\"/product/" + item.id + "\" class=\"inlineProduct searchResult\" data-product-id=\"" + item.id + "\">" + images + title + "<br><small>" + titlePath + "</small></a></li>")); 
							}
						}
					
						if (results.length === 0) {
							//$("#medicineSearchResults").hide();
							resultsList.append($("<li><a href=\"#\"><i class=\"icon icon-ban-circle\"></i> Inga träffar</a></li>"));
						}
						resultsList.menu("refresh");
						
					}
				}).error(function(jqXHR, status, error) {
					lb.medicineSearch = null;
					if (search.val() !== "") {
						var resultsList = $("#medicineSearchResultsList");
						resultsList.empty();
						resultsList.append($("<li><a href=\"#\"><i class=\"icon icon-info-sign\"></i> Sökningen misslyckades<br><small>Var god försök igen lite senare</small></a></li>"));
						resultsList.menu("refresh");
					}
				});

				lb.contentSearch = $.getJSON("/contentsearch?search=" + encodeURIComponent(searchValue), function(results) {
					lb.contentSearch = null;
					if ($.trim(search.val()) === searchValue) {
						var resultsList = $("#contentSearchResultsList");
						resultsList.empty();
						for (var i=0; i < results.length; i++) {
							var contentItem = results[i];
							var titlePath = (contentItem.titlePath_HL !== undefined) ? contentItem.titlePath_HL : contentItem.titlePath;
							if (titlePath.indexOf(" && ") > -1) {
								titlePath = titlePath.split(" && ");
								titlePath.pop();
								titlePath = titlePath.join(" &#187; ");
							}
							var title = (contentItem.title_HL !== undefined) ? contentItem.title_HL : contentItem.title;
							
							resultsList.append($("<li><a class=\"searchResult\" href=\"/" + contentItem.chapter + "?id=" + contentItem.id + "#" + contentItem.id + "\"><i class=\"icon " + lb.getIcon(contentItem.type) + "\"></i> <strong>" + title + "</strong><br><small>" + titlePath + "</small><div>" + contentItem.content_HL + "</div></a></li>")); 
						}
						if (results.length === 0) {
							//$("#contentSearchResults").hide();
							resultsList.append($("<li><a href=\"#\"><i class=\"icon icon-ban-circle\"></i> Inga träffar</a></li>"));
						}
						resultsList.menu("refresh");
						ga('send', 'pageview', {'page': '/search?' + searchValue, 'title': 'Sökning: ' + searchValue + ' | Läkemedelsboken'});
						ga('send', 'event', 'search', searchValue, {'nonInteraction': 0});
					}
				}).error(function(jqXHR, status, error) {
					lb.contentSearch = null;
					if (search.val() !== "") {
						var resultsList = $("#contentSearchResultsList");
						resultsList.empty();
						resultsList.append($("<li><a href=\"#\"><i class=\"icon icon-info-sign\"></i> Sökningen misslyckades<br><small>Var god försök igen lite senare</small></a></li>"));
						resultsList.menu("refresh");
					}
				});

			}
		
		},
		handleAtcCodeInPopover: function(event) {
			event.preventDefault();
			event.stopPropagation();

			var currentAnchor = $(this);
			
			if (currentAnchor.attr("data-already-loaded") !== undefined) {
				//Close sub menu

				var id = currentAnchor.parent().attr("id");
				var parentMenu = $("#" + id).parents("ul.ui-menu");

				var indentationLevel = parseInt(currentAnchor.attr("data-indentation"));
				
				//Find proceeding items with higher indentation level and remove
				var children = currentAnchor.parent().nextAll().each(function(index, element) {
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
				currentAnchor.find("i.icon-minus-sign-alt").removeClass("icon-minus-sign-alt").addClass("icon-plus-sign-alt");

				parentMenu.menu("refresh");
				
				parentMenu.menu("focus", null, currentAnchor.parent());
				
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
				var parentMenu = $("#" + id).parents("ul.ui-menu");

				//Display loading indicator
				currentAnchor.find("i.icon-plus-sign-alt").removeClass("icon-plus-sign-alt").addClass("icon-refresh");
				currentListItem = currentAnchor.parent();

				var indentationLevel = parseInt(currentAnchor.attr("data-indentation"));
				var indentationPixels = ((indentationLevel + 1) * 25) + "px"; 

				//Fetch info
				lb.getATCItems(atcCode, function(err, results) {
					currentAnchor.find("i.icon-refresh").removeClass("icon-refresh").addClass("icon-minus-sign-alt");
					if (err) {
						currentAnchor.find("i.icon-minus-sign-alt").removeClass("icon-minus-sign-alt").addClass("icon-info-sign");
						var oldText = currentAnchor.text();
						currentAnchor.find("strong").text("Kunde inte hämta information för \"" + oldText + "\"");
					
						parentMenu.menu("refresh");
					} else {
						var content = "";
						for (var i = 0; i < results.data.length; i++) {

							var item = results.data[i];
							if (item.hasChildren) {
								content += "<li id=\"" + tipId + "_" + item.id + "\"><a href=\"/atc/" + item.id + "\" data-indentation=\"" + (indentationLevel + 1) + "\" class=\"atcCodeInPopover\" style=\"padding-left: " + indentationPixels + ";\"><i class=\"icon icon-plus-sign-alt\"></i><i class=\"icon icon-angle-down pull-right\"></i> <strong>" + item.text + "</strong></a></li>";
							} else if (item.children && item.children.length > 0) {
								//content += "<li><a style=\"padding-left: " + indentationPixels + ";\"><strong>" + item.text + "</strong></a></li>";
							
								for (var j = 0; j < item.children.length; j++) {
									var productItem = item.children[j];
								
									var images = "";
									if (productItem.images) {
										for (var x=0; x < productItem.images.length; x++) {
											images += "<img src=\"" + productItem.images[x] + "\" class=\"img-polaroid pull-right\" style=\"width: 15px; height: 15px; margin-right: 5px;\" />";
										}
									}
								
									var productInfo = productItem.text.split(",");
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
									content += "<li" + (productItem.noinfo === true ? " class=\"ui-state-disabled\"" : "") + "><a href=\"/product/" + productItem.id + "\" data-product-id=\"" + productItem.id + "\" class=\"inlineProduct\" data-indentation=\"" + (indentationLevel + 1) + "\" style=\"padding-left: " + (parseInt(indentationPixels) + extraIndent) + "px;\">" + images + productInfo + "</a></li>";
								}
							
							
							} else {
								//console.log(item);
							}
						}
						if (content !== "") {
							currentListItem.after(content);
						} else {
							currentListItem.after("<li><a style=\"padding-left: " + indentationPixels + ";\"><i class=\"icon icon-info-sign\"></i> Det finns inga underliggande preparat</a></li>");
						}
						parentMenu.menu("refresh");
					
						parentMenu.menu("focus", null, currentListItem);
					}
				});

			}
			
		},
		handleGenericas: function(event) {
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

				$(this).clickover({
					placement: popoverPlacement,
					content: content, 
					animation: true,
					title: title,
					width: $("#mainContainer").width() + "px",
					html: true,
					allow_multiple: true,
					tip_id: tipId,
					esc_close: 0,
					onShown: function() {
						var completionCounter = 0;
						for (var i=0; i < atcCodes.length; i++) {
							var atcCode = atcCodes[i];
							/*
							$("ul." + atcCode).treeview({
								url: "/atctree",
								root: atcCode,
								collapsed: true
							});
							*/
							$("ul." + atcCode).menu();
							lb.getATCItems(atcCode, function(err, results) {
								var currentATCMenu = $("ul." + results.atcCode);
								currentATCMenu.find(".loading").remove();
								if (err) {
									currentATCMenu.append("<li><a href=\"#\"><i class=\"icon icon-info-sign\"></i> Kunde inte hitta rubriker</a></li>");
									currentATCMenu.menu("refresh");
								} else {
									for (var i = 0; i < results.data.length; i++) {

										var item = results.data[i];
										if (item.hasChildren) {
											currentATCMenu.append("<li id=\"" + tipId + "_" + item.id + "\"><a href=\"/atc/" + item.id + "\" data-indentation=\"0\" class=\"atcCodeInPopover\"><i class=\"icon icon-plus-sign-alt\"></i><i class=\"icon icon-angle-down pull-right\"></i> <strong>" + item.text + "</strong></a></li>");
										} else if (item.children && item.children.length > 0) {
											for (var j = 0; j < item.children.length; j++) {
												var productItem = item.children[j];
												var images = "";
												if (productItem.images) {
													for (var x=0; x < productItem.images.length; x++) {
														images += "<img src=\"" + productItem.images[x] + "\" class=\"img-polaroid pull-right\" style=\"width: 15px; height: 15px; margin-right: 5px;\" />";
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
												
												currentATCMenu.append("<li" + (productItem.noinfo === true ? " class=\"ui-state-disabled\"" : "") + "><a href=\"/product/" + productItem.id + "\" data-product-id=\"" + productItem.id + "\" class=\"inlineProduct\" " + ((extraIndent > 0) ? " style=\"padding-left: " + extraIndent + "px;\"" : "") + ">" + images + productInfo + "</a></li>");
											}
										} else {
											//console.log(item);
										}

									}
									
									if (results.data.length === 0) {
										
										$("h6." + results.atcCode).remove();
										currentATCMenu.remove();
									} else {
										currentATCMenu.menu("refresh");
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
		
		},
		getATCItems: function(parentId, callback) {
			var out = {atcCode: parentId};
			$.getJSON("/atctree?parentid=" + encodeURIComponent(parentId), function(results) {
				out.data = results;
				callback(null, out);
			}).error(function(jqXHR, status, error) {
				callback("Kunde inte hitta rubriker", out);
			});
		},
		handleBoxSearch: function(event) {
			var name = $(this).attr("data-productname");

			var popoverPlacement = "bottom";
			var content = "";
			var className = name.replace(/[^a-zA-Z0-9-]/g, '_')

			content += "<h6 class=\"" + className + "\">" + name + "</h6><ul class=\"" + className + " nav nav-tabs nav-stacked\"><li class=\"loading\"><a href=\"#\"><i class=\"icon-refresh icon-spin\"></i> Hämtar informationsrutor...</a></ul>";
		
			var title = "Informationsrutor";

			title += '<button type="button" class="close" data-dismiss="clickover">&times;</button>'

			lb.tipCounter++;
			var tipId = "tip_" + lb.tipCounter;

			$(this).clickover({
				placement: popoverPlacement,
				content: content, 
				animation: true,
				title: title,
				width: ($("#medDisplay").width() - 10) + "px",
				html: true,
				allow_multiple: true,
				tip_id: tipId,
				esc_close: 0,
				parentElement: $("#medDisplay"),
				class_name: "clickover boxSearchPopover",
				onShown: function() {
					var currentTherapyMenu = $("ul." + className);
					
					currentTherapyMenu.on("click", "a.searchResult", function(event) {

						event.preventDefault();
						lb.closeSearchResults();
						lb.closeMedicineWindow();

						var anchor = $(this);
						var chapter = anchor.attr("href").split("#")[0];
						var id = anchor.attr("href").split("#")[1];

						var currentChapter = lb.currentChapter;
				
						if (currentChapter === "") {
							currentChapter = window.location.href;
						}
				
						if (currentChapter.indexOf(chapter) > -1) {
							if (lb.isMobile.any()) {
								search.blur();
							}

							var scrollItem = $("#" + id);
							if (scrollItem.length === 1) {
								scrollItem.ScrollTo();
							} else {
								$("body").animate({ scrollTop: 0 }, "fast");
							}
					
							lb.closeSearchResults();
							//Set history
							var state = lb.getState(id);
							History.pushState(state, null, state.toString());
						} else {
							var state = lb.getState(id);
							History.pushState(state, null, chapter + state.toString());

							//Inject
							lb.openPage(chapter, id);
						}
						
					});
					
					currentTherapyMenu.menu();
					
					var searchName = name;
					if (searchName.indexOf(" ") > -1) {
						searchName = searchName.split(" ")[0];
					}
					
					$.getJSON("/boxsearch?search=" + encodeURIComponent(searchName), function(results) {
						currentTherapyMenu.find(".loading").remove();
						if (results.length === 0) {
							currentTherapyMenu.append("<li><a href=\"#\"><i class=\"icon icon-info-sign\"></i> Preparatet nämns inte i några informationsrutor</a></li>");
							currentTherapyMenu.menu("refresh");
						} else {
							for (var i = 0; i < results.length; i++) {

								var item = results[i];

								var titlePath = (item.titlePath_HL !== undefined) ? item.titlePath_HL : item.titlePath;
								if (titlePath.indexOf(" && ") > -1) {
									titlePath = titlePath.split(" && ");
									titlePath.pop();
									titlePath = titlePath.join(" &#187; ");
								}

								var title = (item.title_HL !== undefined) ? item.title_HL : item.title;
							
								currentTherapyMenu.append($("<li><a class=\"searchResult\" href=\"/" + item.chapter + "#" + item.id + "\"><i class=\"icon " + lb.getIcon(item.type) + "\"></i> <strong>" + title + "</strong><br><small>" + titlePath + "</small><div>" + item.content_HL + "</div></a></li>")); 

								//currentTherapyMenu.append("<li><a href=\"/" + item.chapter + "?id=" + item.id + "\"><strong>" + item.title_HL + "</strong><br><small>" + titlePath_HL + "</small></a></li>");
							}

							currentTherapyMenu.menu("refresh");

						}
					}).error(function(jqXHR, status, error) {

						currentTherapyMenu.empty();
						currentTherapyMenu.append($("<li><a href=\"#\"><i class=\"icon icon-info-sign\"></i> Sökningen misslyckades<br><small>Var god försök igen lite senare</small></a></li>"));
						currentTherapyMenu.menu("refresh");
					});
				
				}
			});

			var that = this;

			setTimeout(function() {
				$(that).click();
			}, 10);

			event.preventDefault();
		
		},
		
		openMedicineWindow: function() {

			lb.isMedicineWindowOpen = true;

			$("#mask").fadeTo(0,0.8);
			if ($(window).width() < 768) {
				$("#modalMed").css("top", $(window).scrollTop() + "px")
			}
		
			$("#modalMed").show();
	
		},
		closeMedicineWindow: function() {

			if (lb.isMedicineWindowOpen) {
				$("#modalMed").hide();
				$("#mask").hide();
				if (lb.isSearchResultsOpen) {
					$("#medicineSearchResultsList").focus();
				}
				lb.isMedicineWindowOpen = false;
				var state = lb.getState();
				History.pushState(state, "Läkemedelsboken", state.toString());
			}
		},
		handleProduct: function(event, forcedNplId) {

			var nplId = null;
		
			if (forcedNplId) {
				nplId = forcedNplId;
				lb.nplId = nplId;
			
			} else if (event) {
				event.preventDefault();
			    nplId = $(this).attr("data-product-id");
				lb.nplId = nplId;
			}
		
			var list = $("#medList");
			var body = $("#medDisplay");
			var categoryTitle = $("#modalMedTitle");
			categoryTitle.html("<i class=\"icon-refresh icon-spin\"></i> Hämtar produktinformation...</a>");
		
			$("#medListToggler").html("<i class=\"icon-refresh icon-spin\"></i> Hämtar...");
			$("#medListToggler").attr("data-open", "false");
			
			body.empty();
			body.html("<div class=\"hero-unit\"><h5><i class=\"icon-refresh icon-spin\"></i> Hämtar produktinformation...</h5></div>");
			list.empty();
			list.append("<li><a href=\"#\"><i class=\"icon-refresh icon-spin\"></i> Hämtar lista...</a></li>");
			list.menu("refresh");

			lb.openMedicineWindow();

			$.getJSON("/medlist?id=" + nplId, function(medList) {

				list.empty();

				if (medList.length > 0) {
					var products = [];
					var noinfoProducts = [];
					for (var i=0; i < medList.length; i++) {
						var item = medList[i];

						if (item.type === "product") {
							if (item.noinfo === true) {
								noinfoProducts.push(item);
							} else {
								products.push(item);
							}
						} else {
							categoryTitle.html("<i class=\"icon-info-sign\"></i> " + item.title + "</a>");
						}
					}

					products.sort(function(a,b){
						if(a.title < b.title) return -1;
						if(a.title > b.title) return 1;
						return 0;
					});

					noinfoProducts.sort(function(a,b){
						if(a.title < b.title) return -1;
						if(a.title > b.title) return 1;
						return 0;
					});

					for (var j=0; j < products.length; j++) {
						var product = products[j];
						var images = "";
						//Add images
						if (product.images !== undefined) {
							images = "";
							for (var x=0; x < product.images.length; x++) {
								images += "<img src=\"" + product.images[x] + "\" class=\"img-polaroid pull-right\" style=\"width: 30px; height: 30px; margin-right: 5px;\" />";
							}
						}
						var title = product.title;
						if (title.indexOf(", ") > -1) {
							title = title.split(", ");
							title[0] = "<strong>" + title[0] + "</strong>";
							if (title.length >= 3) {
								title[title.length - 1] = "<em>" + title[title.length - 1] + "</em>";
							}
							if (product.parallelimport !== undefined && product.parallelimport !== "") {
								title[title.length - 1] = title[title.length - 1] + " (Parallellimport " + product.parallelimport + ")";
							}
							
							title = title.join(" <br>");
						}
						list.append($("<li id=\"item_" + product.id + "\"" + (product.noinfo === true ? " class=\"ui-state-disabled\"" : "") + "><a class=\"inlineListProduct\" data-product-id=\"" + product.id + "\" href=\"/product/" + product.id + "\">" + images + title + "</a></li>"));
					}
					for (var j=0; j < noinfoProducts.length; j++) {
						var product = noinfoProducts[j];
						var images = "";
						//Add images
						if (product.images !== undefined) {
							images = "";
							for (var x=0; x < product.images.length; x++) {
								images += "<img src=\"" + product.images[x] + "\" class=\"img-polaroid pull-right\" style=\"width: 30px; height: 30px; margin-right: 5px;\" />";
							}
						}
						var title = product.title;
						if (title.indexOf(", ") > -1) {
							title = title.split(", ");
							title[0] = "<strong>" + title[0] + "</strong>";
							if (title.length >= 3) {
								title[title.length - 1] = "<em>" + title[title.length - 1] + "</em>";
							}
							if (product.parallelimport !== undefined && product.parallelimport !== "") {
								title[title.length - 1] = title[title.length - 1] + " (Parallellimport " + product.parallelimport + ")";
							}
							
							title = title.join(" <br>");
						}
						list.append($("<li id=\"item_" + product.id + "\"" + (product.noinfo === true ? " class=\"ui-state-disabled\"" : "") + "><a class=\"inlineListProduct\" data-product-id=\"" + product.id + "\" href=\"/product/" + product.id + "\">" + images + title + "</a></li>"));
					}

				}
				list.menu("refresh");

				if (products.length === 1) {
					$("#medListToggler").html("<i class=\"icon-info-sign\"></i> Det finns inga liknande preparat.");
				} else if (products.length > 1) {
					$("#medListToggler").html("<i class=\"icon-info-sign\"></i> Visa " + (products.length - 1) + " liknande preparat...");
				}
				
				setTimeout(function() {
					if ($(window).width() >= 768) {
						list.focus();
						var menuItem = $("#item_" + nplId);
						if (menuItem.length === 1) {
							list.attr("lastActive", "#item_" + nplId);
							list.menu("focus", null, menuItem);
						}
					} else {
						$("#medList").hide();
						$("#medListToggler").ScrollTo();
					}
				}, 500);

			});
		
			$.getJSON("/products/" + nplId + ".json", function(product) {

				if (product["noinfo"] !== undefined && product["noinfo"] === true) {
					//title.html("Ingen information")
					body.html("<div class=\"hero-unit\"><h5><i class=\"icon icon-info-sign\"></i> Det finns tyvärr ingen förskrivarinformation i Fass om detta läkemedel.</h5><h5><a href=\"http://www.fass.se/LIF/product?4&userType=0&nplId=" + nplId + "\" target=\"_blank\"><i class=\"icon-search\"></i> Visa preparat på Fass.se</a></h5</div>");
				} else {
					//title.html(product.name);
					lb.renderProductInfo(product, nplId, body, forcedNplId);

				}

			});
		
			body.animate({ scrollTop: 0 }, "fast");

		},
		updateProductWindow: function(event) {

			event.preventDefault();

			var nplId = $(this).attr("data-product-id");

			lb.nplId = nplId;
		
			var list = $("#medList");
			var body = $("#medDisplay");
			body.empty();
			body.html("<div class=\"hero-unit\"><h5><i class=\"icon-refresh icon-spin\"></i> Hämtar produktinformation...</h5></div>");


			setTimeout(function() {
				if ($(window).width() > 768) {
				
					//list.focus();
					var menuItem = $("#item_" + nplId);
					if (menuItem.length === 1) {
						list.menu("focus", null, menuItem);
					}
				
				} else {
					$("#close").ScrollTo();
				}
			}, 200);


			$.getJSON("/products/" + nplId + ".json", function(product) {

				if (product["noinfo"] !== undefined && product["noinfo"] === true) {
					body.html("<div class=\"hero-unit\"><h5><i class=\"icon icon-info-sign\"></i> Det finns tyvärr ingen förskrivarinformation i Fass om detta läkemedel.</h5><h5><a href=\"http://www.fass.se/LIF/product?4&userType=0&nplId=" + nplId + "\" target=\"_blank\"><i class=\"icon-search\"></i> Visa preparat på Fass.se</a></h5</div>");
				} else {
					lb.renderProductInfo(product, nplId, body);

				}
			});

			body.animate({ scrollTop: 0 }, "fast");

		},
		renderProductInfo: function(product, nplId, container, forcedNplId) {

			ga('send', 'pageview', {'page': '/product/' + nplId, 'title': product.name + ' | Läkemedelsboken'});
			ga('send', 'event', 'product', product.name, {'nonInteraction': 0});
			
			lb.nplId = nplId;
			if (!forcedNplId) {
				var state = lb.getState();
				History.pushState(state, product.name + " | Läkemedelsboken", state.toString());
			}
			lb.activeToggle = null;

			var body = container;
			body.empty();

			var medInfo = $("<div class=\"medInfo\" />");

			if (!product.provider || product.provider === "fass") {
				var fassImage = "<div data-picture data-alt=\"FASS.se\" class=\"fassImage\">";
				fassImage += "<div data-src=\"/img/fasslogo.png\"></div>";
				fassImage += "<div data-src=\"/img/fasslogo_x2.png\" data-media=\"(min-device-pixel-ratio: 2.0)\"></div>";
				fassImage += "<img src=\"/img/fasslogo.png\" />";
				fassImage += "</div>";

				medInfo.append($("<div class=\"pull-right\" style=\"width: 120px;\"><a href=\"http://www.fass.se/LIF/product?4&userType=0&nplId=" + nplId + "\" target=\"_blank\">" + fassImage + "</a></div>"));
			} else {
				var providerImage = "<div data-picture data-alt=\"" + product.provider + "\" class=\"providerImage\">";
				providerImage += "<div data-src=\"/img/" + product.provider.toLowerCase() + ".png\"></div>";
				providerImage += "<div data-src=\"/img/" + product.provider.toLowerCase() + "_x2.png\" data-media=\"(min-device-pixel-ratio: 2.0)\"></div>";
				providerImage += "<img src=\"/img/" + product.provider.toLowerCase() + ".png\" />";
				providerImage += "</div>";

				var providerLink = product.providerLink;
				
				if (providerLink !== undefined) {
					providerLink = providerLink.replace("{NPLID}", nplId);
					medInfo.append($("<div class=\"pull-right\" style=\"width: 120px;\"><a href=\"" + providerLink + "\" target=\"_blank\">" + providerImage + "</a></div>"));
				}
				
			}

			medInfo.append($("<h2>" + product.name + "</h2>"));

			if (product.images !== undefined) {
				var images = $("<div class=\"medImages\" />");
				for (var i=0; i < product.images.length; i++) {
					var imageSource = "/products/images/" + product.images[i].checksum + ".jpg";
					var image = $("<img class=\"img-polaroid medImage pull-right\" title=\"" + product.images[i].description + "\" src=\"" + imageSource + "\" />");
					if (imageSource.indexOf("undefined") === -1) {
						images.append(image);
					}
				}
				medInfo.append(images);
			}

			medInfo.append($("<h3>" + product.brand + ((product.parallelimport !== undefined && product.parallelimport !== "") ? " (Parallelimport " + product.parallelimport + ")" : "") + "</h3>"));

			if (product.available === "true") {
				medInfo.append($("<h4>" + product.description + "</h4>"));
			} else if (product.hasOwnProperty("available")) {
				medInfo.append($("<h4 class=\"not-available\">" + product.description + "</h4>"));
				medInfo.append($("<div class=\"alert alert-error\"><h4>Tillhandahålls ej</h4></div>"));
			}

			if (product.mechanism) {
				medInfo.append($("<h4>" + product.mechanism + "</h4>"));
			}

			medInfo.append($("<div style=\"clear: right;\"><a data-productName=\"" + product.name + "\" class=\"btn pull-right inlineBoxSearch\">Sök bland informationsrutor...</a></div>"));

			//Narcotic
			var narcotic = null;

			switch(product.narcoticClass) {
				case "1":
					narcotic = "Klass II: Substanser med högre beroendepotential och liten terapeutisk användning.";
					break;
				case "2":
					narcotic = "Klass IV/V.";
					break;
				case "3":
					narcotic = "Klass III: Beredning innehållande dessa är narkotika under vissa förutsättningar";
					break;
				case "4":
					narcotic = "Klass IV: Substanser med lägre beroendepotential och bred terapeutisk användning";
					break;
				case "5":
					narcotic = "Klass V: Narkotika enbart enligt svensk lag";
					break;
				default:
					break;
			}

			//Narkotikaklass 	
			//	- = Ospecificerad, 
			//	0 = Ej narkotikaklassad, 
			//	1 = II - Narkotika. Substanser med högre beroendepotential och liten terapeutisk användning, 
			//	2 = Narkotika förteckning IV/V, 
			//	3 = III - Narkotika. Beredning innehållande dessa är narkotika under vissa förutsättningar, 
			//	4 = IV - Narkotika. Substanser med lägre beroendepotential och bred terapeutisk användning, 
			//	5 = V - Narkotika enbart enligt svensk lag, 
			//	6 = I - Narkotika ej förekommande i läkemedel, 
			//	NA = Ej tillämplig
	
	
			if (narcotic !== null) {
				var narcImage = "<div data-picture data-alt=\"Narkotiskt preparat\" class=\"narcImage\">";
				narcImage += "<div data-src=\"/img/narcotic.png\"></div>";
				narcImage += "<div data-src=\"/img/narcotic_x2.png\" data-media=\"(min-device-pixel-ratio: 2.0)\"></div>";
				narcImage += "<img src=\"/img/narcotic.png\" />";
				narcImage += "</div>";

				var narcoticClassTextCaution = "Iakttag största försiktighet vid förskrivning av detta läkemedel.";
				var narcoticClassTextHabituation = "Beroendeframkallande medel.";

				if (product.narcoticClassTextCaution !== undefined) {
					narcoticClassTextCaution = product.narcoticClassTextCaution;
				}

				if (product.narcoticClassTextHabituation !== undefined) {
					narcoticClassTextHabituation = product.narcoticClassTextHabituation;
				}
			
				narcotic = narcoticClassTextCaution + "<br />" + narcoticClassTextHabituation;
				medInfo.append($("<div style=\"margin-bottom: 10px;\">" + narcImage + "<div style=\"margin-left: 30px;\">" + narcotic + "</div></div>"));
			}

			if (product.substance) {
				medInfo.append($("<div><strong>Aktiv substans:</strong> " + product.substance + "</div>"));
			}

			//medInfo.append($("<div><strong>ATC-kod:</strong> <a href=\"" + product.atcLink + "\" target=\"_new\">" + product.atcCode + "</a></div>"));
			medInfo.append($("<div><strong>ATC-kod:</strong> " + product.atcCode + "</div>"));

			if (product.spcLink && product.spcLink !== "") {
				var spcType = (product.spcLink.indexOf(".pdf") > -1) ? "pdf" : "word";
				var linkText = "Länk till extern produktresumé";
				if (spcType === "word") {
					linkText += " som Word-fil";
				} else if (spcType === "pdf") {
					linkText += " som PDF";
				}
				medInfo.append($("<div><strong>Produktresumé:</strong> <a target=\"_blank\" href=\"" + product.spcLink + "\">" + linkText + " <i class=\"icon icon-file-text-alt\"></i></a></div>"));
				
			}
	
			//Benefit
			var benefit = null;
			switch(parseInt(product.benefit)) {
				case 0:
					benefit = "Ingen förpackning har förmån";
					break;
				case 1:
					benefit = "Alla förpackningar har förmån";
					break;
				case 2:
					benefit = "Vissa förpackningar har förmån";
					break;
				case 3:
					benefit = "Förmån med begränsning";
					break;
				case 4:
					benefit = null;
					break;
				default:
					break;
			}

			if (benefit !== null) {
				medInfo.append($("<div><strong>Förmån:</strong> " + benefit + "</div>"));
			}

			//Presciption
			var prescription = null;
			switch(product.prescription) {
				case "-":
					prescription = "Ospecificerat";
					break;
				case "0":
					prescription = "Receptfritt";
					break;
				case "1":
					prescription = "Receptbelagt";
					break;
				case "2":
					prescription = "Inskränkt förskrivning";
					break;
				case "3":
					prescription = "Vissa förpackningar är receptbelagda";
					break;
				case "4":
					prescription = "Receptfritt från 2 års ålder";
					break;
				case "5":
					prescription = "Receptfritt från 12 års ålder";
					break;
				case "N":
					prescription = "Ej tillämplig";
					break;
				default:
					break;
			}

			if (prescription !== null) {
		
				if (product.specRecipe === "true") {
					prescription += " - <strong>" + product.specRecipeText + "</strong>";
				}
				medInfo.append($("<div><strong>Recept:</strong> " + prescription + "</div>"));
			}
			

			//Over the counter
			if (product.overTheCounter === "AD") {
				medInfo.append($("<div><strong>Försäljning:</strong> Läkemedlet kan utöver på apotek även köpas i dagligvaruhandeln.</div>"));
			}

			//LFF
			var lff = null;

			/*
			Vi uppmanar er att titta på värdena i nedanstående taggar som kommer med i svaret från webbtjänsten, dvs.:
			<is-part-of-fass>/<lff-insurance-member>
			1. True/True – Företaget deltar i Fass OCH i Läkemedelsförsäkringen
			2. True/False – Företaget deltar i Fass men INTE i Läkemedelsförsäkringen
			3. False/True – Företaget deltar INTE i Fass men i Läkemedelsförsäkringen – Informationen lämnas INTE med automatik. Det måste alltså läggas till en uppmaning om att söka information om läkemedlet omfattas av Läkemedelsförsäkringen eller ej, förslagsvis via t.ex. en länk: www.lakemedelsforsakringen.se
			4. False/False – Företaget deltar varken i Fass eller i Läkemedelsförsäkringen – Även här måste det ligga en uppmaning om att söka information om läkemedlet omfattas av Läkemedelsförsäkringen eller ej, förslagsvis via t.ex. en länk: www.lakemedelsforsakringen.se

			I fall 3 och 4 ignoreras alltså värdet för läkemedelsförsäkringen eftersom värdet för Fass medlemsskap är ”False”.
			Vi fortsätter att titta på detta men tills vidare måste alltså ni som användare av Fass webtjänst se till att korrekt information presenteras med hänvisning till ovanstående kombination av svar!
			*/

			if (product.partOfFass === "true") {
				if (product.lffInsurance === "true") {
					lff = "Läkemedlet omfattas av <a href=\"http://www.fass.se/LIF/produktfakta/fakta_lakare_artikel.jsp?articleID=18336\" target=\"_new\">Läkemedelsförsäkringen</a>";
				} else if (product.lffInsurance === "false") {
					lff = "Läkemedlet omfattas ej av <a href=\"http://www.fass.se/LIF/produktfakta/fakta_lakare_artikel.jsp?articleID=18336\" target=\"_new\">Läkemedelsförsäkringen</a>";
				}
			}

			if (product.partOfFass === "false") {
				lff = "Oklart om läkemedlet omfattas av <a href=\"http://www.fass.se/LIF/produktfakta/fakta_lakare_artikel.jsp?articleID=18336\" target=\"_new\">Läkemedelsförsäkringen</a>. Sök mer information på <a href=\"http://www.lakemedelsforsakringen.se/\" target=\"_new\">www.lakemedelsforsakringen.se</a>";
			}
	
			if (lff !== null) {
				medInfo.append($("<div><strong>Försäkring:</strong> " + lff + "</div>"));
			}

			if (product.license !== undefined) {
				
				var license = product.license;
				
				if (product.licenseLink && product.licenseLink !== "") {
					license = "<a href=\"" + product.licenseLink + "\" target=\"_blank\">" + license + "</a>";
				}

				medInfo.append($("<div><strong>" + license + "</strong></div>"));
			}


			body.append(medInfo);

			picturefill();
		
			/*
			var medHeadLines = $("<div class=\"accordion\" id=\"medHeadLines\"/>");
		
			for(headLine in product.sections) {
				var headLineId = headLine.replace(/\s/g, "_").replace(/å/ig, "a").replace(/ä/ig, "a").replace(/ö/ig, "o").replace(/,/ig, "")
				var content = product.sections[headLine];
				if (content !== "" && content !== "<p></p>") {
					medHeadLines.append($("<div class=\"accordion-group\"><div class=\"accordion-heading\"><a class=\"accordion-toggle\" data-toggle=\"collapse\" href=\"#" + headLineId + "\"><i class=\"icon icon-plus-sign-alt leftIcon\"></i><i class=\"icon icon-angle-down pull-right rightIcon\"></i> " + headLine + "</a></div><div id=\"" + headLineId + "\" class=\"accordion-body collapse\"><div class=\"accordion-inner\">" + content + "</div></div></div>"));
				}
			}
			*/
			//Toggle all
			body.append($("<div><a href=\"#\" id=\"toggleAllSections\" class=\"btn btn-primary btn-block\"><i class=\"icon icon-plus\"></i> <span>Öppna alla rubriker</span></a></div>"));

			var medHeadLines = $("<div id=\"medHeadLines\"/>");
		
			for(headLine in product.sections) {
				var headLineId = headLine.replace(/\s/g, "_").replace(/å/ig, "a").replace(/ä/ig, "a").replace(/ö/ig, "o").replace(/,/ig, "").replace(/\./ig, "");
				var content = product.sections[headLine];
				if (content !== "" && content !== "<p></p>") {
					medHeadLines.append($("<h4 class=\"section-header\"><a class=\"toggleSection\" href=\"#" + headLineId + "\"><i class=\"icon icon-plus-sign-alt leftIcon\"></i><i class=\"icon icon-angle-down pull-right rightIcon\"></i> " + headLine + "</a></h4><div id=\"" + headLineId + "\" class=\"section\">" + content + "</div>"));
				}
			}

			body.append(medHeadLines);
		
		},
		toggleAccordion: function(event) {

			event.preventDefault();
			
			if ($(this).text().indexOf("Öppna alla") > -1) {
				$(".section", "#medHeadLines").show();
				$("i.leftIcon", "#medHeadLines").removeClass("icon-plus-sign-alt").addClass("icon-minus-sign-alt");
				$("i.rightIcon", "#medHeadLines").removeClass("icon-angle-down").addClass("icon-angle-up");
				$(this).find(".icon").removeClass("icon-plus").addClass("icon-minus");
				$(this).find("span").text("Stäng alla rubriker");
			} else {
				$(".section", "#medHeadLines").hide();
				$("i.leftIcon", "#medHeadLines").removeClass("icon-minus-sign-alt").addClass("icon-plus-sign-alt");
				$("i.rightIcon", "#medHeadLines").removeClass("icon-angle-up").addClass("icon-angle-down");
				$(this).find(".icon").removeClass("icon-minus").addClass("icon-plus");
				$(this).find("span").text("Öppna alla rubriker");
			}
		},
		toggleSection: function(event) {
			event.preventDefault();
			
			var toggler = $(this);
			var section = $($(this).attr("href"));

			var isOpen = $(".leftIcon", toggler).first().hasClass("icon-minus-sign-alt");
			
			if (isOpen) {
				$("i.leftIcon", toggler).removeClass("icon-minus-sign-alt").addClass("icon-plus-sign-alt");
				$("i.rightIcon", toggler).removeClass("icon-angle-up").addClass("icon-angle-down");
				section.hide();
			} else {
				$("i.leftIcon", toggler).removeClass("icon-plus-sign-alt").addClass("icon-minus-sign-alt");
				$("i.rightIcon", toggler).removeClass("icon-angle-down").addClass("icon-angle-up");
				section.show();
			}
			
		},
		handleReferences: function(event) {
			if ($(this).attr("data-original-title") === undefined) {
				var popoverPlacement = "bottom";

				var title = ($(this).attr("data-referencenumber").indexOf(",") > -1) ? "Referenser" : "Referens";

				var references = [];

				if ($(this).attr("data-referencenumber").indexOf(",") > -1) {
					references = $(this).attr("data-referencenumber").split(",");
				} else {
					references.push($(this).attr("data-referencenumber"));
				}
	
				var content = "";
			
				for (var i=0; i < references.length; i++) {
					var referenceNumber = references[i];
					var reference = $("#reference_" + referenceNumber);
				
					if (reference.length === 1) {
						content += "<p class=\"popoverReference\"><strong>" + referenceNumber + ".</strong> " + reference.html() + "</p>";
					}
				}

				title += '<button type="button" class="close" data-dismiss="clickover">&times;</button>'
	
				$(this).clickover({
					placement: popoverPlacement,
					animation: true,
					html: true,
					content: content, 
					title: title,
					allow_multiple: true,
					width: $("#mainContainer").width() + "px"
				});

				var that = this;

				setTimeout(function() {
					$(that).click();
				}, 1);

			}
			event.preventDefault();
		},
		handleBoxLinks: function(event) {
			if ($(this).attr("data-original-title") === undefined) {
				var popoverPlacement = "bottom";

				var title = "Länkar";
				var type = "";
				var typeName = "";
			
				if ($(this).hasClass("factsLink")) {
					title = "Faktaruta";
					type = "facts";
					typeName = "Faktaruta";
				} else if ($(this).hasClass("figureLink")) {
					title = "Figur";
					type = "figure";
					typeName = "Figur";
				} else if ($(this).hasClass("tableLink")) {
					title = "Tabell";
					type = "table";
					typeName = "Tabell";
				} else if ($(this).hasClass("therapyLink")) {
					title = "Terapirekommendation";
					type = "therapy";
					typeName = "Terapirekommendation";
				}

				var references = [];

				if ($(this).attr("data-numbers").indexOf(",") > -1) {
					references = $(this).attr("data-numbers").split(",");
				} else {
					references.push($(this).attr("data-numbers"));
				}

				var content = "";
		
				for (var i=0; i < references.length; i++) {
					var referenceNumber = references[i];
					var reference = $("#" + type + "_" + referenceNumber);
			
					if (reference.length === 1) {
						var referenceContent = reference.html();
						content += "<h6><a class=\"btn btn-small btn-primary gotoBoxLink\" href=\"#" + type + "_" + referenceNumber + "\"> Gå till " + typeName + " " + referenceNumber + " <i class=\"icon icon-white icon-arrow-right\"></i></a></h6>" + ((type === "facts" || type === "table" || type === "therapy") ? "<table class=\"table table-bordered" + (type === "facts" ? " facts" : "") + "\">" : "<div class=\"well figure\">") + referenceContent + ((type === "facts" || type === "table" || type === "therapy") ? "</table>" : "</div>");
					}
				}

				title += '<button type="button" class="close" data-dismiss="clickover">&times;</button>'
				var boxWidth = $("#mainContainer").width();
				
				if (type === "facts") {
					if ($("#mainContainer").width() > 480) {
						boxWidth = 500;
					}
				}

				$(this).clickover({
					placement: popoverPlacement,
					animation: true,
					html: true,
					content: content, 
					title: title,
					allow_multiple: true,
					width: boxWidth
				});

				var that = this;

				setTimeout(function() {
					$(that).click();
				}, 1);

			}
			event.preventDefault();
			event.stopPropagation();

		},
		handlePageFootnoteItems: function(event) {
			if ($(this).attr("data-original-title") === undefined) {
				var popoverPlacement = "bottom";

				var pageFootnoteList = $($(this).attr("href"));
				var title = $.trim(pageFootnoteList.find("legend").first().text());
				pageFootnoteList.find("legend").remove();
				
				var content = "";

				if (pageFootnoteList.length > 0) {
					content = "<div class=\"pageFootnoteDisplay\">" +  pageFootnoteList.html() + "</div>";
				}

				title += '<button type="button" class="close" data-dismiss="clickover">&times;</button>'
	
				$(this).clickover({
					placement: popoverPlacement,
					animation: true,
					html: true,
					content: content, 
					title: title,
					allow_multiple: true,
					width: $("#mainContainer").width() + "px"
				});

				var that = this;

				setTimeout(function() {
					$(that).click();
				}, 1);

			}
			event.preventDefault();
		},
		isMobile: {
			Android: function() {
				return navigator.userAgent.match(/Android/i);
			},
			BlackBerry: function() {
				return navigator.userAgent.match(/BlackBerry/i);
			},
			iOS: function() {
				return navigator.userAgent.match(/iPhone|iPad|iPod/i);
			},
			Opera: function() {
				return navigator.userAgent.match(/Opera Mini/i);
			},
			Windows: function() {
				return navigator.userAgent.match(/IEMobile/i);
			},
			any: function() {
				return (lb.isMobile.Android() || lb.isMobile.BlackBerry() || lb.isMobile.iOS() || lb.isMobile.Opera() || lb.isMobile.Windows());
			}
		}
	};

	var History = window.History;

	History.Adapter.bind(window,'statechange',function(){
		var State = History.getState(); 
		//console.log("statechange", State.data, State.title, State.url);

		if (!State.data.isMedicineWindowOpen) {
			lb.closeMedicineWindow();
		} else {
			//Fix back in medicine window
			if (State.data.nplId !== null && State.data.nplId !== lb.nplId) {
				lb.handleProduct(null, State.data.nplId);
			}
		}

		if (!State.data.isSearchResultsOpen) {
			lb.closeSearchResults();
		}
	
		if (State.data.search !== $.trim($("#search").val())) {
			$("#search").val(State.data.search);
		}

	});

	lb.init();

})(window);
