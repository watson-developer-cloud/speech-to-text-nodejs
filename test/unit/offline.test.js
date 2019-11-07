const path = require('path');
// load default variables for testing
require('dotenv').config({ path: path.join(__dirname, '../../.env.example') });

const app = require('../../app'); // eslint-disable-line
const request = require('supertest');
const nock = require('nock');

describe('offline tests', () => {
  describe('server', function server() { // eslint-disable-line
    this.timeout(5000);

    it('should return HTML for GET /', (done) => {
      request(app).get('/').expect(200, /<html/, done);
    });

    it('should return a 404 for bogus urls', (done) => {
      request(app).get('/foo/bar').expect(404, done);
    });
  });
});
