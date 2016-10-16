# node-pg-call-extension

This is a module to extends the NodeJS' PostgreSQL client module `pg` to abstract stored procedures call. 

In a nutshell, consider the following **plpgsql** function signature:

``` sql
create function user_login (_email varchar, _password varchar, _remote_address varchar, 
	  _remote_client_key varchar, _user_agent varchar) returns bigint
```

This function sbstracts the login process: first it checks if the e-mail is registered, 
then checks if the user is active, then checks if the password is correct. Following, 
it takes the `_remote_client_key`, a cookie stored in the client, and checks if that 
client is already registered. If not it registers the client using the given `_user_agent`
string identifying the client. Finally, it creates a new session and returns its session id.

Imagine what a messy nest of callbacks we would need to perform this operation without 
stored procedures!!

Anyways, to invoke this function on Node.js using the `pg` extension we wold have to use 
something like that.

``` javascript
client.query('user_login ($1::text, $2::text, $3::text, $4::text, $5::text)', 
    [req.body.email, req.body.password, req.headers['x-forwarded-for'] || req.connection.remoteAddress,
		    req.cookies.remoteClientKey, req.headers['user-agent']], callbackFunction);
```
In this module we turn this into something more compreehensive...

``` javascript 
client.call('userLogin', {
    email:           req.body.email,
    password:        req.body.password,
    remoteAddress:   req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    remoteClientKey: req.cookies.remoteClientKey,
    userAgent:       req.headers['user-agent']
}, function (result) {
    // do something
});
```
Clearer, isn't it?

### Dynamic binding

One of the drawbacks of stored procedures languages (PL/SQL, Transact, etc.) is that they only accept
static binding, which means that all parameters must be passed on every function call. In this call 
extension, is offered an workaround for this limitation. 

For the same `user_login` function, consider that you already has the value for the `_remote_client_key`, 
thus you don't need to inform the `_user_agent` value because it is only used to register new clients. 
In this case we can perform the call this way.

``` javascript 
var params = {
    email:           req.body.email,
    password:        req.body.password,
    remoteAddress:   req.headers['x-forwarded-for'] || req.connection.remoteAddress
};

if (req.cookies.remoteClientKey)
    params.remoteClientKey = req.cookies.remoteClientKey;
else
    params.userAgent = req.headers['user-agent'];

client.call('userLogin', params, function (result) {
    // do something
});
```
Notice that, depending wether the `remoteClientKey` value is available or not, the method will receive 
a different set of parameters. This call extension will look up at the `pg_catalog.pg_proc` for the 
parameters sequnce and will match these parameters with the given values. Any ininformed parameter 
will defalt to null.
