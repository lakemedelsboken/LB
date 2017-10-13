#/bin/bash
uglifyjs ../servers/cms/public/javascripts/jquery.min.js ../servers/cms/public/javascripts/bootstrap.js ../servers/cms/public/javascripts/picturefill.js ../servers/cms/public/javascripts/jquery.simple-dtpicker.js ../servers/cms/public/javascripts/cms.js  -m -c > ../servers/cms/public/javascripts/scripts.min.js
