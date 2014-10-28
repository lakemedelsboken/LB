#/bin/bash
#../servers/admin/static/js/jquery.treeview.min.js ../servers/admin/static/js/jquery.treeview.async.js ../servers/admin/static/js/touche.js ../servers/admin/static/js/jquery-1.8.3.js ../servers/admin/static/js/twitter-dev/bootstrap-collapse.js
cat ../servers/admin/static/js/jquery-1.11.1.js ../servers/admin/static/js/jquery.history.js ../servers/admin/static/js/twitter-dev/bootstrap-tooltip.js ../servers/admin/static/js/twitter-dev/bootstrap-popover.js ../servers/admin/static/js/clickover.js ../servers/admin/static/js/jquery.cookie.js ../servers/admin/static/js/jquery.hotkeys.js ../servers/admin/static/js/jquery-ui-1.10.2.custom.js ../servers/admin/static/js/jquery-scrollto.js ../servers/admin/static/js/jquery.animate-enhanced.js ../servers/admin/static/js/matchmedia.js ../servers/admin/static/js/respond.js ../servers/admin/static/js/picturefill.js ../servers/admin/static/js/anchor.js ../servers/admin/static/js/lb.js > scripts.js
#uglifyjs scripts.js -nc > ../servers/admin/static/js/scripts.min.js
uglifyjs scripts.js -nc > ../servers/site/static/js/scripts.min.js
#cp scripts.js ../servers/admin/static/js/scripts.min.js
#cp scripts.js ../servers/site/static/js/scripts.min.js
rm -f scripts.js