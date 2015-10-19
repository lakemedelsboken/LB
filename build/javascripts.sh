#/bin/bash
#../servers/admin/static/js/jquery.treeview.min.js ../servers/admin/static/js/jquery.treeview.async.js ../servers/admin/static/js/touche.js ../servers/admin/static/js/jquery-1.8.3.js ../servers/admin/static/js/twitter-dev/bootstrap-collapse.js

#Old
#cat ../servers/admin/static/js/jquery-1.11.1.js ../servers/admin/static/js/jquery.history.js ../servers/admin/static/js/twitter-dev/bootstrap-tooltip.js ../servers/admin/static/js/twitter-dev/bootstrap-popover.js ../servers/admin/static/js/clickover.js ../servers/admin/static/js/jquery.cookie.js ../servers/admin/static/js/jquery.hotkeys.js ../servers/admin/static/js/jquery-ui-1.10.2.custom.js ../servers/admin/static/js/jquery-scrollto.js ../servers/admin/static/js/jquery.animate-enhanced.js ../servers/admin/static/js/matchmedia.js ../servers/admin/static/js/respond.js ../servers/admin/static/js/picturefill.js ../servers/admin/static/js/anchor.js ../servers/admin/static/js/lb.js > scripts.js

#cat ../servers/cms/output/static/js/uncompressed/jquery.js ../servers/cms/output/static/js/uncompressed/jquery.history.js ../servers/cms/output/static/js/uncompressed/twitter-dev/bootstrap-tooltip.js ../servers/cms/output/static/js/uncompressed/twitter-dev/bootstrap-popover.js ../servers/cms/output/static/js/uncompressed/clickover.js ../servers/cms/output/static/js/uncompressed/jquery.cookie.js ../servers/cms/output/static/js/uncompressed/jquery.hotkeys.js ../servers/cms/output/static/js/uncompressed/jquery-ui-1.10.2.custom.js ../servers/cms/output/static/js/uncompressed/jquery-scrollto.js ../servers/cms/output/static/js/uncompressed/jquery.animate-enhanced.js ../servers/cms/output/static/js/uncompressed/matchmedia.js ../servers/cms/output/static/js/uncompressed/respond.js ../servers/cms/output/static/js/uncompressed/picturefill.js ../servers/cms/output/static/js/uncompressed/anchor.js ../servers/cms/output/static/js/uncompressed/lb.js > newscripts.js

#cat ../servers/cms/output/static/js/app/uncompressed/jquery.js ../servers/cms/output/static/js/app/uncompressed/lb.js > newscripts.js
#../servers/cms/output/static/js/uncompressed/fingerprint.js

#uglifyjs scripts.js -nc > ../servers/admin/static/js/scripts.min.js

#Old
#uglifyjs scripts.js -nc > ../servers/site/static/js/scripts.min.js

#uglifyjs newscripts.js -m -c > ../servers/cms/output/static/js/scripts.min.js
uglifyjs ../servers/cms/output/static/js/uncompressed/jquery.js ../servers/cms/output/static/js/uncompressed/jquery.history.js ../servers/cms/output/static/js/uncompressed/twitter-dev/bootstrap-tooltip.js ../servers/cms/output/static/js/uncompressed/twitter-dev/bootstrap-popover.js ../servers/cms/output/static/js/uncompressed/clickover.js ../servers/cms/output/static/js/uncompressed/jquery.cookie.js ../servers/cms/output/static/js/uncompressed/jquery.hotkeys.js ../servers/cms/output/static/js/uncompressed/jquery-ui-1.10.2.custom.js ../servers/cms/output/static/js/uncompressed/jquery-scrollto.js ../servers/cms/output/static/js/uncompressed/jquery.animate-enhanced.js ../servers/cms/output/static/js/uncompressed/matchmedia.js ../servers/cms/output/static/js/uncompressed/respond.js ../servers/cms/output/static/js/uncompressed/picturefill.js ../servers/cms/output/static/js/uncompressed/anchor.js ../servers/cms/output/static/js/uncompressed/lb.js -m -c > ../servers/cms/output/static/js/scripts.min.js

#Fix {version}
node ./fixversion.js

uglifyjs ../servers/cms/output/static/js/app/uncompressed/jquery.js ../servers/cms/output/static/js/app/uncompressed/lb.js -m -c > ../servers/cms/output/static/js/app/scripts.min.js
#cp newscripts.js ../servers/cms/output/static/js/scripts.min.js

uglifyjs ../servers/api/scripts/lb.injectgenericas.js -m -c > ../servers/api/scripts/lb.injectgenericas.min.js

uglifyjs ../servers/cms/public/javascripts/jquery.min.js ../servers/cms/public/javascripts/bootstrap.js ../servers/cms/public/javascripts/picturefill.js ../servers/cms/public/javascripts/jquery.simple-dtpicker.js ../servers/cms/public/javascripts/cms.js  -m -c > ../servers/cms/public/javascripts/scripts.min.js
#cp scripts.js ../servers/admin/static/js/scripts.min.js
#cp scripts.js ../servers/site/static/js/scripts.min.js


#rm -f scripts.js
rm -f newscripts.js