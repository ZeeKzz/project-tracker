"""
Client Servicing field edits — one PATCH endpoint, cell by cell.

CS-only fields write straight to the project's ClientServicing row. Writeback
fields (job number, CS lead, owner, SPOC, install date, value, due date) go
through projects/services/mutations.py, so they raise the same notifications
and activity-log entries as a Projects-overlay edit — on a broader permission
(any CS/management/admin user).
"""
from datetime import date
from decimal import Decimal, InvalidOperation

from flask import request, jsonify, abort
from flask_login import login_required

from app.modules.core.shared.extensions import db
from app.modules.core.shared.models import Project, User

from app.modules.projects.services import mutations as project_mutations

from app.modules.client_servicing.models import ClientServicing, ClientServicingScope
from app.modules.core.shared.lib.capabilities import can, effective_user
from app.modules.client_servicing.lib.access import require_cs
from app.modules.client_servicing.lib.status import (
    effective_cs_status, cs_design_indicator, CS_STATUS_OPTIONS,
)
from app.modules.client_servicing.lib.calendar import effective_risk, RISK_OPTIONS
from app.modules.client_servicing.lib.months import parse_month, format_month
from app.modules.client_servicing.routes.blueprint import client_servicing_bp
from app.modules.client_servicing.routes.table import _serialize_person


class _FieldError(ValueError):
    """Raised by a field parser for a value that fails validation — the
    message is shown back to the user as-is."""


def _text_parser(max_len):
    def parse(value):
        if value is None:
            return None
        text = str(value).strip()
        if not text:
            return None
        if len(text) > max_len:
            raise _FieldError(f'must be {max_len} characters or fewer')
        return text
    return parse


def _parse_date(value):
    if value in (None, ''):
        return None
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        raise _FieldError('must be a valid date')


def _parse_qty(value):
    if value in (None, ''):
        return None
    try:
        n = int(value)
    except (TypeError, ValueError):
        raise _FieldError('must be a whole number')
    if n < 1:
        raise _FieldError('must be at least 1')
    return n


def _parse_money(value):
    if value in (None, ''):
        return None
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise _FieldError('must be a number')
    if amount < 0:
        raise _FieldError('must not be negative')
    return amount


_VALIDATION_VALUES = {'valid', 'pending', 'no_lpo', 'overdue'}


def _parse_bool(value):
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in ('true', '1', 'yes', 'on')


def _parse_validation(value):
    if value in (None, ''):
        return None
    text = str(value).strip().lower()
    if text not in _VALIDATION_VALUES:
        raise _FieldError('must be a valid status')
    return text


def _parse_invoice_month(value):
    """The month picker sends YYYY-MM; anything a person pasted goes through
    the same reader the migration used."""
    if value in (None, ''):
        return None
    parsed = parse_month(value)
    if parsed is None:
        raise _FieldError('must be a month')
    return parsed


def _parse_scope_id(value):
    if value in (None, ''):
        return None
    try:
        scope_id = int(value)
    except (TypeError, ValueError):
        raise _FieldError('must be a valid scope')
    if not ClientServicingScope.query.filter_by(id=scope_id, active=True).first():
        raise _FieldError('must be a valid scope')
    return scope_id


# field name -> parser(raw_json_value) -> stored value (or raises _FieldError).
# CS-only fields only — see module docstring.
_EDITABLE_FIELDS = {
    'lpo': _text_parser(120),
    'store_location': _text_parser(255),
    'removal_date': _parse_date,
    'invoice_month_date': _parse_invoice_month,
    'cost_to_client': _parse_money,
    'inward_cost': _parse_money,
    'scope_id': _parse_scope_id,
    'priority': _text_parser(120),
    'next_action': _text_parser(255),
    'action_owner': _text_parser(120),
    'install_qty': _parse_qty,
    'lpo_date': _parse_date,
    'invoice_number': _text_parser(120),
    'invoice_date': _parse_date,
    'invoice_amount': _parse_money,
    'gr_received': _parse_bool,
    'invoice_uploaded': _parse_bool,
    'validation_status': _parse_validation,
}

# Finance/master-control fields — gated on edit_finance, a NARROWER
# capability than page access, same gate as the Invoicing tab.
_FINANCE_FIELDS = {
    'lpo_date', 'invoice_number', 'invoice_date',
    'invoice_amount', 'gr_received', 'invoice_uploaded', 'validation_status',
}


def _display_value(field, value):
    if value is None:
        return None
    if field == 'removal_date':
        return value.strftime('%d %b %Y')
    if field in ('cost_to_client', 'inward_cost'):
        return '{:,.2f}'.format(value)
    if field == 'scope_id':
        scope = ClientServicingScope.query.get(value)
        return scope.name if scope else None
    if field == 'invoice_month_date':
        return format_month(value)
    if field in ('lpo_date', 'invoice_date'):
        return value.strftime('%d %b')
    if field == 'invoice_amount':
        return '{:,.0f}'.format(value)
    return value


def _display_detail_value(field, value):
    if value is None:
        return None
    if field in ('installation_date', 'first_output_deadline'):
        return value.strftime('%d %b %Y')
    if field == 'value':
        return '{:,.0f}'.format(value)
    if field == 'contact_id':
        from app.modules.core.shared.models import Contact
        contact = Contact.query.get(value)
        return contact.name if contact else None
    return value


def _resolve_person(value, role):
    """value is a raw user id (or '' / None to clear — neither CS lead nor
    project owner can actually be cleared, so an empty value is always a
    validation error here). Only an active user with the right role is
    ever a valid target — same rule the existing reassign/set-owner routes
    enforce."""
    if value in (None, ''):
        raise project_mutations.FieldError('is required')
    try:
        user_id = int(value)
    except (TypeError, ValueError):
        raise project_mutations.FieldError('must be a valid person')
    user = User.query.filter_by(id=user_id, role=role, is_active=True).first()
    if user is None:
        raise project_mutations.FieldError('must be a valid person')
    return user


def _save_cs_only_field(project, field, raw_value):
    parser = _EDITABLE_FIELDS[field]
    try:
        value = parser(raw_value)
    except _FieldError as e:
        return None, str(e)

    cs = project.client_servicing
    if cs is None:
        cs = ClientServicing(project_id=project.id)
        db.session.add(cs)
    setattr(cs, field, value)
    db.session.commit()

    return jsonify({
        'field': field,
        'value': _display_value(field, value),
        'margin_percent': cs.margin_percent,
    }), None



_CS_STATUS_SET = set(CS_STATUS_OPTIONS)

def _save_cs_status(project, raw_value):
    """Manual operational-status overlay. Stores on the CS row only —
    never Project.project_status. An empty value clears it back to the
    derived status. Returns the recomputed effective status so the cell
    can re-render pill + indicator chips + the auto hint."""
    value = (raw_value or '').strip()
    if value and value not in _CS_STATUS_SET:
        return None, 'must be a valid status'
    cs = project.client_servicing
    if cs is None:
        cs = ClientServicing(project_id=project.id)
        db.session.add(cs)
    cs.cs_status = value or None
    db.session.commit()

    label, modifier, is_auto = effective_cs_status(project)
    indicators = cs_design_indicator(project) if (is_auto and label == 'In Design') else []
    return jsonify({
        'field': 'cs_status',
        'value': cs.cs_status or '',
        'status': {'label': label, 'modifier': modifier, 'is_auto': is_auto, 'indicators': indicators},
    }), None


_RISK_SET = set(RISK_OPTIONS)

def _save_cs_risk(project, raw_value):
    """Manual installation-risk override. Stores on the CS row only; empty
    clears it back to the derived risk. Returns the recomputed effective
    risk so the calendar cell can re-render."""
    value = (raw_value or '').strip()
    if value and value not in _RISK_SET:
        return None, 'must be a valid risk'
    cs = project.client_servicing
    if cs is None:
        cs = ClientServicing(project_id=project.id)
        db.session.add(cs)
    cs.risk = value or None
    db.session.commit()
    label, modifier, is_auto = effective_risk(project)
    return jsonify({
        'field': 'risk',
        'value': cs.risk or '',
        'risk': {'label': label, 'modifier': modifier, 'is_auto': is_auto},
    }), None


@client_servicing_bp.route('/<int:project_id>', methods=['PATCH'])
@login_required
@require_cs
def update_field(project_id):
    # Resolved once and reused for the finance check and every mutation call
    # below — an admin previewing the page while emulating someone else has
    # the resulting notification/activity-log entry attributed to that
    # person, not to the real admin.
    actor = effective_user()

    project = Project.query.get_or_404(project_id)
    data = request.get_json(silent=True) or {}
    field = data.get('field')
    raw_value = data.get('value')

    if field in _FINANCE_FIELDS and not can('edit_finance', actor):
        abort(403)

    if field == 'cs_status':
        response, error = _save_cs_status(project, raw_value)
        if error:
            return jsonify({'error': error}), 400
        return response

    if field == 'risk':
        response, error = _save_cs_risk(project, raw_value)
        if error:
            return jsonify({'error': error}), 400
        return response

    if field in _EDITABLE_FIELDS:
        response, error = _save_cs_only_field(project, field, raw_value)
        if error:
            return jsonify({'error': error}), 400
        return response

    try:
        if field == 'cs_lead_id':
            new_lead = _resolve_person(raw_value, 'cs')
            project_mutations.reassign_cs_lead(project, new_lead, actor)
            # 'person' lets the table show the avatar chip immediately
            # instead of plain text, same as a live-refresh would.
            return jsonify({'field': field, 'value': new_lead.name, 'person': _serialize_person(new_lead)})

        if field == 'project_owner_id':
            new_owner = _resolve_person(raw_value, 'project_owner')
            project_mutations.set_project_owner(project, new_owner, actor)
            return jsonify({'field': field, 'value': new_owner.name, 'person': _serialize_person(new_owner)})

        if field in project_mutations.DETAIL_FIELDS:
            saved = project_mutations.save_detail_field(project, actor, field, raw_value)
            return jsonify({'field': field, 'value': _display_detail_value(field, saved)})
    except project_mutations.FieldError as e:
        return jsonify({'error': str(e)}), 400

    return jsonify({'error': 'that field cannot be edited here'}), 400
