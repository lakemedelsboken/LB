(function() {
    var fs = require('fs');

    module.exports = {
        // Add new products here.
        unimedicData: {
            "20110929000129": {
                "spcLink": "/product/20110929000129.pdf"
            },
            "20110927000022": {
                "spcLink": "/product/20110927000022.pdf"
            },
            "20110929000105": {
                "spcLink": "/product/20110929000105.pdf"
            },
            "20110929000112": {
                "spcLink": "/product/20110929000112.pdf"
            },
            "20120301000067": {
                "spcLink": "/product/20120301000067.pdf"
            }
        },

        fetch: function(callback) {
            var self = this;

            console.log("Start fetching data from Unimedic...");

            //Check if atcTree.json exists
            var path = __dirname + "/../../atcTree.json";
            if (!fs.existsSync(path)) {
                console.error('Could not find newATCTree.json. path: ' + path);
                return;
            }
            //Open atcTree.json
            var atcTree = JSON.parse(fs.readFileSync(path, "utf8"));

            //Remove non products and products that dont contain Unimedic in the title.
            var productsInATCTree = atcTree.filter(function(element) {

                return (element.type === "product" && (element.title.indexOf("Unimedic") > -1));
            });
            var counter = 0;

            productsInATCTree.forEach(function(atcTreeProduct,i) {

                // Check if the act tree product is affected by this function
                if(self.unimedicData[atcTreeProduct.id] !== undefined) {

                    //Change the noinfo boolean in the atcTree
                    atcTreeProduct.noinfo = false;

                    // Get the prdocut file
                    var productPath = __dirname + "/../../../fass/www/products/" + atcTreeProduct.id + ".json";

                    //Write to the product information
                    if (fs.existsSync(productPath)) {
                        var productFile = JSON.parse(fs.readFileSync(productPath, "utf8"));

                        if (productFile.noinfo !== undefined) {
                            delete productFile.noinfo;
                        }

                        //Remove any error markers
                        if (productFile.errors !== undefined) {
                            delete productFile.errors;
                        }

                        productFile.noSections = true;
                        productFile.provider = "Unimedic";
                        productFile.license = "Rikslicens";
                        productFile.spcLink = self.unimedicData[atcTreeProduct.id].spcLink;
                        // Save the file
                        fs.writeFileSync(productPath, JSON.stringify(productFile, null, "\t"), "utf8");
                        counter++;

                    } else {
                        console.error('Could not find ' +atcProduct.id+ '.json in ' +__dirname + '/../../../fass/www/products/');
                    }
                }
            });
            fs.writeFileSync(path, JSON.stringify(atcTree, null, "\t"), "utf8");
            console.log("Found " + counter + " products from Unimedic");
            console.log("Finished fetching data from Unimedic.");

            if (callback !== undefined && typeof callback === "function") {
                callback();
            }

        	return;
        }
    };
}());
