const MongoClient = require('mongodb').MongoClient;

var collection = null;
async function connect(opts)
{
  if(collection) return collection;
  var client = await new MongoClient.connect(opts.mongoUrl, opts.mongoOpts);
  if(!client) throw new Error("Cannot connect to Mongo client");
  var db = client.db(opts.mongoDb);
  if(!db) throw new Error("Cannot connect to Mongo DB");
  collection =  db.collection(opts.mongoCollection);
  return collection;
}

module.exports = function (opts) {
    opts.lookup = Array.isArray(opts.lookup) ? opts.lookup : [opts.lookup]
    opts.mongoUrl = opts.mongoUrl || "mongodb://localhost";
    opts.mongoDb = opts.mongoDb || "express_limiter_mongo";
    opts.mongoCollection = opts.mongoCollection || "express_limiter_mongo";
    opts.mongoOpts = {useNewUrlParser:true, useUnifiedTopology: true, connectTimeoutMS: 1000, socketTimeoutMS: 1000, ...opts.mongoOpts};

    var middleware = async function (req, res, next) {
      if (opts.whitelist && opts.whitelist(req)) return next()
      opts.onRateLimited = typeof opts.onRateLimited === 'function' ? opts.onRateLimited : function (req, res, next) {
        res.status(429).send('Rate limit exceeded')
      }
       var lookups = opts.lookup.map(function (item) {
        return item + ':' + item.split('.').reduce(function (prev, cur) {
          return prev[cur]
        }, req)
      }).join(':')
      var path = req.path
      var method = req.method.toLowerCase()
      var key = 'ratelimit:' + path + ':' + method + ':' + lookups;
      if(opts.key) key = opts.key; // Allow the user to override the key, link up several middleware instances.
      var col = await connect(opts);
      var limit = await col.findOne({_id:key});
      var now = Date.now()
      limit = limit ? limit : {
        total: opts.total,
        remaining: opts.total,
        reset: new Date(now + opts.expire)
      }
      
      if (now > limit.reset) {
          limit.reset = now + opts.expire
          limit.remaining = opts.total
      }

      // do not allow negative remaining
      limit.remaining = Math.max(Number(limit.remaining) - 1, -1)
      
      await col.updateOne({_id:key},{$set:{...limit}},{upsert:true});
      if (!opts.skipHeaders) {
        res.set('X-RateLimit-Limit', limit.total)
        res.set('X-RateLimit-Reset', Math.ceil(limit.reset / 1000)) // UTC epoch seconds
        res.set('X-RateLimit-Remaining', Math.max(limit.remaining,0))
      }

      if (limit.remaining >= 0) return next()

      var after = (limit.reset - Date.now()) / 1000

      if (!opts.skipHeaders) res.set('Retry-After', after)

      opts.onRateLimited(req, res, next)
    }; // end middleware


    return middleware;
  };
