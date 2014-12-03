
function printit()
{  
	if (window.print) {
		window.print() ;  
	} else {
		var WebBrowser = '<object id="WebBrowser1" width="0" height="0" classid="CLSID:8856F961-340A-11D0-A96B-00C04FD705A2">';
	document.body.insertAdjacentHTML('beforeEnd', WebBrowser);
		WebBrowser1.ExecWB(6, 2); //Use a 1 vs. a 2 for a prompting dialog box    WebBrowser1.outerHTML = "";  
	}
}

function focusbuttonclick(e, ctrlID)
{	
	if ((e.which && e.which == 13) || (e.keyCode && e.keyCode == 13)) 
	{	
		if (document.getElementById)
		{	//Båda browsers hittar kontrollen men IE utför ej .click()...
			document.getElementById(ctrlID).click();
			//document.__aspnetForm.elements[ctrlID].click();
			return false;
		}
	} 
	else 
		return true;
}


function tooglelistpages() {

    $(".listtoggler").click(function() {
        var parent = $(this).parent().find('.arrow').first();
        if (parent.hasClass('arrowcontainerdown') == true) {
            parent.removeClass('arrowcontainerdown');
        }
        else {
            parent.addClass('arrowcontainerdown');
        }
        $(this).parent().find('.links').first().toggle();
        $(this).parent().find('.allchildren').first().toggle();
    });
}

function fixIeOrigin() {
    if (!window.location.origin) {
        window.location.origin = window.location.protocol + "//" + window.location.hostname + (window.location.port ? ':' + window.location.port : '');
    }
}

function updateQueryStringParameter(uri, key, value) {
    var re = new RegExp("([?|&])" + key + "=.*?(&|$)", "i");
    separator = uri.indexOf('?') !== -1 ? "&" : "?";
    if (uri.match(re)) {
        return uri.replace(re, '$1' + key + "=" + value + '$2');
    }
    else {
        return uri + separator + key + "=" + value;
    }
}

$(document).ready(function () {
    /*if javascript is turned of, display all, otherwise only display first level*/
    $('.allchildren').first().find('.allchildren').css('display', 'none');
    $('.allchildren').first().find('.links').css('display', 'none');
    $('.allchildren').first().find('.allchildren').find('.allchildren').css('display', 'none');
    $('.allchildren').first().find('.allchildren').find('.links').css('display', 'none');
    tooglelistpages();
    $('.cookieBar').cookieBar({ closeButton: '.closeBar' });

    $('#SearchAll').click(function () {
        fixIeOrigin();
        var url = updateQueryStringParameter(window.location.origin + window.location.pathname, "q", $('.search-query').val());
        url = updateQueryStringParameter(url, "filterNews", "0");
        document.location = url;
    });


    $('#SearchNews').click(function () {
        fixIeOrigin();
        var url = updateQueryStringParameter(window.location.origin + window.location.pathname, "q", $('.search-query').val());
        url = updateQueryStringParameter(url, "filterNews", "1");
        document.location = url;
    });
});
