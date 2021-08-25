# hauth: authentication, authorization and accounting module for web apps with PG database

This `hauth` package provides secured client password-based authentication so that express-based web applications can reuse without rewriting most frequently used authentication flows.

## Introduction

This module is aimed at authenticating web users as well as devices.
The use of this module assumes that:

- the app is powered by [express](https://www.npmjs.com/package/express)
- the app can connect to a [Postgres](https://www.postgresql.org/about/) database, and has right to create tables on that database

## Features

### Password Authentication

If a client makes a request to a path for which the app expects authentication, the app sends an `HTTP` response with a `401` status code, a reason phrase indicating an authentication error, and a `WWW-Authenticate` header.

The client can then submit login credentials in either request body, or request header using `HTTP Basic Authentication` with `Authorization` header:

```raw
Authorization: Basic login:password
```

### Role-based Access Control

Hauth manages access rules based on URLs path (without query string) and on roles. Each user can be assigned one role. Access rules look like :

```cfg
'/node_modules': 'skip',    // disable access control => no authentication required
'\.css$':        'skip',    // as same - URLs can be expressed with regex
'/app':          'allow',   // allowed to any authenticated user
'/reserved':     ['admin'], // access granted only to users with role 'admin'
'/':             'deny',    // forbid everything which is not allowed
```

By default, access is denied if no access rule matches.

### Accessing User Data

The app can retrieve user data in `req.user` field.

### Custom Login and Forbidden Pages

In case of missing credentials or access denied, Hauth will respond with 401 or 403 ; else, the response is managed by the application.

Besides, it is possible to manage custom 401 or 403 response, for example in order to provide an authentication form or a "Forbidden" page.

### Session Storage

- User data are stored in a [JSON Web Token](https://en.wikipedia.org/wiki/JSON_Web_Token) (JWT), so the session data is stored only on client's side, and not in the database.
- Ability to configure JWT key, algorithm and expiration time
- It is advised to set a JWT key: indeed, if not set a random key is computed at each server startup, so after each startup, JWT previously delivered are not valid anymore and users must reauthenticate.

### Passwords Stored Hashed

Salted passwords are hashed using [bcrypt](https://www.npmjs.com/package/bcrypt),
an implementation of OpenBSD Blowfish password hashing algorithm.

The computation cost of `bcrypt` algorithm is parametized, which means it can be increased to adapt to future hashing power improvements in case of brute-force attacks. This most important property of `bcrypt` makes it the recommeded hashing algorithm to hash user's password.

### Force Password Change at Next Login

Intended for devices, in case we need to change password (which the device uses to authenticate itself with the app) for security reasons.
The module can generate the `Next-Password`, and the app will include this `Next-Password` in the response header after a sucessfull authentication, from the next time, the device must use this `Next-Password` to authenticate.

### Account Management

Users can be added, deleted, modified (updating its role, name, changing password, etc.) easily via the exposed functions.

### Automatic Account Generation

User accounts can be generated and their details are filled properly in the `hauth_user` and `hauth_role` by defining in the configuration.

### Default Accounts

The default user accounts are created only at the first use of the module, right after the creation of `hauth_user` and `hauth_role` tables, so we always have default accounts ready to log in (to avoid the situation where there is no account). These accounts can be deleted after.

## Usage

Create an express app, `require` the module `hauth`, `init` it with `db` and `config` parameters, and enjoy!

```js
const express = require('express');
const app = express();

const pg = require('pg');
const db = new pg.Pool( /* PG params */ );
const config = { /* cf doc below */ };
const hauth = require('@horanet/hauth');
hauth.init(config, db);

app.use('/hauth/login', hauth.getCookie);
app.use('/hauth/logout', hauth.delCookie);
app.use('/', hauth.control);

app.use( /* app code */ );
app.listen(port, () => { /* ... */ });
```

For more features, look at the example provided.

### PG tips

Assume the database parameters are as follows:

```cfg
host: 'localhost',
port: 5432,
database: 'test',
user: 'testuser',
password: 'testpass',
```

one can create the database using `psql`:

```psql
sudo -u postgres psql
postgres=# CREATE DATABASE test;
postgres=# CREATE USER testuser WITH ENCRYPTED PASSWORD 'testpass';
postgres=# GRANT ALL PRIVILEGES ON DATABASE mydb TO testuser;
```

With the correct params to connect to the created PG database, the module will automatically creates two tables (if they do not exist): `hauth_user` and `hauth_role`.

## Config parameters

Module `hauth` takes in two sets of parameters:

```javascript
const hauth = require('@horanet/hauth');
hauth.init(params, db);
```

where `db` is a database handle, for example

```js
const db = new pg.Pool({
  host: 'localhost',
  port: 5432,
  database: 'test',
  user: 'testuser',
  password: 'testpass'
});
```

and `params` is an object containing the configuration parameters (all optional) :

### `cookiename`

the default value is `hauth`

### JWT parameters

as defined in [jsonwebtoken](https://www.npmjs.com/package/jsonwebtoken) module

- `jwt_key`: key used to cipher JSON web tokens, optional ; if not defined,randomly generated at each server startup
- `jwt_alg`: algorithm used for signing JWT, default value is `HS256`
- `jwt_exp`: expiration time for JWT, default `2h` for 2 hours

### `roles`

an array with the name of the roles. Each user can be assigned one role granting access to some URLs according to `accessRules`. For example, `roles = ['admin', 'basic_user']`

### `accessRules`

dictate the behavior of the control function, according to the URLs, with the following format:

```config
<pattern>: <keyword> or <list of accepted profiles> 
```

where `pattern` is:

- a path, matching the starting of the request path (hence, starting with `/`), e.g. `'/files/'`
- or a [regex](https://en.wikipedia.org/wiki/Regular_expression) string matching a part of the request path, e.g. `'\.css$'` (a pattern is recognized as a regex by the fact that it does not start with `/`)

The keywords are:

- `allow`: allowed access to any authenticated user
- `deny`: access forbidden
- `skip`: allowed access without authentication

These rules are tested in the order they are listed, until a rule matches.

If no access rule matches the URL, the default rule is `allow`. So, in order to forbid anything that is not explicitly allowed, you should end the access rules with the rule `'/': 'deny'`

### `on401`

A function to provide custom response if user authentication is required (typically used to send an authentication form)
### `on403`

A function to provide custom response in case of access denied
### `autocreate`

A function to make possible for an unregistered client to create its own accounts. If this function is defined, if an unknown client provides username and password in an 'Authorization: Basic' header, it makes it possible to check the credentials and to run some more code; if this function returns a non-null object describing an account, Hauth will create the account in hauth_user and deliver a new password (in a 'X-Next-Password' Header).

For example

```js
  autocreate: async function(login, pwd, db) {
    if (pwd === 'secret') { // this magic password allows to create any admin account
      await db.query('INSERT INTO ...'); // you can add some extra processing
      return {login: login, name: login, role: 'admin'}
    }
  }
```

### `defaultUsers`

An array of users to be created along with tables hauth_users and hauth_roles. This is intended for initing apps; These accounts can then be modified or deleted, and will not be recreated at each server startup.

## APIs

This `hauth` module exposes the following functions:

### init

Initialize the module. This function takes in the `config` and `db` parameters ; it creates the two tables `hauth_role` and `hauth_user` if necessary (and thus fills the default users), then fill in the `roles` defined in `config`.

### control

Runs authentication and access control

### allowed

Function allowed(role, url): this function return `True` if a user with rule `<rule>` is authorized to access `<url>`.

### getCookie

Sign and verify token using `jsonwebtoken` module.

### delCookie

Delete cookie when the current user logs out.

### addUser

Add a single user to table `hauth_user`

- Input parameter `user`: a JSON object containing user's information. For example:

```config
{"login": "admin", "name": "Administrator", "role": "admin", "password": "admin"}
```

- Not all information are required, if a required field is missing, default information will be filled.

### delUser

Delete a user from table `hauth_user`:

- Input parameter `user`: a JSON object containing user's information
- Require field: `user.login`
- User with `login` will be deleted
- Return `pass` value: `true` in case the `DELETE` query was succesfull, `false` otherwise.

### modUser

Modify existing user in table `hauth_user`:

- Input parameter `user`: a JSON object containing user's information
- Require field: `user.login`
- Information of user with `login` will be updated according to the input fields
- Return `pass` value: `true` in case the `UPDATE` query was succesfull, `false` otherwise.

## Example

To run the example (the script located in `./example/index.js`):

```shell
npm install
npm run example
```

To check the currently logged in user, use the path `localhost:3000/whoami`

## Test

## FAQ
