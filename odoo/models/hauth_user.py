import logging
from odoo import models, fields

_logger = logging.getLogger(__name__)


class User(models.Model):
    """User login tables"""

    # region Private attributes
    _name = 'hauth.user'
    _description = "User login tables"
    # endregion

    # region Default methods
    # endregion

    # region Fields declaration
    login = fields.Char(string="Login",
                        help="Username")
    name = fields.Char(string="Name",
                       help="Account name")
    password = fields.Char(string="Password")
    next_password = fields.Char(string="Next Password",
                                help="Set automatically or by an admin")
    # endregion

    # region Fields method
    # endregion

    # region Constraints and Onchange
    # endregion

    # region CRUD (overrides)
    # endregion

    # region Actions
    # endregion

    # region Model methods
    # endregion
