(function() {
    var apl = require('./apl/apl.js');
    var unimedic = require('./unimedic/unimedic.js');

    module.exports = {

        fetch: function (callback) {
            // TODO: the apl service is async while the unimedic is sync == inconsistent == bad. //Oskar
            try {
                apl.fetch(function(){
                    unimedic.fetch();
                    callback();
                });
            }
            catch (e) {

            }
        }
    };
}());
