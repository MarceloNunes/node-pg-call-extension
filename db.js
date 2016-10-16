var path = require('path');
var db = require('pg');

var FUNCTION_NOT_FOUND_ERROR  = 'No function corresponds to the given arguments.';
var WRONG_ARGUMENT_COUNT_ERROR = 'Wrong argument count. Excpected parameters are: ';

var connectionString = require(path.join(__dirname, '../../config'));

/**
 * Converts a dashed-style identifier to camlcase 
 * format. 
 * e.g. 'get_user_by_email' => 'getUserByEmail'
 * 
 * @param  {[type]} myString A dashed-style identifier
 * @return {[type]}          A camlcase identifier
 */
function dashed2camlcase (myString) {
	return myString.replace(/_([a-z])/g, function (g) { 
		return g[1].toUpperCase(); 
	});
}

/**
 * Converts all keys from a record (a JavaScript 
 * object) from dashed-style to camlcase.
 * 
 * e.g. {user_name: 'John Doe', 'date_of_birth' : '1969-12-31'} =>
 * {userName: 'John Doe', 'dateOfBirth' : '1969-12-31'}
 * 
 * @param  {[type]} rec1 Javascript object with dashed-style keys
 * @return {[type]}      Javascript object with camlcase-style keys
 */
function record2CamlCase (rec1) {
	var rec2 = {}
	for (var key in rec1) {
		rec2[dashed2camlcase(key)] = rec1[key];
	}
	return rec2;
}

/**
 * Converts a camlcase identifier to dashed_style 
 * format. 
 * e.g. 'getUserByEmail' => 'get_user_by_email'
 * 
 * @param  {[type]} myString A camlcase identifier
 * @return {[type]}          A dashed-style identifier
 */
function camlcase2dashed (myString) {
	return myString.replace(/(?:^|\.?)([A-Z])/g, function (x,y) {
		return "_" + y.toLowerCase()
	}).replace(/^_/, "");
}

/**
 * Extends the 'pg' connect method by encapsulating the connection process
 * and invoking a callback function with a 'client' object as parameter that 
 * has a 'call' method wich queries specificaly the stored procedures
 * 
 * @param  {function} startCallback callback function
 * @return {object}               PostgreSQL connection
 */
db.start = function (startCallback) {

	return this.connect(connectionString, function (err, client, done) {

		if (err) {
			done();
//			console.log(err);
			return { sucess: false, data: err };
		}

		/**
		 * A method to invoke stored procedures
		 *
		 * @param {string} arguments[0] The name of the stored procedure
		 * @param {string} arguments[1] The name of the stored procedure
		 * 
		 * @return {object} [description]
		 */
		client.call = function () {

			var obj = this;

			//
			var procedureName = camlcase2dashed(arguments[0]);

			if (arguments.length == 0) {
				var NO_PARAMETERS_ERROR = 'No parameters given.';
				throw NO_PARAMETERS_ERROR;
			}

			if (typeof arguments[0] != 'string') {
				var INVALID_PARAMETERS_ERROR = 'Invalid parameters.';
				throw INVALID_PARAMETERS_ERROR;
			}

			var queryCallback = null;
			var paramsList = Array.from(arguments);

			if (typeof paramsList[paramsList.length - 1] == 'function') {
				queryCallback = paramsList[paramsList.length - 1];
				paramsList.pop();
			}
			if (paramsList.length > 1 && typeof paramsList[1] == 'object') {
				var paramsList = paramsList[1];
			} else {
				paramsList.shift();
			}

			var queryString = 'SELECT proname, proargnames FROM pg_catalog.pg_proc ' + 
				'WHERE proname = $1';
			var query1 = this.query(queryString, [procedureName]);
			var result = null;
			var argumentNames = [];
			query1.on('row', function (row) {
				result = row;
			});
			query1.on('end', function() {
				done();
				if (!result) {
					throw FUNCTION_NOT_FOUND_ERROR + ': ' + procedureName;
				} else {
					for (var i in result.proargnames) {
						var argName = result.proargnames[i];
						if(argName.charAt(0) == '_') {
							argName = argName.substring(1, argName.length);
						}
						argumentNames.push(argName);
					}
				}
				if (Array.isArray(paramsList)) {
					if (paramsList.length != argumentNames.length) {
						 WRONG_ARGUMENT_COUNT_ERROR = WRONG_ARGUMENT_COUNT_ERROR + 
								argumentNames.join(', ');
						throw WRONG_ARGUMENT_COUNT_ERROR;
					}
				} else {
					var tmp = [];
					for (var i in argumentNames) {
						var argName = dashed2camlcase(argumentNames[i]);
						if (paramsList[argName]){
							tmp.push(paramsList[argName]);
						} else {
							tmp.push(null);
						}
					}
					paramsList = tmp;
				}

				var params = [];
				for (var i = 1; i <= paramsList.length; i++) {
					params.push('$' + i);
				}
				var queryString = 'SELECT * FROM ' + procedureName
					+ ' ( ' + params.join(' , ') + ' )';

				var query = obj.query(queryString, paramsList);
				var results = [];

				query.on('row', function (row) {
					results.push(row);
				});

				query.results = results;

				query.on('end', function() {
					done();

					for (var i in query.results) {
						query.results[i] = record2CamlCase(query.results[i]);
					}

					if (query.results.length > 0) {
						query.record = query.results[0];
						for (var key in query.record) {break;}
						query.value = query.record[key];
					} else {
						query.record = null;
						query.value = null;
					}
					
					if (parseInt(query.value) < 0) {
						var errorId = Math.abs (query.value);
						console.log('ERRO! ' + errorId);
						var query1 = obj.query("SELECT * FROM error ( $1 )", 
							[errorId]);
						var result = null;
						query1.on('row', function (row) {
							result = record2CamlCase(row);
						});
						query1.on('end', function() {
							done();
							if (result) {
								query.error = result;
								if (queryCallback) {
									queryCallback(query);
								}
							} 
						});
					} else {
						if(queryCallback) {
							queryCallback(query);
						}
					}
				});

			});
		};

		client.error = function (id, errorCallback) {
			client.call('errormessagesGet', id, function (query) {
				if (errorCallback) {
					errorCallback(query.record);
				}
			});
		};

		startCallback(err, client, done);
	});
}

module.exports = db;
