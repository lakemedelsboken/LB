#/bin/bash
#../servers/admin/static/css/jquery.treeview.css

#Old
#cat ../servers/admin/static/css/bootstrap.css ../servers/admin/static/css/bootstrap-responsive.css ../servers/admin/static/css/jquery-ui-1.10.0.custom.css ../servers/admin/static/css/font-awesome.css ../servers/admin/static/css/anchor.css ../servers/admin/static/css/jquery.ui.1.10.0.ie.css ../servers/admin/static/css/lb.css ../servers/admin/static/css/print.css > styles.css

cat ../servers/cms/output/static/css/uncompressed/bootstrap.css ../servers/cms/output/static/css/uncompressed/bootstrap-responsive.css ../servers/cms/output/static/css/uncompressed/jquery-ui-1.10.0.custom.css ../servers/cms/output/static/css/uncompressed/font-awesome.css ../servers/cms/output/static/css/uncompressed/anchor.css ../servers/cms/output/static/css/uncompressed/jquery.ui.1.10.0.ie.css ../servers/cms/output/static/css/uncompressed/lb.css ../servers/cms/output/static/css/uncompressed/print.css > cms_styles.css

#cleancss --s0 -o ../servers/admin/static/css/styles.min.css styles.css

#Old
#cleancss --s0 -o ../servers/site/static/css/styles.min.css styles.css
cleancss --s0 -o ../servers/cms/output/static/css/styles.min.css cms_styles.css

#cp -f cms_styles.css ../servers/cms/output/static/css/styles.min.css

#rm -f styles.css
rm -f cms_styles.css

#cat ../servers/admin/static/css/lb.css ../servers/admin/static/css/print.css > styles.css

#cleancss -o ../servers/admin/static/css/lb.min.css ../servers/admin/static/css/lb.css

#cleancss --s0 -o ../servers/site/static/css/lb.min.css styles.css

#rm -f styles.css

#cleancss --s0 -o ../servers/site/static/css/print.min.css ../servers/admin/static/css/print.css

#Old
#cleancss --s0 -o ../servers/site/static/css/noscript.min.css ../servers/admin/static/css/noscript.css
cleancss --s0 -o ../servers/cms/output/static/css/noscript.min.css ../servers/cms/output/static/css/uncompressed/noscript.css

cleancss --s0 -o ../servers/api/css/lb.injectgenericas.min.css ../servers/api/css/lb.injectgenericas.css

#cleancss --s0 -o ../servers/site/static/css/jquery.ui.ie.min.css ../servers/admin/static/css/jquery.ui.1.10.0.ie.css

