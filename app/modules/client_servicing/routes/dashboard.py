"""
Client Servicing — Dashboard section. The module's landing page and first rail
entry: the daily-standup overview. Aggregation lives in lib/dashboard.py; this
route only gates access and renders.
"""
from flask import render_template, abort
from flask_login import login_required

from app.modules.client_servicing.lib.access import can_access_client_servicing, _effective_user
from app.modules.client_servicing.lib.dashboard import dashboard_context
from app.modules.client_servicing.routes.blueprint import client_servicing_bp


@client_servicing_bp.route('/')
@login_required
def index():
    actor = _effective_user()
    if not can_access_client_servicing(actor):
        abort(403)
    return render_template('client_servicing/dashboard.html', **dashboard_context(actor))


@client_servicing_bp.route('/dashboard-panels')
@login_required
def dashboard_panels():
    """Panels fragment for the SSE live refresh — same context as the page,
    rendered on its own so client_servicing_dashboard.js can swap it in."""
    actor = _effective_user()
    if not can_access_client_servicing(actor):
        abort(403)
    return render_template('client_servicing/_dashboard_panels.html', **dashboard_context(actor))