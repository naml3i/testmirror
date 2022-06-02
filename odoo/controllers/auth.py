# -*- coding: utf-8 -*-
from functools import wraps

import bcrypt
import random
import string

from odoo.addons.hauth.config import config
from odoo.http import Response, request


def hauthf(func):
    @wraps(func)
    def authenticate(*args, **kwargs):
        """Fonction de gestion de l'authentification des requêtes des bornes"""
        authz = request.httprequest.authorization

        if authz is not None:
            hashAndSalt = bcrypt.hashpw(authz.password.encode(), bcrypt.gensalt())
            usernameauth = request.env['hauth.user'].search([('login', '=', authz.username)])
            nextpwdauth = request.env['hauth.user'].search([('login', '=', authz.username), ('next_password', '=', authz.password)])
            nullpwds = request.env['hauth.user'].search([('login', '=', authz.username), ('password', '=', False), ('next_password', '=', False)])
            nextpwdnotnull = request.env['hauth.user'].search([('login', '=', authz.username), ('next_password', '!=', False)])
            nullpwd = request.env['hauth.user'].search([('login', '=', authz.username), ('password', '!=', authz.password)])

            if usernameauth:

                # next password authentication
                if nextpwdauth:
                    nextpwdauth.write({'password': hashAndSalt})
                    nextpwdauth.write({'next_password': False})

                # password and next password both null - lock account
                elif nullpwds:
                    return Response("", status=403)

                # correct login and password authentication
                elif bcrypt.checkpw(authz.password.encode('utf-8'), usernameauth.password.encode('utf-8')):
                    if nextpwdnotnull:
                        npwd = str(usernameauth.read(['next_password'])).split("'next_password': '")[1].split("'}")[0]
                        headers = {
                            'X-Next-Password': npwd
                        }
                        return Response(headers=headers, status=200)
                    else:
                        return Response("", status=200)

                elif nextpwdnotnull:
                    npwd = str(usernameauth.read(['next_password'])).split("'next_password': '")[1].split("'}")[0]
                    headers = {
                        'X-Next-Password': npwd
                    }
                    return Response(headers=headers, status=200)

                elif nullpwd:
                    return Response("", status=401)

            elif authz.password == config.AUTOCREATE:
                pwgen = ''.join(random.choices(string.ascii_letters + string.digits, k=10))
                user = [({
                    'login': authz.username,
                    'name': authz.username,
                    'next_password': pwgen,
                })]
                headers = {
                    'X-Next-Password': pwgen
                }
                request.env['hauth.user'].create(user)
                return Response(headers=headers, status=200)

        else:
            return Response("", status=401)

        return func(*args, **kwargs)

    return authenticate


"""def hauthinit():
    authz = request.httprequest.authorization
    pwgen = ''.join(random.choices(string.ascii_letters + string.digits, k=10))
    user = [({
        'login': authz.username,
        'name': authz.username,
        'next_password': pwgen,
    })]
    headers = {
        'X-Next-Password': pwgen
    }
    request.env['hauth.user'].create(user)
    return Response(headers=headers, status=200)"""
