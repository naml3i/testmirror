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
  //cookiename: 'hauth', // optional, default value is 'hauth'
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
};

var hauth;
try {
  hauth = require('@horanet/hauth');
}catch {
  hauth = require('../lib/index');
}

/* init Hauth with config params and database handle */
hauth.init(config, db).then(() => {
  hauth.addUser({login: 'user', password: 'password'}); // no role is defined
});

/* functions related to cookie, that should not be submitted to access control
 * => either run them before the main directive
 *          app.use('/', hauth.control)
 *    or add an accessRule
 *          /^\/hauth\/(login|logout)$/: 'skip'                 */
app.use('/hauth/login', hauth.getCookie);
app.use('/hauth/logout', hauth.delCookie);

/* The main directive: enables access control
 * Must be put before any other `app.use()` directive with access control*/
app.use('/', hauth.control);

/* Account management */
app.use('/hauth/adduser/',       async (req, res) => { res.send(await hauth.addUser(req.body)) });
app.use('/hauth/moduser/:login', async (req, res) => { res.send(await hauth.modUser(req.params.login, req.body)) });
app.use('/hauth/deluser/:login', async (req, res) => { res.send(await hauth.delUser(req.params.login)) });

/* App */
app.use('/hello', (req, res) => {res.send(`Hello dear ${req.user.login}`)});
app.use('/whoami', (req, res) => {res.send(req.user)});
app.use('/node_modules', express.static(path.join(__dirname, '../node_modules')));

app.listen(port, function() {
  console.log(`Hauth example server running at http://localhost:${port}`)
})
