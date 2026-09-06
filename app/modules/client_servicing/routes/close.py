"""
Client Servicing — closing a project. Closing is CS-owned and final: it
stamps closed_at on the ClientServicing row and never touches Project.

A cancelled project answers the invoicing question first, so its close
carries invoice_needed and, when it has been invoiced, the invoice date.
"""
from datetime import date, datetime

from flask import request, jsonify, abort
from flask_login import login_required

from app.modules.core.shared.extensions import db
from app.modules.core.shared.lib.utils import log_activity
from app.modules.core.shared.models import Project

from app.modules.client_servicing.models import ClientServicing
from app.modules.client_servicing.lib.access import (
    can_access_client_servicing, can_close_projects, _effective_user,
)
from app.modules.client_servicing.routes.blueprint import client_servicing_bp


@client_servicing_bp.route('/<int:project_id>/close', methods=['POST'])
@login_required
def close_project(project_id):
    """Close one project. invoice_needed is None for a normal close and a
    bool for a cancelled one; an invoice_date alongside a True answer means
    it has already been invoiced."""
    actor = _effective_user()
    if not can_access_client_servicing(actor) or not can_close_projects(actor):
        abort(403)

    project = Project.query.get_or_404(project_id)
    cs = project.client_servicing
    if cs is not None and cs.closed_at is not None:
        return jsonify({'error': 'That project is already closed.'}), 409

    data = request.get_json(silent=True) or {}
    invoice_needed = data.get('invoice_needed')
    if invoice_needed is not None and not isinstance(invoice_needed, bool):
        return jsonify({'error': 'Answer the invoicing question first.'}), 400
    if project.cancelled_at is not None and invoice_needed is None:
        return jsonify({'error': 'Answer the invoicing question first.'}), 400

    invoice_date = None
    raw_date = (data.get('invoice_date') or '').strip()
    if raw_date:
        if not invoice_needed:
            return jsonify({'error': 'Only an invoiced project takes an invoice date.'}), 400
        try:
            invoice_date = date.fromisoformat(raw_date)
        except ValueError:
            return jsonify({'error': 'Enter a valid invoice date.'}), 400

    if cs is None:
        cs = ClientServicing(project_id=project.id)
        db.session.add(cs)
    cs.closed_at = datetime.utcnow()
    cs.closed_by_id = actor.id
    cs.invoice_needed = invoice_needed
    if invoice_date is not None:
        cs.invoice_date = invoice_date
    db.session.commit()

    verb = 'closed out the cancelled project' if project.cancelled_at else 'closed the project'
    log_activity(
        action='client_servicing_close',
        description=f'{actor.name} {verb} in Client Servicing',
        user=actor,
        entity_type='project',
        entity_name=project.name,
        entity_id=project.id,
    )
    return jsonify({'status': 'ok'})
