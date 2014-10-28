#/bin/bash
#../servers/admin/static/css/jquery.treeview.css
cat ../servers/admin/static/css/bootstrap.css ../servers/admin/static/css/bootstrap-responsive.css ../servers/admin/static/css/jquery-ui-1.10.0.custom.css ../servers/admin/static/css/font-awesome.css ../servers/admin/static/css/anchor.css > styles.css

cleancss -o ../servers/admin/static/css/styles.min.css styles.css
cleancss -o ../servers/site/static/css/styles.min.css styles.css

rm -f styles.css

#cleancss -o ../servers/admin/static/css/lb.min.css ../servers/admin/static/css/lb.css
cleancss -o ../servers/site/static/css/lb.min.css ../servers/admin/static/css/lb.css

#cleancss -o ../servers/admin/static/css/print.min.css ../servers/admin/static/css/print.css
cleancss -o ../servers/site/static/css/print.min.css ../servers/admin/static/css/print.css

#cleancss -o ../servers/admin/static/css/noscript.min.css ../servers/admin/static/css/noscript.css
cleancss -o ../servers/site/static/css/noscript.min.css ../servers/admin/static/css/noscript.css

#cleancss -o ../servers/admin/static/css/jquery.ui.ie.min.css ../servers/admin/static/css/jquery.ui.1.10.0.ie.css
cleancss -o ../servers/site/static/css/jquery.ui.ie.min.css ../servers/admin/static/css/jquery.ui.1.10.0.ie.css

