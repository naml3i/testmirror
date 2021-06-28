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
  //cookiename: 'hauth', // optional, default value is 'hauth'
  roles: ['role1', 'role2'],
  accessRules: {
    /* TODO: translate into english
     * directives de contrôle d'accès par URL, au format :
           URL: <mot-clé ou liste de profils autorisés>
    URL est soit une regex qui doit correspondre au path de l'URL demandée, soit une
    chaîne qui doit correspondre au début de l'URL demandée (=> query string ignorée).
    Les mots clés sont
    - allow : accès autorisé à tous les utilisateurs authentifiés
    - deny : accès interdit
    - skip : accès autorisé sans authentification ()
    Les règles sont testées dans l'ordre, on arrête à la première qui matche. */
    '/skip': 'skip',
    '/allow': 'allow',
    '/deny': 'deny',
    '/reserved': ['role1']
  },
  errorPage: {
    login: __dirname + 'login.html'
  }
};

/* TODO: remplacer './lib/index.js' par '@horanet/hauth' */
const hauth = require('./lib/index.js')(hauthParams, db);

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})
