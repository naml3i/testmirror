# hauth: authentication, authorization and accounting module for web apps with PG database

This `hauth` package provides secured client-server authentication so that express-based web applications can reuse without rewriting most frequently used authentication flows.
## Introduction

## Usage

This module is used with the assumption that:

- The server is express-based
- Postgres database is installed on the system. After Postgres is installed, create a new database at local host with the following connection information:

```cfg
    host: 'localhost',
    port: 5432,
    database: 'test',
    user: 'testuser',
    password: 'testpass',
```

for example by using `psql`:

```psql
sudo -u postgres psql
postgres=# CREATE DATABASE test;
postgres=# CREATE USER testuser WITH ENCRYPTED PASSWORD 'testpass';
postgres=# GRANT ALL PRIVILEGES ON DATABASE mydb TO testuser;
```

With the correct params to connect to the created PG database, the module will automatically creates two tables (if they do not exist): `hauth_user` and `hauth_role`.

Create an express server with serveral response page according to the authentication scenarios, and `require` the module `hauth`.
## Config parameters

Module `hauth` takes in two sets of parameters:

```javascript
const hauth = require('@horanet/hauth')(params, db);
```

where `db` is the object containing the information to connect to the PG as mentioned above, and `params` is the object containing the following configurations:

- `cookiename`: optional, the default value is `hauth`
- `roles`: an array with the name of the roles. Each newly created user is assigned a role (with different privileges, or access rights to different URLs). For example, `roles = ['admin', 'user', 'installer']`
- `accessRules`: dictate the behavior of the control function, according to the URLs, with the following format:

```config
URL: <keyword> or <list of accepted profiles> 
```

where `URL` is either a [regex](https://en.wikipedia.org/wiki/Regular_expression)corresponding to the path of the input URL; or a link corresponding to the starting of the input URL (query string is ignored).

- The keywords are:
  - `allow`: allowed access to all the users authenticated
  - `deny`: access forbidden
  - `skip`: allowed access without authentication

These rules are tested in this order, and the test is stopped at the first rule that matched.

- `errorPage`: path to the error page in case of returning forbidden code (`401`, `403`, etc.)

## Functions

This `hauth` module implements the following functions:

### control

runs authentication and access control

### allowed

Fonction allowed(role, url, [rule]): this function return `True` if a user with rule `<rule>` is authorized to access `<url>`.
Optional parameter `rule`, to avoid rechecking of the access rule if it is already checked.

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
### getUserAndPwdFromDb

Extract the login:password, either in the `Body`, or in the `Header` of the HTTP request 'Authorization: Basic xxx'

## Examples

To run the example (the script located in `./example/index.js`):

```shell
npm install

npm run example
```

To check the currently logged in user, use the path `localhost:3000/whoami`

## Test

## FAQ
