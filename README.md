# hauth: authentication, authorization and accounting module for web apps with PG database

This `hauth` package provides secured client password-based authentication so that express-based web applications can reuse without rewriting most frequently used authentication flows.

## Introduction

This module is aimed at authenticating web users as well as devices.

The use of this module assumes that:
- the app is express-based
- the app has a Postgres database, and has right to create tables on that database.

## Features

### Password authentication
Credentials submitted either in request body, or in request header

### Role-based access control
Ability to define several roles

### Accessing user data
The app can retrieve user data in `req.user`

### Login and error pages

### Session storage
User data are stored in a JSON web token, so only client-side, and not in database.

ability to configure JWT key, algorithm and expiration time

It is advised to set a JWT key : indeed, if not set a random key is computed at each server startup, so after each startup, JWT previously delivered are not valid anymore and users must reauthenticate.

### Passwords stored hashed
salted hash using bcrypt

### Next password
Intended for devices

### Account management

### Automatic account generation

### Default accounts


## Usage

Assume the database parameters are:

```cfg
    host: 'localhost',
    port: 5432,
    database: 'test',
    user: 'testuser',
    password: 'testpass',
```

one can create the database by using `psql`:

```psql
sudo -u postgres psql
postgres=# CREATE DATABASE test;
postgres=# CREATE USER testuser WITH ENCRYPTED PASSWORD 'testpass';
postgres=# GRANT ALL PRIVILEGES ON DATABASE mydb TO testuser;
```

With the correct params to connect to the created PG database, the module will automatically creates two tables (if they do not exist): `hauth_user` and `hauth_role`.

Create an express server with several response page according to the authentication scenarios, and `require` the module `hauth`.

## Config parameters

Module `hauth` takes in two sets of parameters:

```javascript
const hauth = require('@horanet/hauth');
hauth.init(params, db);
```

where `db` is the object containing the information to connect to the PG as mentioned above, and `params` is the object containing the following configurations:

- `cookiename`: optional, the default value is `hauth`
- jwt parameters as defined in `jsonwebtoken` module
  - `jwt_key`: key used to cipher JSON web tokens, optional ; if not defined,randomly generated at each server startup
  - `jwt_alg`: algorithm used for signing JWT, default value is 'HS256'
  - `jwt_exp`: expiration time for JWT, default '2h' for 2 hours

- `roles`: an array with the name of the roles. Each user can be assigned one role granting access to some URLs according to `accessRules`. For example, `roles = ['admin', 'basic_user']`
- `accessRules`: dictate the behavior of the control function, according to the URLs, with the following format:

```config
URL: <keyword> or <list of accepted profiles> 
```

where `URL` is either a [regex](https://en.wikipedia.org/wiki/Regular_expression) corresponding to the path of the input URL; or a link corresponding to the starting of the input URL (query string is ignored).

- The keywords are:
  - `allow`: allowed access to any authenticated user
  - `deny`: access forbidden
  - `skip`: allowed access without authentication

These rules are tested in the order they are listed, until a rule matches.

- `errorPage`: path to the error page in case of returning forbidden code (`401`, `403`, etc.)

- `autocreate`

- `defaultUsers`

## Functions

This module exposes the following functions:

### init

### control

runs authentication and access control

### allowed

Fonction allowed(role, url, [rule]): this function return `True` if a user with rule `<rule>` is authorized to access `<url>`.

### getCookie

Sign and verify token using JSON Web Token

### delCookie

Delete cookie when the current user logs out.

### addUser

Add a single user to table `hauth_user`

### delUser

Delete a user from table `hauth_user`
### modUser

Modify an existing user ()

## Examples

To run the example (the script located in `./example/index.js`):

```shell
npm install

npm run example
```

To check the currently logged in user, use the path `localhost:3000/whoami`

## Test

## FAQ
