"""Serves the wiki module's own static assets (CSS/JS)."""
from flask import Blueprint

wiki_assets = Blueprint(
    'wiki_assets', __name__,
    static_folder='static', static_url_path='/wiki/static',
)
