async function init(){


const express = require('express');
const app = express();
const port = 3000;

const pg = require('pg');
const db = new pg.Pool({
    host: 'localhost',
    port: 5432,
    database: 'test',
    user: 'testuser',
    password: 'testpass',
});

const hauthParams = {
  // Refer to the README file for the description of the params
  //cookiename: 'hauth', // optional, default value is 'hauth'
  hroles: ['admin', 'user', 'installer', 'terminal'],
  husers: [
    {"login": "admin", "name": "Administrator", "role": "admin", "next_password": "admin"},
    {"login": "vcount", "name": "Camera", "role": "terminal", "next_password": "secret"},
    {'login': 'conmeo', 'name': 'Installer', 'role': 'installer', 'next_password': 'conmeo'}
  ],
  accessRules: {
    '/skip': 'skip',
    '/allow': 'allow',
    '/deny': 'deny',
    '/reserved': ['admin']
  },
  errorPage: {
    login: __dirname + '/static/login.html',
    forbidden: __dirname + '/static/forbidden.html'
  }
};

/* TODO: remplacer './lib/index.js' par '@horanet/hauth' */
const hauth = await require('../lib/index.js')(hauthParams, db);

// Home page
app.use('/$', function(req, res) {res.redirect('/hadmin')});

/* function hauth.getCookie. */
app.use('/hauth/login', hauth.getCookie);

/* function hauth.delCookie. */
app.use('/hauth/logout', hauth.delCookie);

/* function hauth.control */
app.use('/', hauth.control);

app.get('/', (req, res) => {
  // res.send('Welcome to the hauth authentication page!')
  
  res.sendFile(hauthParams.errorPage.login)
})

app.listen(port, () => {
  console.log(`Example server listening at http://localhost:${port}`)
})
}

init();