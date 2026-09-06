"""Serves the time_tracking module's own static assets (CSS/JS)."""
from flask import Blueprint

time_tracking_assets = Blueprint(
    'time_tracking_assets', __name__,
    static_folder='static', static_url_path='/time_tracking/static',
)
