async function init(){

const express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');

const app = express();
const port = 3000;
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

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
// app.use('/$', function(req, res) {res.redirect('/hadmin')});

/* functions related to cookie */
app.use('/hauth/login', hauth.getCookie);

app.use('/hauth/logout', hauth.delCookie);

/* function related to managing users */
// TODO: rewrite function checkUser or create a new function?
app.use('/hauth/add', hauth.addUser);

app.use('/hauth/del', hauth.delUser);

app.use('/hauth/mod', hauth.modUser);


/* function hauth.control */
app.use('/', hauth.control);

app.get('/', (req, res) => {
  // res.send('Welcome to the hauth authentication page!')
  res.sendFile(hauthParams.errorPage.login)
})

app.listen(port, () => {
  console.log(`Example server running at http://localhost:${port}`)
})
}

init();