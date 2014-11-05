#/bin/bash
#../servers/admin/static/css/jquery.treeview.css
cat ../servers/admin/static/css/bootstrap.css ../servers/admin/static/css/bootstrap-responsive.css ../servers/admin/static/css/jquery-ui-1.10.0.custom.css ../servers/admin/static/css/font-awesome.css ../servers/admin/static/css/anchor.css ../servers/admin/static/css/jquery.ui.1.10.0.ie.css ../servers/admin/static/css/lb.css ../servers/admin/static/css/print.css > styles.css

#cleancss --s0 -o ../servers/admin/static/css/styles.min.css styles.css
cleancss --s0 -o ../servers/site/static/css/styles.min.css styles.css

rm -f styles.css

#cat ../servers/admin/static/css/lb.css ../servers/admin/static/css/print.css > styles.css

#cleancss -o ../servers/admin/static/css/lb.min.css ../servers/admin/static/css/lb.css

#cleancss --s0 -o ../servers/site/static/css/lb.min.css styles.css

#rm -f styles.css

#cleancss --s0 -o ../servers/site/static/css/print.min.css ../servers/admin/static/css/print.css

cleancss --s0 -o ../servers/site/static/css/noscript.min.css ../servers/admin/static/css/noscript.css

#cleancss --s0 -o ../servers/site/static/css/jquery.ui.ie.min.css ../servers/admin/static/css/jquery.ui.1.10.0.ie.css

