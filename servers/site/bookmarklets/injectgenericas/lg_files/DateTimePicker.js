function setDateTimePickerOptions(clientId, language) {
    var interval;
    var element = $(clientId);

    var options = {
        showMonthAfterYear: false,
        beforeShow: function() {
            if ($.browser.msie && parseInt($.browser.version, 10) < 7) { //workaround for smaller covering iframe in IE6
                interval = setInterval(function() { $('iframe.ui-datepicker-cover').css("width", "230px"); }, 100);
            }
        },
        onClose: function() {
            if ($.browser.msie && parseInt($.browser.version, 10) < 7) { //workaround for smaller covering iframe in IE6
                clearInterval(interval);
            }
        }
    };

    var localization = $.datepicker.regional[language];
    if (!localization) {
        localization = $.datepicker.regional[''];
    }

    $.extend(options, localization);
    element.datepicker(options);
}