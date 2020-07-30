var chai = require('chai')
  , request = require('supertest')
  , sinon = require('sinon')
  // , redis = require('redis').createClient()
  , v = require('valentine')
  , subject = require('../')
  , mongo = require('mongodb').MongoClient;

chai.use(require('sinon-chai'))

var test_opts = {
  mongoUrl: "mongodb://localhost",
  mongoDb: "express-limiter-mongo-test",
  mongoOpts: {useNewUrlParser:true, useUnifiedTopology: true, connectTimeoutMS: 1000, socketTimeoutMS: 1000}
};
async function wipeDB() {
      // console.log("get client");
      var client = await new mongo.connect(test_opts.mongoUrl,test_opts.mongoOpts);
      var db=client.db(test_opts.mongoDb);
      await db.dropDatabase();
      // console.log("dropped");
}

describe('rate-limiter', function () {
  var express, app, limiter

  beforeEach(async function () {
    express = require('express');
    app = express()
    limiter = subject;
    await wipeDB;
  })

  afterEach(wipeDB);

  it('should work', function (done) {
    var map = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
    var clock = sinon.useFakeTimers()

    var middleware = limiter({
      lookup: ['connection.remoteAddress'],
      total: 10,
      expire: 1000 * 60 * 60,
      ...test_opts
    })

    app.get('/route', middleware, function (req, res) {
        res.status(200).send('hello')
    })

    var out = (map).map(function (item) {
      return function (f) {
        process.nextTick(function () {
          request(app)
          .get('/route')
          .expect('X-RateLimit-Limit', "10")
          .expect('X-RateLimit-Remaining', (item - 1).toString())
          .expect('X-RateLimit-Reset', "3600")
          .expect(200, function (e) {f(e)})
        })
      }
    })
    out.push(function (f) {
      request(app)
      .get('/route')
      .expect('X-RateLimit-Limit', "10")
      .expect('X-RateLimit-Remaining', "0")
      .expect('X-RateLimit-Reset', "3600")
      .expect('Retry-After', /\d+/)
      .expect(429, function (e) {f(e)})
    })
    out.push(function (f) {
      // expire the time
      clock.tick(1000 * 60 * 60 + 1)
      request(app)
      .get('/route')
      .expect('X-RateLimit-Limit', "10")
      .expect('X-RateLimit-Remaining', "9")
      .expect('X-RateLimit-Reset', "7201")
      .expect(200, function (e) {
        clock.restore()
        f(e)
      })
    })
    v.waterfall(out, done)
  })

  context('options', function() {
    it('should process options.skipHeaders', function (done) {
      var middleware = limiter({
        lookup: ['connection.remoteAddress'],
        total: 0,
        expire: 1000 * 60 * 60,
        skipHeaders: true,
        ...test_opts
      })

      app.get('/route', middleware, function (req, res) {
        res.status(200).send('hello')
      })

      request(app)
        .get('/route')
          .expect(function(res) {
            if ('X-RateLimit-Limit' in res.headers) return 'X-RateLimit-Limit Header not to be set'
          })
          .expect(function(res) {
            if ('X-RateLimit-Remaining' in res.headers) return 'X-RateLimit-Remaining Header not to be set'
          })
          .expect(function(res) {
            if ('Retry-After' in res.headers) return 'Retry-After not to be set'
          })
          .expect(429, done)
    })

  })

  context('direct middleware', function () {

    it('is able to mount without `path` and `method`', function (done) {
      var clock = sinon.useFakeTimers()
      var middleware = limiter({
        lookup: 'connection.remoteAddress',
        total: 3,
        expire: 1000 * 60 * 60,
        ...test_opts
      })
      app.get('/direct', middleware, function (req, res, next) {
        res.status(200).send('is direct')
      })
      v.waterfall(
        function (f) {
          process.nextTick(function () {
            request(app)
            .get('/direct')
            .expect('X-RateLimit-Limit', "3")
            .expect('X-RateLimit-Remaining', "2")
            .expect(200, function (e) {f(e)})
          })
        },
        function (f) {
          process.nextTick(function () {
            request(app)
            .get('/direct')
            .expect('X-RateLimit-Limit', "3")
            .expect('X-RateLimit-Remaining', "1")
            .expect(200, function (e) {f(e)})
          })
        },
        function (f) {
          process.nextTick(function () {
            request(app)
            .get('/direct')
            .expect('X-RateLimit-Limit', "3")
            .expect('X-RateLimit-Remaining', "0")
            .expect('Retry-After', /\d+/)
            .expect(429, function (e) { f(null) })
          })
        },
        function (e) {
          done(e)
        }
      )
    })
  })
})
