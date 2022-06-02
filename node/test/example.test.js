process.env.NODE_ENV = 'test';

var request = require('supertest')
var chai = require('chai');
var should = chai.should();
var chaiHttp = require('chai-http');

/** 
 * @todo: `npm run test` or `mocha --exit` starts the server and do the test.
 * Can't start the server with mocha, so the `npm run example` must be run before calling this test, in a separated cmd windows (to start the server).
 */
// var server = require('../example/index');
// server.init();


var HTTP_STATUS_CODES = {
    200 : 'OK',
    400 : 'Bad Request',
    401 : 'Unauthorized',
    403 : 'Forbidden',
    404 : 'Not Found',
    408 : 'Request Timeout',
    500 : 'Internal Server Error',
};

chai.use(chaiHttp);

/**
 * Testing the control function (HTTP status code returned by the server) with different URL paths and different user
 */
const testURLSamples = [
    { input: '', expectedResult: 200, description: 'Should return 200 OK by default for the homepage'},
    { input: 'allow', expectedResult: 401},
    { input: 'allow?foo=bar', expectedResult: 401},
    { input: 'skip', expectedResult: 401},
    { input: 'skip?foo=bar', expectedResult: 401},
    { input: 'skip/foo/bar', expectedResult: 401},
    { input: 'all_roles', expectedResult: 401, description: 'should return 401 value when all_roles is passed without providing login:pwd' },
    { input: 'only_role1', expectedResult: 200, description: 'should return 200 value when all_roles is passed with providing login:pwd for role1' },
];

describe('Test server response with different URLs (hauth.control)', () => {
    testURLSamples.forEach((url) => {
        if (!url.description) {
            url.description = ['Should return', url.expectedResult, HTTP_STATUS_CODES[url.expectedResult], 'when', '/'+url.input, 'is passed.'].join(' ');
        }
        it(url.description, function(done) {
            // this.timeout(2000)

            chai.request('localhost:3000').get('/' + url.input).end(function(err, res){
                    res.should.have.status(url.expectedResult);
                    done();
                });
            
        });
    });
});

/**
 * Test getCookie and delCookie functions
 */
var Cookies;

describe('Cookie Functional Test :', function () {
    it('should create user session for valid user', function (done) {
      request('localhost:3000').post('/')
        .set('Accept','application/json')
        .send({"login": "admin", "password": "admin"})
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res) {
          res.body.id.should.equal('1');
          res.body.login.should.equal('admin');
          res.body.role.should.equal('admin');
          // Save the cookie to use it later to retrieve the session
          Cookies = res.headers['set-cookie'].pop().split(';')[0];
          done();
        });
    });
    it('should get user session for current user', function (done) {
      var req = request('localhost:3000').get('/');
      // Set cookie to get saved user session
      req.cookies = Cookies;
      req.set('Accept','application/json')
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res) {
          res.body.id.should.equal('1');
          res.body.login.should.equal('admin');
          res.body.role.should.equal('admin');
          done();
        });
    });
  });
  