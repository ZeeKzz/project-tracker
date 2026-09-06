"""
Admin CRUD for the CS Scope option list — separate from per-row cell edits
(edit.py). Full CRUD is admin-only (Admin Panel "CS Scopes" tab); quick_add_scope
is the table's inline "+ Add scope" on the CS/management/admin gate. Scopes
deactivate rather than delete (rows keep a dropped scope), and quick-add
reactivates a deactivated name so it never returns an unusable id.
"""
from flask import request, jsonify, abort
from flask_login import login_required

from app.modules.core.shared.extensions import db
from app.modules.core.shared.lib.decorators import role_required

from app.modules.client_servicing.models import ClientServicingScope
from app.modules.client_servicing.lib.access import can_access_client_servicing, _effective_user
from app.modules.client_servicing.routes.blueprint import client_servicing_bp


def _serialize(scope):
    return {'id': scope.id, 'name': scope.name, 'active': scope.active}


@client_servicing_bp.route('/scopes', methods=['GET'])
@login_required
@role_required('admin')
def list_scopes():
    scopes = ClientServicingScope.query.order_by(ClientServicingScope.name).all()
    return jsonify([_serialize(s) for s in scopes])


@client_servicing_bp.route('/scopes', methods=['POST'])
@login_required
@role_required('admin')
def create_scope():
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Name is required'}), 400
    if ClientServicingScope.query.filter_by(name=name).first():
        return jsonify({'error': 'Already exists'}), 409

    scope = ClientServicingScope(name=name, active=True)
    db.session.add(scope)
    db.session.commit()
    return jsonify(_serialize(scope))


@client_servicing_bp.route('/scopes/<int:scope_id>', methods=['PATCH'])
@login_required
@role_required('admin')
def update_scope(scope_id):
    scope = ClientServicingScope.query.get_or_404(scope_id)
    data = request.get_json(silent=True) or {}

    if 'name' in data:
        name = (data.get('name') or '').strip()
        if not name:
            return jsonify({'error': 'Name is required'}), 400
        clash = ClientServicingScope.query.filter(
            ClientServicingScope.name == name, ClientServicingScope.id != scope.id
        ).first()
        if clash:
            return jsonify({'error': 'Already exists'}), 409
        scope.name = name

    if 'active' in data:
        scope.active = bool(data.get('active'))

    db.session.commit()
    return jsonify(_serialize(scope))


@client_servicing_bp.route('/scopes/quick-add', methods=['POST'])
@login_required
def quick_add_scope():
    # Same cs/management/admin/project_owner gate as the rest of this
    # module (not the admin-only CRUD above) — emulation-aware to match,
    # so an admin previewing as e.g. a CS user sees the same "can I add a
    # scope from here" behavior that user would actually get.
    if not can_access_client_servicing(_effective_user()):
        abort(403)

    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Name is required'}), 400

    existing = ClientServicingScope.query.filter_by(name=name).first()
    if existing:
        if not existing.active:
            existing.active = True
            db.session.commit()
        return jsonify(_serialize(existing))

    scope = ClientServicingScope(name=name, active=True)
    db.session.add(scope)
    db.session.commit()
    return jsonify(_serialize(scope))
