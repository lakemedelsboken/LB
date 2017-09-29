#/bin/bash
#../servers/admin/static/css/jquery.treeview.css

#Old
#cat ../servers/admin/static/css/bootstrap.css ../servers/admin/static/css/bootstrap-responsive.css ../servers/admin/static/css/jquery-ui-1.10.0.custom.css ../servers/admin/static/css/font-awesome.css ../servers/admin/static/css/anchor.css ../servers/admin/static/css/jquery.ui.1.10.0.ie.css ../servers/admin/static/css/lb.css ../servers/admin/static/css/print.css > styles.css


# ../servers/cms/output/static/css/uncompressed/print.css

cat ../servers/cms/output/static/css/uncompressed/bootstrap.css ../servers/cms/output/static/css/uncompressed/bootstrap-responsive.css ../servers/cms/output/static/css/uncompressed/jquery-ui-1.10.0.custom.css ../servers/cms/output/static/css/uncompressed/font-awesome.css ../servers/cms/output/static/css/uncompressed/anchor.css ../servers/cms/output/static/css/uncompressed/jquery.ui.1.10.0.ie.css ../servers/cms/output/static/css/uncompressed/lb.css > cms_styles.css

cat ../servers/cms/output/static/css/app/uncompressed/bootstrap-app.css ../servers/cms/output/static/css/app/uncompressed/bootstrap-app-responsive.css ../servers/cms/output/static/css/uncompressed/font-awesome.css ../servers/cms/output/static/css/app/uncompressed/lb.css > app_styles.css
#cleancss --s0 -o ../servers/admin/static/css/styles.min.css styles.css

#Old
#cleancss --s0 -o ../servers/site/static/css/styles.min.css styles.css
cleancss --s0 -o ../servers/cms/output/static/css/styles.min.css cms_styles.css
cleancss --s0 -o ../servers/cms/output/static/css/app/styles.min.css app_styles.css

#cp -f cms_styles.css ../servers/cms/output/static/css/styles.min.css

#rm -f styles.css
rm -f cms_styles.css
rm -f app_styles.css

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

#Fix {version}
node ./fixversion.js

cat ../servers/cms/public/stylesheets/theme.css ../servers/cms/public/stylesheets/dashboard.css ../servers/cms/public/stylesheets/image-picker.css ../servers/cms/public/stylesheets/jsondiff.css ../servers/cms/public/stylesheets/jquery.simple-dtpicker.css ../servers/cms/public/stylesheets/font-awesome-4.3.0/css/font-awesome.min.css ../servers/cms/public/stylesheets/style.css | cleancss -o ../servers/cms/public/stylesheets/styles.min.css
