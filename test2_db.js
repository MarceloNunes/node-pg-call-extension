var db = require('db');

db.start(function (err, client, done) {

	client.call('usersGet', 'marcelo@qualifyit.com.br', function (query) {
		if (query.error) 
			console.log(query.error);
		else
			client.call('accessLogBrowse', {
				userId : query.record.id,
				limit: 10
			}, function (query) {
				for (var i in query.results)
					console.log(query.results[i].startTimeFormat);
			});
		
	});

});
