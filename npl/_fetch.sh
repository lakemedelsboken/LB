wget https://npl.mpa.se/mpa.npl.services/publicering/npl.tgz -O ./database/npl.tgz
wget https://docetp.mpa.se/LMF/Reports/Lakemedelsfakta%20produktdokument.xml -O ./database/LMFDocuments.xml
wget http://nsl.mpa.se/sensl.zip -O ./database/substances/sensl.zip

cd database/
tar -zxvf npl.tgz
rm npl.tgz

cd substances/
unzip -o sensl.zip
rm sensl.zip
