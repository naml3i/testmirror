# -*- coding: utf-8 -*-
{
    # Module name in English
    'name': "Hauth",
    # Version, "odoo.min.yy.mm.dd"
    'version': '13.0.21.01.26',
    # Short description (with keywords)
    'summary': "hauth",
    'author': "Horanet",
    'website': "http://www.horanet.com/",
    # distribution license for the module (defaults: AGPL-3)
    'license': "AGPL-3",
    # Categories can be used to filter modules in modules listing. For the full list :
    # Check https://github.com/odoo/odoo/blob/master/openerp/addons/base/module/module_data.xml
    'category': 'Human Resources',

    # any module necessary for this one to work correctly. Either because this module uses features
    # they create or because it alters resources they define.
    'depends': [
    ],

    # always loaded
    'data': [
        'security/ir.model.access.csv',
        'views/hauth_user_view.xml',
        'views/menu.xml',
    ],
    # only loaded in demonstration mode
    'demo': [
    ],
    'application': True,
    'auto_install': False,
    # permet d'installer automatiquement le module si toutes ses dépendances sont installés
    # -default value set is False
    # -If false, the dependent modules are not installed if not installed prior to the dependent module.
    # -If True, all corresponding dependent modules are installed at the time of installing this module.
    'installable': True,
    # -True, module can be installed.
    # -False, module is listed in application, but cannot install them.
    # method called after the first installation of this module
}
