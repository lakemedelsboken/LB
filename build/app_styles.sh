#/bin/bash
#../servers/admin/static/css/jquery.treeview.css
cat ../servers/admin/static/css/bootstrap-app.css ../servers/admin/static/css/bootstrap-app-responsive.css ../servers/admin/static/css/font-awesome-app.css ../servers/admin/static/css/lb-app.css > styles.css

cleancss -o /Users/staliv/Documents/Titanium_Studio_Workspace/LB2014App/Resources/chapters/css/styles.css styles.css

rm -f styles.css
