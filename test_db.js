var db = require('db');

db.start(function (err, client, done) {

	client.call('accessLogin', {
		email:         'marcelo@qualifyit.com.br',
		password:      '123123',
		remoteAddress: '128.0.0.0',
		userAgent:     'Console call'
	}, function (query) {
		if (query.error) {
			console.log(query.error);
		} else {
			console.log(query.value);
			client.call('accessLogGet', query.value, function (query) {
				console.log(query.record);
			});
		}
	});

});
