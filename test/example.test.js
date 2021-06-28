const assert = require('assert');
var expect = require('chai').expect;
var hauth_control = require('../src/hauth_control');

const testURLSamples = [
  { input: '/allow', expectedResult: 401, description: 'should return 401 when ' + '/allow' + ' is passed' },
  { input: 'allow?foo=bar', expectedResult: 401, description: 'should return 401 when allow?foo=bar is passed' },
  { input: '/skip', expectedResult: 200, description: 'should return 200 when skip is passed' },
  { input: '/skip?foo=bar', expectedResult: 200, description: 'should return 200 when skip?foo=bar is passed' },
  { input: '/skip/foo/bar', expectedResult: 200, description: 'should return 200 value when skip/foo/bar is passed' },
  { input: '/all_roles', expectedResult: 401, description: 'should return 401 value when all_roles is passed without providing login:pwd' },
  { input: 'only_role1', expectedResult: 200, description: 'should return 200 value when all_roles is passed with providing login:pwd for role1' },
];

describe('Test Expected HTTP code with different URL (function hauth.control)', () => {
    testURLSamples.forEach((url) => {
      it(url.description, () => {
        // assert.equal(hauth_control(url.input), url.expectedResult);
        expect(hauth_control(url.input)).to.be.equal(url.expectedResult)
      });
    });
  });

describe('Simple Test', () => {
 it('should return 200 OK', () => {
        assert.strictEqual(1 + 1, 2);
    });
 it('should return 403 Forbidden', () => {
        assert.strictEqual(3 * 3, 9);
    });
});

