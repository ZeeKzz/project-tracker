"""Serves the file_templates module's own static assets (CSS/JS)."""
from flask import Blueprint

file_templates_assets = Blueprint(
    'file_templates_assets', __name__,
    static_folder='static', static_url_path='/file_templates/static',
)
