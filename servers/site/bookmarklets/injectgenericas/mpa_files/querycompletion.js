$(document).ready(function() { 
      if (typeof(queryCompletionSearchForms) == 'undefined' || queryCompletionSearchForms.length == 0) return;
      $.each(queryCompletionSearchForms, function(index, selectors) {
          $(selectors.textField)
            .autocomplete(
              queryCompletionUrl, 
              { 
                cacheLength:0,
                extraParams: { ilang: queryCompletionLanguage },
                delay: 200,
                selectFirst: false,
                dataType: 'jsonp',
                highlight: false,
                scroll: false,
                parse: function(data) {
                  return $.map(data, function(row) {
                    return {data: row};
                  });
                },
                formatItem: function(item) {
                  if (item) {
                      return item.suggestionHighlighted;
                  }
                  return;
                }
              }
            )
            .result(function(event, item) {
              location.href = queryCompletionSearchUrl + '?q=' + encodeURIComponent(item.suggestion);
            })
            ;
        });
});