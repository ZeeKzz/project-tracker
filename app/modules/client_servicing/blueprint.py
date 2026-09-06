"""Serves the client_servicing module's own static assets (CSS/JS)."""
from flask import Blueprint

client_servicing_assets = Blueprint(
    'client_servicing_assets', __name__,
    static_folder='static', static_url_path='/client_servicing/static',
)
