var https = require('https');
var fs = require('fs');
var path = require('path');


var download = function(url, dest, cb) {
  var file = fs.createWriteStream(path.join(__dirname, dest));
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
  var request = https.get(url, function(response) {
    response.pipe(file);
    file.on('finish', function() {
      file.close(cb);  // close() is async, call cb after close completes.
    });
  }).on('error', function(err) { // Handle errors
    fs.unlink(dest); // Delete the file async. (But we don't check the result)
    if (cb) cb(err.message);
  });
};

var today = new Date();
var d = today.toISOString().substring(0, 10);

download('https://npl.mpa.se/MpaProductExport/4.1/'+d+'_Total_NPL.zip', '/database/npl/npl.zip', function (err) {
	if (err) {
		console.error('Download of npl failed');
	}
	console.log('Download of npl finished');
});
