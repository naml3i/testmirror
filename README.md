# hauth: authentication, authorization and accounting module for web apps with PG database

This `hauth` package provides secured client password-based authentication so that express-based web applications can reuse without rewriting most frequently used authentication flows.

## Introduction

This module is aimed at authenticating web users as well as devices.
The use of this module assumes that:

- the app is powered by [express](https://www.npmjs.com/package/express)
- the app has a [Postgres](https://www.postgresql.org/about/) database, and has right to create tables on that database

## Features

### Password Authentication

If a client makes a request to a path for which the app expects authentication, the app sends an `HTTP` response with a `401` status code, a reason phrase indicating an authentication error, and a `WWW-Authenticate` header.

The client can then submit login credentials in either request body, or request header using `HTTP Basic Authentication` with `Authorization` header:

```raw
Authorization: Basic login:password
```

### Role-based Access Control

Ability to define different roles, each user can be assigned a role. Access rules to different URLs are defined based on the roles.

### Accessing User Data

The app can retrieve user data in `req.user` field.

### Login and Error Pages

### Session Storage

- User data are stored in a [JSON Web Token](https://en.wikipedia.org/wiki/JSON_Web_Token) (JWT), so the session data is stored only on client-side, and not in the database.
- Ability to configure JWT key, algorithm and expiration time
- It is advised to set a JWT key: indeed, if not set a random key is computed at each server startup, so after each startup, JWT previously delivered are not valid anymore and users must reauthenticate.

### Passwords stored hashed

Salted passwords are hashed using [bcrypt](https://www.npmjs.com/package/bcrypt),
an implementation of OpenBSD Blowfish password hashing algorithm.

The computation cost of `bcrypt` algorithm is parametized, which means it can be increased to adapt to future hashing power improvements of brute-force attacks. This most important property of `bcrypt` makes it the recommeded hashing algorithm to hash user's password.

### Force Password Change at Next Login

Intended for devices, in case there we need to change password (which the device uses authenticate itself with the app) for security reasons.
The module can generate the `Next-Password` , and the app will include this `Next-Password` in the response header after a sucessfull authentication, from the next time, the device must use this `Next-Password` to authenticate.

### Account Management

Users can be added, deleted, modified (updating its role, changing password) easily via the exposed functions.

### Automatic Account Generation

User accounts can be generated and their details are filled properly in the `hauth_user` and `hauth_role` by defining in the configuration.

### Default accounts

The default user accounts are created only at the first use of the module, right after the creation of `hauth_user` and `hauth_role` tables, so we always have default accounts ready to log in (to avoid the situation where there is no account). These accounts can be deleted after.

## Usage

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

Create an express server with several response page according to the authentication scenarios, and `require` the module `hauth`.

## Config parameters

Module `hauth` takes in two sets of parameters:

```javascript
const hauth = require('@horanet/hauth');
hauth.init(params, db);
```

where `db` is the object containing the information to connect to the PG as mentioned above, and `params` is the object containing the following configurations:

- `cookiename`: optional, the default value is `hauth`
- JWT parameters, as defined in [jsonwebtoken](https://www.npmjs.com/package/jsonwebtoken) module
  - `jwt_key`: key used to cipher JSON web tokens, optional ; if not defined,randomly generated at each server startup
  - `jwt_alg`: algorithm used for signing JWT, default value is `HS256`
  - `jwt_exp`: expiration time for JWT, default `2h` for 2 hours

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

## APIs

This `hauth` module exposes the following functions:

### init

Initialize the module. This function takes in the `config` and `dbh`, then create the two tables `hauth_role` and `hauth_user`, then fill in the `roles` if they are defined in `config`.

### control

runs authentication and access control

### allowed

Function allowed(role, url, [rule]): this function return `True` if a user with rule `<rule>` is authorized to access `<url>`.

### getCookie

Sign and verify token using `jsonwebtoken` module

### delCookie

Delete cookie when the current user logs out.

### addUser

Add a single user to table `hauth_user`.
Input parameter `user`: a JSON object containing user's information.
For example:

```config
{"login": "admin", "name": "Administrator", "role": "admin", "password": "admin"}`
```

Not all information are required, if it is a required field but missing, default information will be filled.

### delUser

Delete a user from table `hauth_user`
Input parameter `user`: a JSON object containing user's information. Require field: `user.login`. User with `login` will be deleted.

### modUser

Modify existing user in table `hauth_user`
Input parameter `user`: a JSON object containing user's information. Require field: `user.login`. Information of user with `login` will be updated according to the input parameter.

## Example

To run the example (the script located in `./example/index.js`):

```shell
npm install

npm run example
```

To check the currently logged in user, use the path `localhost:3000/whoami`

## Test

## FAQ
