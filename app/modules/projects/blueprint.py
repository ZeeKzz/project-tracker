"""Serves the projects module's own static assets (CSS/JS)."""
from flask import Blueprint

project_assets = Blueprint(
    'project_assets', __name__,
    static_folder='static', static_url_path='/projects/static',
)
