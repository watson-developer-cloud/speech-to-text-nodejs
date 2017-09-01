const path = require('path');
// load default variables for testing
require('dotenv').config({ path: path.join(__dirname, '../../.env.example') });

const app = require('../../app');
const request = require('supertest');
const nock = require('nock');

describe('offline tests', () => {
  describe('server', function server() {
    this.timeout(10000);

    it('should return HTML for GET /', (done) => {
      this.slow(3000);
      request(app).get('/').expect(200, /<html/, done);
    });

    it('should return a 404 for bogus urls', (done) => {
      request(app).get('/foo/bar').expect(404, done);
    });

    it('should fetch and return a token for GET /api/token', (done) => {
      const fakeToken = 'asdfasdfasdf';

      nock('https://stream.watsonplatform.net:443', { encodedQueryParams: true })
        .get('/authorization/api/v1/token')
        .query({ url: 'https://stream.watsonplatform.net/speech-to-text/api' })
        .reply(200, fakeToken, {
          connection: 'close',
          'transfer-encoding': 'chunked',
          'content-type': 'text/xml',
          'x-dp-watson-tran-id': 'stream-dp01-34302424',
          date: 'Tue, 29 Mar 2016 19:50:27 GMT',
        });

      request(app).get('/api/token').expect(200, fakeToken, done);
    });
  });

  describe('client', () => {
    // todo: add a few frontend code tests
  });
});
