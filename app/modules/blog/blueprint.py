"""Serves the blog module's own static assets (CSS/JS)."""
from flask import Blueprint

blog_assets = Blueprint(
    'blog_assets', __name__,
    static_folder='static', static_url_path='/blog/static',
)
