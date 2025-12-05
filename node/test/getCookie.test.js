const request = require('supertest');

/* from example/index.js */
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');

const app = express();
const port = 3000;
app.use(cookieParser());

// require body-parser to properly retrieve login:pwd in request body
const bodyParser = require('body-parser')
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.text());
app.use(bodyParser.json());

const pg = require('pg');
const db = new pg.Pool({
  host: 'localhost',
  port: 5432,
  database: 'test',
  user: 'testuser',
  password: 'testpass',
});

const config = {
  // Refer to the README file for the description of the params
  cookiename: 'test', // optional, default value is 'hauth'
  roles: ['admin', 'user'],
  defaultUsers: [{ login: 'admin', role: 'admin', password: 'admin' }],
  accessRules: {
    '/node_modules': 'skip',    // disable access control for node modules
    '/whoami': 'allow',         // everyone can check his/her profile
    '/hauth/deluser': 'deny',   // no one can delete an account
    '/hauth': ['admin'],        // account management is reserved to admins
    '\.css$': 'skip',           // disable access control for css files
    // by default, access to all other paths is allowed to authenticated users
  },
  on401: (req, res) => {
    if (req.accepts('html')) {
      res.sendFile(__dirname + '/static/login.html')
    } else {
      res.send();
    }
  },
  on403: (req, res) => { res.send('Forbidden') },
  onLogout: (req, res) => { res.send('You are logged out') },
  autocreate: async function(login, pwd, db, request_headers) {
    if (pwd === 'secret') { // this magic password allows to create any admin account
      //await db.query('INSERT INTO ...'); // you can add some extra processing
      return {login: login, name: login, role: 'admin'}
    }
  }
};

// console.* methods overriden so as to disable logs
for (const verb of ['log', 'debug', 'http', 'info', 'warn', 'error']) {
  console[verb] = function(...args) {}
}

const hauth = require('../lib/index');
describe('Init HAuth', () => {
  it('should init Hauth asynchronously', async () => {
    await hauth.init(config, db)
  });
});

testGetCookie()

function testGetCookie() {
    const WHOAMI_PATH = '/whoami';
    const LOGIN_PATH = '/hauth/login';
    const LOGIN_USER = 'bob';
    const MAGIC_PASSWORD = 'secret';
    const BAD_PASSWORDS = ['not-the-password', '', undefined, false, true, null];
    app.use(LOGIN_PATH, hauth.getCookie);
    app.use('/', hauth.control);
    app.use(WHOAMI_PATH, (req, res) => {res.send(req.user)});

    let nextPassword = null;
    let cookie = null;

    // Utility function for the login request
    const login = (password) => request(app).post(LOGIN_PATH).send({ login: LOGIN_USER, password });
    const whoami = (cookie) => request(app).get(WHOAMI_PATH).set('Cookie', [`test=${cookie}`]).send();

    describe('POST /hauth/login - Sequential Scenario', () => {

        it('Remove test user if it exists', async () => {
            await hauth.delUser(LOGIN_USER);
        });

        it ('Not found without cookie', async() => {
            const res = await whoami('');
            expect(res.statusCode).toBe(404);
        });

        // --- 1. KO : Invalid login attempts (401) ---
        for (const pwd of BAD_PASSWORDS) {
            it(`should return 401 for password: ${pwd}`, async () => {
                const res = await login(pwd);
                expect(res.statusCode).toBe(401);
                expect(res.headers['set-cookie']).toBeUndefined();
            });
        }

        // --- 2. OK : First 'secret' login (200 + Next-Password) ---
        it('OK: First "secret" login -> 200 & Sets X-Next-Password', async () => {
            const res = await login(MAGIC_PASSWORD);
            expect(res.statusCode).toBe(200);
            expect(res.headers['set-cookie']).toBeDefined();
            expect(res.headers['x-next-password']).toBeDefined();
            nextPassword = res.headers['x-next-password'];
        });

        // --- 3. OK : 'secret' renewal (200 + New Next-Password) ---
        it('OK: Second "secret" login -> 200 & Renews X-Next-Password', async () => {
            const res = await login(MAGIC_PASSWORD);
            expect(res.statusCode).toBe(200);
            expect(res.headers['set-cookie']).toBeDefined();
            expect(res.headers['x-next-password']).toBeDefined();
            // The new token must be different
            expect(res.headers['x-next-password']).not.toBe(nextPassword);
            nextPassword = res.headers['x-next-password']; // Store the new token
        });

        // --- 4. OK : Using X-Next-Password (200 + Cookie) ---
        it('4. OK: Use X-Next-Password -> 200 & Clears token from database', async () => {
            const res = await login(nextPassword);
            expect(res.statusCode).toBe(200);
            expect(res.headers['set-cookie']).toBeDefined();
            expect(res.headers['x-next-password']).toBeDefined(); // The value is returned
            // The value is kept for re-use check right after.
        });

        // --- 5. OK : Re-using the token (Checking resilience/second use) ---
        it('5. OK: Re-using the X-Next-Password token -> 200', async () => {
            const res = await login(nextPassword);
            expect(res.statusCode).toBe(200);
            expect(res.headers['set-cookie'][0]).toMatch(/^test=/);
            cookie = res.headers['set-cookie'][0].match(/^test=([^;]+)/)[1];
        });

        // --- 6. KO : Final check for invalid cases (401) ---
        for (const pwd of BAD_PASSWORDS) {
            it(`should return 401 for password: ${pwd}`, async () => {
                const res = await login(pwd);
                expect(res.statusCode).toBe(401);
                expect(res.headers['set-cookie']).toBeUndefined();
            });
        }

        it ('User found with cookie', async() => {
            const res = await whoami(cookie);
            expect(res.statusCode).toBe(200);
            expect(res.body.login).toBe(LOGIN_USER);
        });

    });
}
