## Express rate-limiter
Rate limiting middleware for Express applications built on mongo.

This software is derivative of [express-limiter](https://github.com/ded/express-limiter)

``` sh
FIXME: not published yet
npm install express-limiter-mongo --save
```

``` js
var express = require('express')
var app = express()

var limiter = require('express-limiter');

app.use(limiter({
          lookup: ['connection.remoteAddress'],
          // 150 requests per hour
          total: 150,
          expire: 1000 * 60 * 60,
          key: "whole server",
        })
);

app.use(limit)

```

### API options

``` js
var middleware = limiter(options)
```
 - `mongoUrl`: connection URL to mongo store. Defaults to `"mongodb:/localhost"`
 - `mongoOpts`: connection option overrides. Connection options default to `{useNewUrlParser:true, useUnifiedTopology: true, connectTimeoutMS: 1000, socketTimeoutMS: 1000}`; each value must be overridden.
 - `mongoDb`: database name to store connection counts in. Defaults to `"express-limiter-mongo"`
 - `mongoCollection`: collection name to store connection counts in the specified DB. Defaults to `"express-limiter-mongo"`
 - `lookup`: `String|Array.<String>` value lookup on the request object. Can be a single value, array or function. See [examples](#examples) for common usages
 - `total`: `Number` allowed number of requests before getting rate limited
 - `expire`: `Number` amount of time in `ms` before the rate-limited is reset
 - `whitelist`: `function(req)` optional param allowing the ability to whitelist. return `boolean`, `true` to whitelist, `false` to passthru to limiter.
 - `skipHeaders`: `Boolean` whether to skip sending HTTP headers for rate limits ()
 - `onRateLimited`: `Function` called when a request exceeds the configured rate limit.
 - `key`: `String` optional name to label groups of routes. If unset, each route and method will get it's own counter.
### Examples

``` js
// limit by IP address
limiter({
  ...
  lookup: 'connection.remoteAddress'
  ...
})

// or if you are behind a trusted proxy (like nginx)
limiter({
  ...
  lookup: 'headers.x-forwarded-for'
})

// by user (assuming a user is logged in with a valid id)
limiter({
  ...
  lookup: 'user.id'
})

// To limit only one specific route:
var route_limiter =limiter({
          ...
        });
app.route('/api/login',route_limiter,function(req,res,next){...})

// To limit a set of routes together, specify a 'key', so they share counters
var route_limiter =limiter({
          ...
          key: "thing routes",
        });
app.route('/api/thing1',route_limiter,function(req,res,next){...})
app.route('/api/thing2',route_limiter,function(req,res,next){...})

// whitelist user admins
limiter({
  lookup: 'user.id',
  whitelist: function (req) {
    return !!req.user.is_admin
  }
})

// skip sending HTTP limit headers
limiter({
  ...
  skipHeaders: true
})

// call a custom limit handler
limiter({
  path: '*',
  method: 'all',
  lookup: 'connection.remoteAddress',
  onRateLimited: function (req, res, next) {
    next({ message: 'Rate limit exceeded', status: 429 })
  }
})


```


## License MIT

Happy Rate Limiting!
