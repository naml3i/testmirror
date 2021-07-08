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
    '/node_modules': 'skip',    // disable access control
    '/whoami': 'allow',         // everyone can check his/her profile
    '/hello': ['admin'],        // this is a sensitive feature !
    '/': 'deny',                // forbid everything which is not allowed
  },
  on401: (req, res) => {
    if (req.accepts('html')) {
      res.sendFile(__dirname + '/static/login.html')
    } else {
      res.send();
    }
  }
};

/* TODO: remplacer './lib/index.js' par '@horanet/hauth' */
const hauth = require('../lib/index.js');

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

//Route to test hauth delUser
app.use('/api/del/user/:user_login', async (req, res) => {
  // Grab data from the URL parameters
  const user_login = req.params.user_login;
  var user = {login: user_login}
  console.log(user)
  checkresult = hauth.delUser(user)
  console.log("checkresult:", checkresult)
  res.send("done...: ");
});

//Route to test hauth MOD user
app.use('/api/mod/user/:user_login', async (req, res) => {
  // Grab data from the URL parameters
  const user_login = req.params.user_login;
  var user = {login: user_login, password: "defaultpass", name: "DEFAULT NAME", role: "user"}
  console.log("UPDATE user: ", user)
  checkresult = hauth.modUser(user_login, user)
  console.log("checkresult:", checkresult)
  res.send("done...: ");
});

/* Main directive: enables access control */
app.use('/', hauth.control);

/* App */
app.use('/hello', (req, res) => {res.send(`Hello dear ${req.user.login}`)});
app.use('/whoami', (req, res) => {res.send(req.user)});
app.use('/node_modules', express.static(path.join(__dirname, '../node_modules')));

app.listen(port, function() {
  console.log(`Hauth example server running at http://localhost:${port}`)
})
