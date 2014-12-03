/* Author: d-bt

*/




$(document).ready(function(){

	var userAgent = navigator.userAgent.toLowerCase();
	var isiPhone = (userAgent.indexOf('iphone') != -1 || userAgent.indexOf('ipod') != -1) ? true : false;
	clickEvent = isiPhone ? 'tap' : 'click';

	/*$(document).click(function (e) {
		fire(e);
	});*/

	$('iframe').each(function() {
		var url = $(this).attr("src");
		$(this).attr("src",url+"?wmode=transparent")
	});
	
	$('.close-content').click(function() {
		$(this).parent().toggleClass('collapsed');
	});

    fixQuickMenu();

    $('.top').addClass('hidden');
    $.waypoints.settings.scrollThrottle = 30;
    $('#container').waypoint(function (event, direction) {
        $('.top').toggleClass('hidden', direction === "up");
        }, {
        offset: '-30%'
    }).find('#quickNavHolder').waypoint(function (event, direction) {
        $(this).parent().toggleClass('scrolled-header', direction === "down");
        event.stopPropagation();
    });

	$("#quickNav li.show-menu").click(function() {
	  $(this).parent().toggleClass("expanded");
	});
	
	var width = $(window).width();
	if (width < 720) {
		$("body").addClass("small-window");
		searchInp();
	}
	
	quickMenu();
	
	if ($("body").hasClass("small-window")){
		$('#carousel').elastislide({
		imageW 	: 200,
		margin	: 10,
		border	: 0,
		minItems: 1
		});
	}
	else {
		$('#carousel').elastislide({
		imageW 	: 200,
		margin	: 10,
		border	: 0,
		minItems: 4
		});
	}
	
	
	
	logoheight();
	$(window).bind("resize", resizeWindow);
	/*$("#expand-search").click(function(){
		$(this).addClass("expanded");
	});*/
	
	$("#expand-search").click(function() {
	  $(this).toggleClass("expanded");
	  logoheight();
	});
	
	$(".view-main-menu").click(function() {
	  $(this).toggleClass("expanded");
	});
	
	$(".struct-col-1 h2.beam").click(function() {
	  $(this).toggleClass("expanded");
	});

    var image_items = $('#slider li');
    if (image_items.length > 1) {
        $("#slider").easySlider({
            auto: true,
            continuous: true,
            pause: 8000,
            numeric: true
        });
    }

    sliderWidth();
    //$(window).bind('resize', resizeWindow);
    //resizeWindow2(null);

    if (jQuery.browser.mobile) {
        $(".mobile-view-container").show();
        //alert('You are using a mobile device!');
    }
});

function sliderWidth() {
    var sIl = $('.slider-wrapper').width();
    var sIlh = $('.slider-wrapper li').height();
    var sUl = $('.slider-wrapper ul li').size();
    $('#slider ul').css({ 'width': (sIl * sUl) + 'px' });
    $('#slider li').css({ 'width': sIl + 'px' });
    $('#slider').css({ 'width': sIl + 'px' });
}

function logoheight(){
	var logoheight = $(".logo img").height();
	var logotextheight = logoheight * .72581;
	var logooffset = logoheight - logotextheight;
	$("#expand-search").css({"height": logotextheight + "px", "line-height": logotextheight + "px", "margin-top": logooffset + "px"});
	$("#expand-search.expanded").css({"height": logotextheight + 12 + "px"});
	$(".normal-view").css({"margin-top": logooffset + "px"});
	$(".normal-view span").css({"height": logotextheight + "px", "line-height": logotextheight + "px"});
}

// perform JavaScript after the document is scriptable.
$(function() {
	// setup ul.tabs to work as tabs for each div directly under div.panes
	$("div.panes").addClass("tabs-ready");
	$("ul.tabs").addClass("tabs-ready");
	$("ul.tabs").tabs("div.panes > div");
});

function fixQuickMenu() {
    var quickNavWidth = $('#quickNav').width();
    var marginW = quickNavWidth * 0.0625;
    var liWidth = (quickNavWidth - marginW - (marginW / 4)) / 4;
    var headerW = $('#header').width();
    /*alert(quickNavWidth);
    alert(liWidth);
    alert(marginW);*/
    $('#quickNav li').css({ 'width': liWidth + 'px', 'margin-left': (marginW / 4) + 'px' });
}

$(document).ready(function(){
	$(".site-search").addClass("push-label");
});

$(document).ready(function(){
	$(".gen-link-list li:last-child").css('border-bottom','none');
});

$(document).ready(function(){
	highestCol();
});


function highestCol(){
	var highestCol = Math.max($('#eqCol1').height(),$('#eqCol2').height(),$('#eqCol3').height());
	var paneHeight = highestCol - 40;
	$('.row-col').height(highestCol);
	$('.tabbed-info .panes').height(paneHeight);
}

$(document).ready(function () {

    //Hide (Collapse) the toggle containers on load
    if ($(".toggle_container") != null)
        $(".toggle_container").hide();

    //Switch the "Open" and "Close" state per click then slide up/down (depending on open/close state)
    if ($("h4.trigger") != null) {
        $("h4.trigger").click(function () {
            $(this).toggleClass("active").next().slideToggle("slow");
        });
    }

});

function resizeWindow( e ) {
	logoheight();
	quickMenu();
	sliderWidth();
	fixQuickMenu();
}

function quickMenu() {
	var ulW = $(".quick-navigation ul").width();
	//alert(ulW);	
	var liW = ($(".quick-navigation ul li").width()) * 5;
	var margLi = (ulW - liW) / 4;
	//alert(margLi);
	$(".quick-navigation ul li").css({"margin-right": margLi + "px"});
	
}

function searchInp() {
	var siW = ($("#header").width()) - 56;
	$("#searchString").css({"width": siW + "px"});
	
	//$(".quick-navigation ul li").css({"margin-right": margLi + "px"});
	
}



$('[placeholder]').focus(function() {
  var input = $(this);
  if (input.val() == input.attr('placeholder')) {
    input.val('');
    input.removeClass('placeholder');
  }
}).blur(function() {
  var input = $(this);
  if (input.val() == '' || input.val() == input.attr('placeholder')) {
    input.addClass('placeholder');
    input.val(input.attr('placeholder'));
  }
}).blur().parents('form').submit(function() {
  $(this).find('[placeholder]').each(function() {
    var input = $(this);
    if (input.val() == input.attr('placeholder')) {
      input.val('');
    }
  })
});

/*function fire(e) { alert('hi'); }*/


function ValidateEService(ddlId, text) {
    var ddl = document.getElementById(ddlId);
    if (ddl.value != "-1") {
        if (ddl.value.startsWith("~/")) {
            window.location.href = window.location.href + ddl.value.substr(2);
        } else
            window.location.href = window.location.href + ddl.value;
    } else {
        alert(text);
    }
    return false;
}


if (typeof String.prototype.startsWith != 'function') {
    String.prototype.startsWith = function (str) {
        return this.indexOf(str) == 0;
    };
}

















