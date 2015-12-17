(function() {
 	var https = require('https');
	var Q = require('q');
	var querystring = require('querystring');

	var host = 'ws.fass.se';
	var path = '/rest/tickets/'

	var using = 0;
	var ticket;
	var pendingPromise;


	 module.exports = {

		  // This function is providing a ticker that needs to be added to all request headers.
		  // The function handles both promises and callbacks.
		  login: function (username, password, callback) {
			  	// Increase the counter to prevent multiple functions to logout if the ticket is in use.
			  	using++;

				// Create a promise.
				var deferred = Q.defer();

				// If the counter is greater than 0, then return the existing ticket and skip the request.
				if (using > 1) {
					 // Resolve the promise and pass the ticket along. But wait for exsisting requests to finish.
					 if (pendingPromise.isPending()) {
						 pendingPromise.then(function () {
							 //console.log('Login existing: '+ ticket);
						 	deferred.resolve(ticket);
						 });
					 } else {
						 //console.log('Login existing: '+ ticket);

						 deferred.resolve(ticket);
					 }
				} else {
					pendingPromise = deferred.promise.nodeify(callback);
					// Use the node core module 'querystring' to translate the js-object to form data.
					 var data = querystring.stringify({
						  username: username,
						  password: password
					 });

					 var options = {
						  host: host,
						  port: 443,
						  path: path,
						  method: 'POST'
					 };

					 // Send the request (vanilla node). The functions inside will fire after the req.write().
					 var req = https.request(options, function (res) {
						// Save the data here.
						var resData = '';

						// When data arrive, save it.
						res.on('data', function (chunkOfData) {
							resData += chunkOfData;
						  });

						  // When no more data is available then this function will fire.
						  res.on('end', function () {
								if (resData !== undefined && res.statusCode === 200) {
									 // Example ticket: ZECUNHXWIIXQ
									 //console.log('Login: '+ resData);
									 ticket = resData;
									 deferred.resolve(resData);

								} else {
									 deferred.reject(new Error("Error when reading data from the FASS authentication response (login).\nStatus code: " + res.statusCode));
								}
						  });
					 });

					// Send the form data and close the connections.
					req.write(data);
		 			req.end();

					// Handle errors on the request.
					req.on('error', function (e) {
						deferred.reject(new Error("Error connecting to FASS authentication service (login).\nError message: " + e.message));
					});

				}
				// Return the promise. Or execute the callback.
				return deferred.promise.nodeify(callback);


		  },

		logout: function (callback) {
			//console.log('Logout: '+ ticket);

				// Create a promise.
				var deferred = Q.defer();

				// Decrease the counter to prevent multiple functions to logout if the ticket is in use.
				using--;

				// Only send this request is the count is less or equal to zero.
				if (using <= 0 && ticket !== undefined) {

					 var options = {
						  host: host,
						  port: 443,
						  path: path + ticket,
						  method: 'DELETE'
					 };

					 // Send the request (vanilla node.
					 var req = https.request(options, function (res) {
						  // Save the data here.
						  var resData = '';

						  // When data arrive, save it.

						  res.on('data', function (chunkOfData) {
								resData += chunkOfData;
						  });

						  // When no more data is available then this function will fire.
						  res.on('end', function () {
								if (resData !== undefined && resData.status !== undefined && resData.status === 200) {
									 ticket = resData.entity;
									 // Example ticket: ZECUNHXWIIXQ
									 deferred.resolve();
								} else {
									 deferred.reject(new Error("Error when reading data from the FASS authentication response (logout).\nStatus code: " + resData.status));
								}
						  });

					 });

					 req.end();

					 // Handle errors on the request.
					 req.on('error', function (e) {
						  deferred.reject(new Error("Error connecting to FASS authentication service (logout).\nError message: " + e.message));
					 });
				} else {
					 // If someone else is using the ticket, then just decrease the using variable and resolve.
					 deferred.resolve();
				}

				return deferred.promise.nodeify(callback)
		  }
	 };
}());
