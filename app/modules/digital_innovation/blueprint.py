"""Serves the digital_innovation module's own static assets (CSS/JS)."""
from flask import Blueprint

digital_innovation_assets = Blueprint(
    'digital_innovation_assets', __name__,
    static_folder='static', static_url_path='/digital_innovation/static',
)
