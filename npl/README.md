#NPL

This is where new products are fetched from http://npa.mpl.se/, added to the fass updating mechanism a subsequently added to the searchable database: `atcTree.json`.

##Scripts

###1. updateFromNplService.js
Runs all of the following scripts in correct order, this is done each night.

###2. _fetch.sh
Fetches npl-data in xml and extracting it.

###3. buildATCTree.js
Builds `newAtcTree.json` which holds only human atc-codes.

###4. parseProducts.js
Parses `database/NplProducts.xml` and saves unrecognized nplId:s to the `/fass/foundUpdates.json`. Also saves a stub to `/npl/products/`.

###5. addProductsToATCTree.js
Iterates all products in /fass/www/products/ and saves some data to newAtcTree.json.

###6. replaceATCTree.js
The contents of the `newAtcTree.json` is copied into `atcTree.json`

##Other files

###atcTree.json
The current database of atc-codes and searchable product information that is used by the site.

###newAtcTree.json
Temporary file that is being processed by the scripts. When it is done it replaces the content in `atcTree.json`.

