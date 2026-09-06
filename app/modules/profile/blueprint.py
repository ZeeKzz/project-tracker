"""Serves the profile module's own static assets (CSS/JS)."""
from flask import Blueprint

profile_assets = Blueprint(
    'profile_assets', __name__,
    static_folder='static', static_url_path='/profile/static',
)
