const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

module.exports = async function(config, db) {

  /* complete config with default values */
  const cfg = { ...{
    cookiename: 'hauth',
    jwt_key: pwgen(), // key used for signing JWT: if not defined,
                      // it is randomly generated at each server startup
    jwt_alg: 'HS256', // algorithm used for signing JWT
    jwt_exp: '2h',    // expiration time for JWT, default 2 hours
  }, ...config };

  await checkTableHroles();
  await fillTableHroles(cfg.hroles);
  await checkTableHusers();
  await fillTableHusers(cfg.husers);

  /**
   * checks if a table exists in database
   */
  async function missing (name) {
    const test = await db.query(
      `SELECT count(*) FROM pg_catalog.pg_tables WHERE tablename=$1`,
      [name]
    );
    return test.rows[0].count === '0';
  }

  /**
   * checks if table 'hroles' exists in database, or create it
   */
  async function checkTableHroles() {
    if (await missing('hauth_role')) {
      console.info('Creating table hauth_role...')
      await db.query(`
        CREATE TABLE hauth_role (
          id SERIAL PRIMARY KEY,
          name VARCHAR(20) NOT NULL,
          UNIQUE (name)
        )`
      );
    }
  }

  /**
   * checks and create if table 'husers' does not exist in database
   */
  async function checkTableHusers() {
    console.log('checking table hauth_user')
    if (await missing('hauth_user')) {
      console.info('Creating table hauth_user...')
      await db.query(`
        CREATE TABLE hauth_user (
          id SERIAL PRIMARY KEY,
          login VARCHAR(50) NOT NULL,
          name VARCHAR(100),
          hrole_id INTEGER REFERENCES hauth_role (id) ON DELETE SET NULL ON UPDATE CASCADE,
          password VARCHAR(100),
          next_password VARCHAR(100),
          UNIQUE (login)
        )`
      );
      // await db.query( // creates account 'admin' with password 'admin' and role 'admin'
      //   `INSERT INTO hauth_user (login, next_password, hrole_id)
      //    VALUES ('admin','admin',(SELECT id FROM hauth_role WHERE name='admin'))
      //    ON CONFLICT DO NOTHING`
      // );
    }
  }

  async function fillTableHroles(hauth_role) {
    const roles = await db.query(`SELECT name FROM hauth_role`);
    newRoles = hauth_role.filter( (newRole) => !roles.rows.map((x) => x.name).includes(newRole) );
    if (newRoles.length) {
      var i=1;
      const dollars = newRoles.map((x) => `($${i++})`).join(',');
      await db.query(`INSERT INTO hauth_role (name) VALUES ${dollars} ON CONFLICT DO NOTHING`, newRoles);
    }
  }

  /**
   * Create default accounts in table hauth_user as defined in hauth.conf
   */
   async function fillTableHusers(husers) {
     const tableName = 'hauth_user';
     const users = await db.query(`SELECT name FROM ${tableName}`);
     newUsers = husers.filter( (newUser) => !users.rows.map((x) => x.name).includes(newUser) );
     
     console.log(newUsers)
     if (newUsers.length) {
      var queryString = `INSERT INTO ${tableName} (login, next_password, name, hrole_id) VALUES ($1, $2, $3, (SELECT id FROM hauth_role WHERE name=$4)) ON CONFLICT DO NOTHING RETURNING *`;
      for (var i=0; i < newUsers.length; i++){
        newUser = newUsers[i];
        values = [newUser['login'], newUser['next_password'], newUser['name'], newUser['role']]
        console.log(">>>>>", values);
        await db.query(queryString, values, (err, res) =>{
          if (err) { console.debug('db.query():', err) }
          // if (res) { console.debug('db.query():', res) }
        });
          console.log("inserted 1 line....")
        }
    }
    console.log("DONE")
    }

  /**
   * runs authentication and access control
   */
  async function control (req, res, next) {
    const rule = getRule(req.path);
    if (rule === 'skip') {
      next();
    } else {
      req.rule = rule;
      if (req.user || checkToken(req) || await checkUser(req, res)) {
        if (allowed(req.user.hrole, req.path, req.rule)) {
          next();
        } else {
          res.status(403).sendFile(config.errorPage.forbidden);
        }
      } else {
        res.status(401).sendFile(config.errorPage.login);
      }
    }
  }

  /**
   * returns access rule for this URL, according to config
   */
  function getRule(url) {
    for (const [pattern, rule] of Object.entries(cfg.accessRules)) {
      if (pattern instanceof RegExp ? pattern.test(url) : url.startsWith(pattern)) {
        return rule
      }
    }
  }

  /** Fonction allowed(role, url, [rule]):
   * retourne true si un utilisateur de rôle <role> est autorisé à accéder à <url>
   * paramètre optionnel rule : pour éviter de recalculer la règle d'accès si elle a déjà été calculée
   */
  function allowed(role, url, rule) {
    rule = rule || getRule(url);
    if (!rule || rule === 'deny') {
      return false;
    } else if (rule === 'allow' || rule === 'skip') {
      return true;
    } else if (Array.isArray(rule)) {
      return rule.includes(role) ? true : false;
    }
    console.error(`invalid access rule "${rule}" for URL ${url} in hauth config`);
    return false;
  }

  /** fonction checkToken :
   * valide le JWT envoyé par le client dans un cookie,
   * et ajoute à la requête les infos sur l'utilisateur présentes dans ce JWT
   */
  function checkToken(req) {
    const token = req.cookies[cfg.cookiename];
    if (token) {
      try {
        req.user = jwt.verify(token, cfg.jwt_key, {algorithms: cfg.jwt_alg});
        return true;
      } catch (error) {
      }
    }
  }

  /** fonction checkUser :
   * valide ou non les credentials présentés
   */
  async function checkUser(req, res) {
    const [login, pwd] = getUserAndPwdFromReq(req);
    if (login && pwd !== undefined) { // le mot de passe peut être ''
      var [user, dbPwd, nextPwd] = await getUserAndPwdFromDb(login);
      if (user) {
        if (dbPwd && (pwd === dbPwd || await bcrypt.compare(pwd, dbPwd))) {
          req.user = user;
          if (nextPwd) {
            res.set('X-Next-Password', nextPwd);
          }
          return true;
        }
        if (pwd === nextPwd) {
          req.user = user;
          await updatePwd(login, pwd);
          return true;
        }
        console.warn(`Attempt to login as ${login} with bad password`);
      } else { // login inconnu
        if (cfg.autocreate) {
          user = await cfg.autocreate(login, pwd, db);
          if (user) {
            req.user = user;
            user.next_password = pwgen(); // génération d'un mot de passe
            res.set('X-Next-Password', user.next_password);
            await createUser({...user});
            return true;
          }
        }
        console.warn(`Attempt to login as ${login}, but this login is unknown`)
      }
    }
    return false;
  }

  function addUser(req,res){
    res.send("Add user...")
  }

  function modUser(req, res){
    res.send("Modify user...")

  }

  function delUser(req, res){
    res.send("Delete user...")
  }

  /** fonction getUserAndPwdFromReq :
   * extrait login et mot de passe, soit du corps de la requête,
   * soit de l'en-tête de requête HTTP 'Authorization: Basic xxx'
   */
  function getUserAndPwdFromReq(req) {
    const authz = req.headers.authorization;
    if (authz && authz.startsWith('Basic ')) {
      const value = Buffer.from(authz.split(' ')[1], 'base64').toString('utf-8');
      return value.includes(':') ? value.split(':') : [];
    } else {
      return req.body ? [req.body.login, req.body.password] : [];
    }
  }

  /** fonction getUserAndPwdFromDb :
   * extrait de la table husers les données sur l'utilisateur (sauf le mot de passe),
   * le mot de passe et (le cas échéant) le next_password
   */
  async function getUserAndPwdFromDb(login) {
    const query = "SELECT husers.*, hroles.name as hrole FROM husers LEFT JOIN hroles ON hrole_id=hroles.id WHERE login=$1";
    const users = await db.query(query, [login]);
    if (users.rowCount) {
      const user = users.rows[0];
      const [pwd, nextPwd] = [user.password, user.next_password];
      delete user.password;
      delete user.next_password;
      delete user.hrole_id;
      return [user, pwd, nextPwd];
    } else {
      return [];
    }
  }

  async function updatePwd(login, pwd) {
    const hash = await bcrypt.hash(pwd, 10);
    await db.query(`UPDATE husers SET password=$2, next_password=NULL WHERE login=$1`, [login, hash]);
  }

  async function createUser(user) {
    const hrole = user.hrole;
    delete user.hrole;

    var cols = Object.keys(user).join(',');
    var vals = Object.values(user);
    var i = 1;
    var dols = vals.map((x) => `$${i++}`).join(',');

    if (hrole) {
      cols += ',hrole_id';
      dols += `,(SELECT id FROM hroles WHERE name='${hrole}')`
    }
    await db.query(`INSERT INTO husers(${cols}) VALUES (${dols})`, vals);
  }

  /** Fonction pwgen :
   * retourne une chaîne pseudo-aléatoire de 10 caractères parmi [0-9a-z]
   */
  function pwgen() {
    return Math.random().toString(36).substring(2, 12);
  }

  async function getCookie(req, res) {
    res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate');
    if (await checkUser(req, res)) {
      const token = jwt.sign(req.user, cfg.jwt_key, {algorithm: cfg.jwt_alg, expiresIn: cfg.jwt_exp});
      res.cookie(cfg.cookiename, token, {httpOnly: true});
      res.status(200).send(req.user);
    } else {
      res.status(401).send();
    }
  };

  function delCookie(req, res) {
    res.clearCookie(cfg.cookiename);
    res.send();
  };

  return {
    control: control,
    allowed: allowed,
    getCookie: getCookie,
    delCookie: delCookie,
    getUserAndPwdFromDb: getUserAndPwdFromDb,
    addUser: addUser,
    delUser: delUser,
    modUser: modUser,
  };

}
