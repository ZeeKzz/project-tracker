"""Serves the admin module's own static assets (CSS/JS)."""
from flask import Blueprint

admin_assets = Blueprint(
    'admin_assets', __name__,
    static_folder='static', static_url_path='/admin/static',
)
