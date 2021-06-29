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
  roles: ['admin', 'installer', 'terminal'],
  accessRules: {
    '/skip': 'skip',
    '/allow': 'allow',
    '/deny': 'deny',
    '/reserved': ['admin']
  },
  errorPage: {
    login: __dirname + 'login.html'
  }
};

/* TODO: remplacer './lib/index.js' par '@horanet/hauth' */
const hauth = require('../lib/index.js')(hauthParams, db);

app.get('/', (req, res) => {
  res.send('Welcome to the hauth authentication page!')
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})
}

init();