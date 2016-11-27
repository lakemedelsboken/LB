mkdir database
cd database/
mkdir npl
mkdir sensl

cd ..
node fetchNplFile.js
cd database/

wget https://docetp.mpa.se/LMF/Reports/Lakemedelsfakta%20produktdokument.xml -O ./LMFDocuments.xml
wget http://nsl.mpa.se/sensl.zip -O ./sensl/sensl.zip

cd npl/
unzip npl.zip
rm npl.zip

cd ../sensl
unzip sensl.zip
rm sensl.zip
