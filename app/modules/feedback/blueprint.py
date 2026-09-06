"""Serves the feedback module's own static assets (CSS/JS)."""
from flask import Blueprint

feedback_assets = Blueprint(
    'feedback_assets', __name__,
    static_folder='static', static_url_path='/feedback/static',
)
