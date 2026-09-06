"""Serves the achievements module's own static assets (CSS/JS)."""
from flask import Blueprint

achievements_assets = Blueprint(
    'achievements_assets', __name__,
    static_folder='static', static_url_path='/achievements/static',
)
