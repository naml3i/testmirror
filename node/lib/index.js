const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

var defCfg = { // config parameters, populated with default values
    cookiename: 'hauth',
    jwt_key: pwgen(), // key used for signing JWT: if not defined,
                      // it is randomly generated at each server startup
    jwt_alg: 'HS256', // algorithm used for signing JWT
    jwt_exp: '2h',    // expiration time for JWT, default 2 hours
};
var extCfg = {};
var db;

function checkInit(fun) {
  return (...args) => {
    if (!db) throw('Hauth is not inited');
    return fun(...args);
  }
}
module.exports = {
    init: init,
    control:   checkInit(control),
    allowed:   checkInit(allowed),
    getCookie: checkInit(getCookie),
    delCookie: checkInit(delCookie),
    getUser:   checkInit(getUser),
    addUser:   checkInit(addUser),
    delUser:   checkInit(delUser),
    modUser:   checkInit(modUser),
    addRoles:  checkInit(addRoles),
    checkUser: checkInit(checkUser),
    checkToken:checkInit(checkToken)
};

async function init (config, dbh) {
  if (db) {
    console.warn('Hauth is already inited');
    return;
  }
  db = dbh;
  extCfg = config;

  await checkTableRole();
  await addRoles(cfg().roles);
  await checkTableUser();
}

function cfg() {
  return { ...defCfg, ...extCfg };
}

/**
 * check if a table exists in database
 */
async function missing (tablename) {
  const test = await db.query(
    `SELECT count(*) FROM pg_catalog.pg_tables WHERE tablename=$1`,
    [tablename]
  );
  return test.rows[0].count === '0';
}

/**
 * check if table 'hauth_role' exists, create if missing
 */
async function checkTableRole() {
  if (await missing('hauth_role')) {
    console.info('Creating table hauth_role')
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
 * check if table 'hauth_user' exists, create if missing
 */
async function checkTableUser() {
  if (await missing('hauth_user')) {
    console.info('Creating table hauth_user')
    await db.query(`
      CREATE TABLE hauth_user (
        id SERIAL PRIMARY KEY,
        login VARCHAR(50) NOT NULL,
        name VARCHAR(100),
        role_id INTEGER REFERENCES hauth_role (id) ON DELETE SET NULL ON UPDATE CASCADE,
        password VARCHAR(100),
        next_password VARCHAR(100),
        UNIQUE (login)
      )`
    );
    for (const user of cfg().defaultUsers) {
      addUser(user);
    }
  }
}

/**
 * Populate table hauth_role with roles
 * @param {*} roles: as defined in the config. E.g. ['admin', 'installer']
 */
async function addRoles(roles) {
  const existingRoles = await db.query(`SELECT name FROM hauth_role`);
  newRoles = roles.filter( (role) => !existingRoles.rows.map((x) => x.name).includes(role) );
  if (newRoles.length) {
    var i=1;
    const dollars = newRoles.map((x) => `($${i++})`).join(',');
    await db.query(`INSERT INTO hauth_role (name) VALUES ${dollars} ON CONFLICT DO NOTHING`, newRoles);
  }
}

async function parse(user) {
  const role = user.role;
  delete user.role;

  if (user.password) {
    user.password = await bcrypt.hash(user.password, 10);
  }

  var cols = Object.keys(user);
  var vals = Object.values(user);
  var i = 0;
  var dols = vals.map((x) => `$${++i}`);

  if (role) {
    cols.push('role_id');
    dols.push(`(SELECT id FROM hauth_role WHERE name=$${++i})`);
    vals.push(role);
  }
  const res = [cols.join(','), dols.join(','), vals, i];
  return [cols.join(','), dols.join(','), vals, i];
}

/**
 * Add a single user to the hauth_user
 * @param {*} user JSON object
 * @returns the new user profile if insert is successful, else null
 */
async function addUser(user) {
  var [cols, dols, vals, i] = await parse(user);
  const result = await db.query(`INSERT INTO hauth_user(${cols}) VALUES (${dols}) ON CONFLICT DO NOTHING RETURNING *`, vals);
  return result.rowCount > 0 ? result.rows[0] : null;
}

/**
 * Modify existing user
 * @param {*} login : user's or device's login ID
 * @param {*} user : object containing the fields to be updated
 * @returns the new user profile if update is successful, else null
 */
async function modUser(login, user) {
  var [cols, dols, vals, i] = await parse(user);
  if (!i) return false;
  if (i > 1) { [cols, dols] = [`(${cols})`, `(${dols})`]; }
  const result = await db.query(`UPDATE hauth_user SET ${cols} = ${dols} WHERE login=$${++i} RETURNING *`, [...vals, login]);
  return result.rowCount > 0 ? result.rows[0] : null;
}

/**
 * Delete existing user
 * @param {*} user 
 * @returns the removed user profile if delete is successful, else null
 */
async function delUser(login) {
  const result = await db.query(`DELETE FROM hauth_user WHERE login=$1 RETURNING *`, [login]);
  return result.rowCount > 0 ? result.rows[0] : null;
}

/**
 * authentication and access control (display page/error page...)
 * based on access rule of each path user
 */
async function control (req, res, next) {
  const rule = getRule(req.path);
  if (rule === 'skip') {
    next();
  } else {
    if (req.user || checkToken(req) || await checkUser(req, res)) {
      if (allowed(req.user.role, req.path, rule)) {
        next();
      } else {
        res.status(403);
        if (cfg().on403) {
          cfg().on403(req, res);
        } else {
          res.send();
        }
      }
    } else {
      res.status(401)
      if (cfg().on401) {
        cfg().on401(req, res);
      } else {
        res.send();
      }
    }
  }
}

/**
 * returns access rule for the path, based on config
 */
function getRule(url) {
  for (const [pattern, rule] of Object.entries(cfg().accessRules)) {
    if (pattern.startsWith('/') && url.startsWith(pattern) || new RegExp(pattern).test(url)) {
      return rule
    }
  }
  return 'allow';
}

/**
 * @param {*} role 
 * @param {*} url 
 * @param {*} rule optional: to avoid rechecking the access rule if it's already checked
 * @returns true if a user of role <role> is authorized to access <url>
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
  console.error(`invalid access rule "${rule}" in hauth config`);
  return false;
}

/**
 * Validate the JWT sent in the cookie
 * @param {*} req HTTP request message
 * @returns true if the JWT is verified
 */
function checkToken(req) {
  const token = req.cookies[cfg().cookiename];
  if (token) {
    try {
      req.user = jwt.verify(token, cfg().jwt_key, {algorithms: cfg().jwt_alg});
      return true;
    } catch (error) {
    }
  }
}

/**
 * Verify the credential submitted
 * @returns true or false 
 */
async function checkUser(req, res) {
  const [login, pwd] = getUserAndPwdFromReq(req);
  if (login && pwd !== undefined) { // le mot de passe peut être ''
    var [user, dbPwd, nextPwd] = await getUser(login);
    if (user) {
      if (pwd === nextPwd) {
        req.user = user;
        await updatePwd(login, pwd);
        return true;
      }
      if (dbPwd && (pwd === dbPwd || await bcrypt.compare(pwd, dbPwd))) {
        req.user = user;
        if (nextPwd) {
          res.set('X-Next-Password', nextPwd);
        }
        return true;
      }
      console.warn(`Attempt to login as ${login} with bad password`);
    } else { // login inconnu
      if (cfg().autocreate) {
        user = await cfg().autocreate(login, pwd, db);
        if (user) {
          req.user = user;
          user.next_password = pwgen(); // génération d'un mot de passe
          res.set('X-Next-Password', user.next_password);
          await addUser({...user});
          return true;
        }
      }
      console.warn(`Attempt to login as ${login}, but this login is unknown`)
    }
  }
  return false;
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

/**
 * Extract user, password and next_password (if applicable) from hauth_user
 * @param {*} login: user's login ID
 * @returns 
 */
async function getUser(login) {
  const query = "SELECT hauth_user.*, hauth_role.name as role FROM hauth_user LEFT JOIN hauth_role ON role_id=hauth_role.id WHERE login=$1";
  const users = await db.query(query, [login]);
  if (users.rowCount) {
    const user = users.rows[0];
    const [pwd, nextPwd] = [user.password, user.next_password];
    delete user.password;
    delete user.next_password;
    delete user.role_id;
    return [user, pwd, nextPwd];
  } else {
    return [];
  }
}

async function updatePwd(login, pwd) {
  const hash = await bcrypt.hash(pwd, 10);
  await db.query(`UPDATE hauth_user SET password=$2, next_password=NULL WHERE login=$1`, [login, hash]);
}

/** 
 * @returns a pseudo-random password of 10 characters [0-9 a-z]
 */
function pwgen() {
  return Math.random().toString(36).substring(2, 12);
}

async function getCookie(req, res, next) {
  res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate');
  if (await checkUser(req, res)) {
    const token = jwt.sign(req.user, cfg().jwt_key, {algorithm: cfg().jwt_alg, expiresIn: cfg().jwt_exp});
    res.cookie(cfg().cookiename, token, {httpOnly: true});
    res.status(200).send(req.user);
  } else {
    res.status(401).send();
  }
  next();
};

function delCookie(req, res, next) {
  res.clearCookie(cfg().cookiename);
  if (cfg().onLogout) {
      cfg().onLogout(req, res);
  } else {
      res.send();
  }
  next();
};

