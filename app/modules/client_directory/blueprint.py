"""Serves the client_directory module's own static assets (CSS/JS)."""
from flask import Blueprint

client_directory_assets = Blueprint(
    'client_directory_assets', __name__,
    static_folder='static', static_url_path='/client_directory/static',
)
