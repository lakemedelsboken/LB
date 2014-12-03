/* JQuery suggest extension © Valtech.Se 2013, by Anders Elo <anders elo at valtech se>. */
(function ($) {

    var defaults = {
        done: function (suggested, type) { },
        fail: function (error) { },
        notfound: '&nbsp;',                 // not found message
        asClass: 'suggest',                 // list class
        visible: true,                     // visibility state
        animate: 300,                       // animation delay
        search: "query",                    // ajax search parameter
        query: {},                          // ajax query object 
        delay: 200,                         // time threshold
        chars: 0,                           // min characters
        urlen: "",                            // re
        wrap: '<div/>',                     // wrapper element    
        ci: true,                           // case insensitive
        lt: 'ul',                           // list type
        li: 'li'                            // list item
    };

    //Fix for IE8 Object.keys
    Object.keys = Object.keys || (function () {
        var hasOwnProperty = Object.prototype.hasOwnProperty,
        hasDontEnumBug = !{ toString: null}.propertyIsEnumerable("toString"),
        DontEnums = [
            'toString',
            'toLocaleString',
            'valueOf',
            'hasOwnProperty',
            'isPrototypeOf',
            'propertyIsEnumerable',
            'constructor'
        ],
        DontEnumsLength = DontEnums.length;

        return function (o) {
            if (typeof o != "object" && typeof o != "function" || o === null)
                throw new TypeError("Object.keys called on a non-object");

            var result = [];
            for (var name in o) {
                if (hasOwnProperty.call(o, name))
                    result.push(name);
            }

            if (hasDontEnumBug) {
                for (var i = 0; i < DontEnumsLength; i++) {
                    if (hasOwnProperty.call(o, DontEnums[i]))
                        result.push(DontEnums[i]);
                }
            }

            return result;
        };
    })();

    function ajaxQuery(query, o, render) {
        var cached = o.elem.data(o.source), key = query;

        /* check for cached data */
        //        if (cached) {
        //            for (var k in cached) {
        //                if (key.indexOf(k) === 0) {
        //                    renderFiltered(cached[k]);
        //                    return;
        //                }
        //            }
        //        }

        /* merge ajax query parameters */
        if (o.query) {
            var q = {};
            q[o.search] = query;
            query = $.extend({}, o.query, q);
        }

        $.ajax({
            url: o.source,
            data: query,
            method: o.method || 'get',
            dataType: o.type || 'json'
        }).done(function (data) {
            /* cache the data */
            //            var cache = {};
            //            cache[key] = data;
            //            if (cached) $.extend(cached, cache);
            //            else o.elem.data(o.source, cache);
            renderFiltered(data);
        }).fail(o.fail);

        function renderFiltered(data) {
            if (typeof o.filter === 'function')
                render(o, o.filter(key, data));
            else
                render(o, data);
        }

    }

    function performSearch(query, o) {
        if (typeof query === 'string' && o.ci) query = query.toLowerCase();

        if (o.timer) {
            clearInterval(o.timer);
            o.timer = null;
        }

        var doQuery = function (q, o, r) {
            if (o.filter)
                r(o, o.filter(q, o.source));
            else
                r(o, o.source);
        }

        doQuery = ajaxQuery;

        function queryData() { return doQuery(query, o, render) }

        o.timer = setTimeout(queryData, o.delay);
    }

    function render(o, data) {
        var elem = $(o.lt, o.elem);

        if (o.render) {
            try {
                o.render(elem, data);
            } catch (error) {
                if (o.fail) o.fail(error);
                else throw Error("Suggest render error: " + error);
            } finally {
                return;
            }
        }

        function renderList(list) {
            var h = '';
            var i = 0;
            var j;
            for (i; i < Object.keys(list).length; i++) {
                h += '<' + o.li + '>\n';
                h += '<' + o.lt + ' title="' + Object.keys(list)[i] + '">\n';
                j = 0;
                for (var j = 0; j < list[Object.keys(list)[i]].length; j++) {
                    h += '<' + o.li + '>';
                    h += list[Object.keys(list)[i]][j];
                    h += '</' + o.li + '>\n';
                }
                h += '</' + o.lt + '>\n';
                h += '</' + o.li + '>\n';
            }
            return h;
        }

        var content = '';
        for (var i = 0, l = data.length; i < l; i++) {

            if (typeof data[i] === 'object') {
                content += renderList(data[i]);
            }
            else {
                if (i === 0) {
                    content += '<' + o.li + '>\n';
                    content += '<' + o.lt + '>\n';
                }
                content += '<' + o.li + '>';
                content += data[i];
                content += '</' + o.li + '>\n';
                if (i === l - 1) {
                    content += '</' + o.lt + '>\n';
                    content += '</' + o.li + '>\n';
                }
            }
        }

        /* if empty insert not found */
        if (!content) {
            content += '<' + o.li + '>\n';
            content += '<' + o.lt + ' title="' + o.notfound + '">\n';
            content += '</' + o.lt + '>\n';
            content += '</' + o.li + '>\n';
        }

        elem.html(content);

        return this;
    }

    var updateQuery = function (suggested, type) {
        if (typeof (type) !== 'undefined') {
            if (type == "Produkter") {
                type = "product";
            }
            if (type == "Substanser") {
                type = "substance";
            }
            var qUri = updateQueryStringParameter("/LMF", "q", suggested.text());
            document.location = updateQueryStringParameter(qUri, "type", type);
        }
    };

    $.fn.suggest = function (options) {
        var o = $.extend({}, defaults, options),
          selector = [o.lt, o.li, '>', o.lt, o.li].join(' ');

        /* setup wrapper id */
        if (o.wrap.indexOf('id=') < 0) {
            var x = o.wrap.indexOf('>');

            if (x < 0) throw TypeError("Suggest wrapper error:", o.wrap);

            o.id = this.attr('id') + 'Suggest';

            o.wrap = o.wrap.substr(0, x - 1) + ' id="' + o.id + '" ' + o.wrap.substr(x, o.wrap.length);
        }

        /* wrap target element */
        this.wrap(o.wrap);

        /* wrapper element */
        o.elem = $('#' + o.id);

        $('<' + o.lt + ' class="' + o.asClass + '"></' + o.lt + '>\n').appendTo(o.elem);

        /* the list elements */
        o.listElem = $(o.lt, o.elem);

        /* todo: touch device events */
        o.elem.on('mousedown', selector, function (event) {
            var suggested = $(this),
            type = $(this).parent().attr('title');
            $('input', o.elem).val(suggested.text());
            if ($('.slmfQuickSearch .suggest:visible').length > 0) {
                updateQuery(suggested, type);
            }
            //o.done(suggested, type);
        }).on('keyup', 'input', function (event) {
            //            /* todo: actions on keys ? */
            var key = (event.keyCode ? event.keyCode : event.which);
            if (key === 13 || key === 10) { //Enter on computer and touch-device
                var suggested = $('.slmfQuickSearch .suggest:visible li.selected');
                var type = suggested.parent().attr('title');
                var inputValue = $('.slmfQuickSearch .quickSearchInput').val();
                
                if ($('.slmfQuickSearch .quickSearchInput').val() != $('.slmfQuickSearch .quickSearchInput').attr('default-text') && typeof (type) === 'undefined') {
                    document.location = updateQueryStringParameter("/LMF", "q", inputValue);
                }
                
                else if ($('.slmfQuickSearch .suggest:visible').length > 0) {
                    updateQuery(suggested, type);
                }

            } else if (key === 40) { //Down arrow
                if ($(".suggest:visible li > ul > li.selected").index() == $(".suggest:visible li > ul > li").length - 1) return;
                if ($(".suggest:visible li > ul > li.selected").length == 0) {
                    $(".suggest:visible li > ul > li").eq(0).addClass("selected");
                    $(this).val($(".suggest:visible li > ul > li.selected").text());
                }
                
                else if ($(".suggest:visible li:first-child > ul > li:last-child").hasClass("selected")) {
                    $(".suggest:visible li > ul > li.selected").removeClass("selected");
                    $(".suggest:visible li:nth-child(2) > ul > li:first-child").addClass("selected");
                }
                
                else {
                    $(".suggest:visible li > ul > li.selected").eq(0).removeClass("selected").next().addClass("selected");
                    $(this).val($(".suggest:visible li > ul > li.selected").text());
                }

            }
            
            else if (key === 38) { //Up arrow
                if ($(".suggest:visible li > ul > li.selected").length == 0) {
                    $(".suggest:visible li:nth-child(2) > ul > li:last-child").addClass("selected");
                }
                
                else if ($(".suggest:visible li:nth-child(2) > ul > li:first-child").hasClass("selected")) {
                    $(".suggest:visible li > ul > li.selected").removeClass("selected");
                    $(".suggest:visible li:first-child > ul > li:last-child").addClass("selected");
                }
                
                else {
                    $(".suggest:visible li > ul > li.selected").eq(0).removeClass("selected").prev().addClass("selected");
                    $(this).val($(".suggest:visible li > ul > li.selected").text());
                }
            }
            
            if (key !== 40 && key !== 38 && this.value.length >= o.chars) {
                performSearch(this.value, o);
                $('#' + o.id + ' .suggest').show();
            }
            
            else if (key === 40 || key === 38) {
                $('#' + o.id + ' .suggest').show();
            }
            
            else $('#' + o.id + ' .suggest').hide();

        }).on('click', 'input', function (event) {
            if (this.value.length >= o.chars) $('#' + o.id + ' .suggest').show(); //Do shiet
        }).on('blur', 'input', function (event) {
            $('#' + o.id + ' .suggest').hide();
        });

        return this;
    };
} (jQuery));