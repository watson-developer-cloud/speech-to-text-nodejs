const path = require('path');
// load default variables for testing
require('dotenv').config({ path: path.join(__dirname, '../../.env.example') });

const app = require('../../app'); // eslint-disable-line
const request = require('supertest');
const nock = require('nock');

describe('offline tests', () => {
  describe('server', function server() { // eslint-disable-line

    it('should return HTML for GET /', (done) => {
      request(app).get('/').expect(200, /<html/, done);
    });

    it('should return a 404 for bogus urls', (done) => {
      request(app).get('/foo/bar').expect(404, done);
    });

    it('should fetch and return a token for GET /api/credentials', (done) => {
      const fakeToken = {
        token: 'faketoken',
        serviceUrl: 'https://stream.watsonplatform.net/speech-to-text/api',
      };

      nock('https://stream.watsonplatform.net:443', { encodedQueryParams: true })
        .get('/authorization/api/v1/token')
        .query({ url: 'https://stream.watsonplatform.net/speech-to-text/api' })
        .reply(200, 'faketoken', {
          connection: 'close',
          'transfer-encoding': 'chunked',
          'content-type': 'text/xml',
          'x-dp-watson-tran-id': 'stream-dp01-34302424',
          date: 'Tue, 29 Mar 2016 19:50:27 GMT',
        });

      request(app).get('/api/credentials').expect(200, fakeToken, done);
    });
  });
});
