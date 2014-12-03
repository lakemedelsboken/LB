/**
 * Replace  tablesorter/sort.js
 *          secureurls.js
 *          safemail.js
 */
jQuery.noConflict();
jQuery().ready( function() {                                
    //Sortera tabellen ([1, 0] säger sortera kolumn 1 stigande, exempel: 2,1 = sortera kolumn två fallande)
    jQuery(".tablesorter").tablesorter({
        //[$.cookie("columnClicked")
        sortList: [ [1,0] ],
        widgets: ['zebra'],
        headers: {            
    }
    });                            
});

function safemail(name, domain) {
	if(name != "undefined" && name != "domain"){
            domain = domain ? domain : 'lj.se';
            var displayed= name+'@'+domain;
            document.write('<a class=\"sifot\" href=\"mailto:' + name + '@' + domain + '\">' + displayed + '</a>');
	}
}

function fixSecureUrls(serverUrl) {
    jQuery(".ISI_MENU").each(function(index) {
        if(jQuery(this).attr('href').indexOf('/')==0 ||
            jQuery(this).attr('href').indexOf('infopage.')==0 ||
            jQuery(this).attr('href').indexOf('newsflow.')==0 ||
            jQuery(this).attr('href').indexOf('job.')==0 ||
            jQuery(this).attr('href').indexOf('education_calendar')==0 ||
            jQuery(this).attr('href').indexOf('index.')==0){
            jQuery(this).attr('href', serverUrl+jQuery(this).attr('href'));
        }
  });
}
