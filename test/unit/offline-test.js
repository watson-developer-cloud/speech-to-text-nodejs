'use strict';

const path = require('path');
// load default variables for testing
require('dotenv').config({ path: path.join(__dirname, '../../.env.example') });

var app = require('../../app');
var request = require('supertest');
var nock = require('nock');

describe('offline tests', function() {

  describe('server', function() {
    this.timeout(10000);

    it('should return HTML for GET /', function(done) {
      this.slow(3000);
      request(app).get('/').expect(200, /<html/, done);
    });

    it('should return a 404 for bogus urls', function(done) {
      request(app).get('/foo/bar').expect(404, done);
    });

    it('should fetch and return a token for GET /api/token', function(done) {
      var fakeToken = 'asdfasdfasdf';

      nock('https://stream.watsonplatform.net:443', {'encodedQueryParams': true})
      .get('/authorization/api/v1/token')
      .query({'url': 'https://stream.watsonplatform.net/speech-to-text/api'})
      .reply(200, fakeToken, {
        connection: 'close',
        'transfer-encoding': 'chunked',
        'content-type': 'text/xml',
        'x-dp-watson-tran-id': 'stream-dp01-34302424',
        date: 'Tue, 29 Mar 2016 19:50:27 GMT'
      });

      request(app).get('/api/token').expect(200, fakeToken, done);
    });
  });

  describe('client', function() {
    // todo: add a few frontend code tests
  });
});
