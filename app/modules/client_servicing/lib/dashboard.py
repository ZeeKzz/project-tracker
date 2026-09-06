"""
Client Servicing dashboard aggregations — the module's landing overview.

One eager-loaded fetch of the CS project set (drafts already excluded by
_base_projects), turned into the six panels and the cross-cutting feed the
global Dashboard merges. Composes the existing helpers so no number can drift
from the Table, Calendar or Invoicing pages. Reads only; writes nothing.
Finance figures are gated by can_view_finance — page access is wider.
"""
from datetime import date, timedelta

from flask import url_for

from app.modules.client_servicing.lib.access import (
    can_access_client_servicing, can_view_finance,
)
from app.modules.client_servicing.lib.status import effective_cs_status
from app.modules.client_servicing.lib.calendar import effective_risk, build_install
from app.modules.client_servicing.lib.summary import year_summary, due_this_month
from app.modules.client_servicing.routes.table import _base_projects


# Upcoming-install horizon for the module feed, and how many rows the
# Upcoming Installs panel shows.
_FEED_INSTALL_DAYS = 7
_UPCOMING_LIMIT = 8

# Effective-status label -> lifecycle family for the Status Spread panel;
# covers both the auto-derived labels and the manual CS_STATUS_OPTIONS.
_STATUS_FAMILY = {
    'Briefing': 'In Design', 'Survey': 'In Design', 'In Design': 'In Design',
    'KV in Progress': 'In Design', 'AW in Progress': 'In Design',
    '3D in Progress': 'In Design', 'TD in Progress': 'In Design',
    'Submitted to Client': 'Pending Approval', 'Pending Approval': 'Pending Approval',
    'Pre-Production': 'Pre-Production', 'Pending Quotation': 'Pre-Production',
    'Pending LPO': 'Pre-Production', 'Pending Production': 'Pre-Production',
    'In Production': 'In Production',
    'Installed': 'Post-Install', 'Prize Distribution': 'Post-Install',
    'ED Closure': 'Post-Install',
    'Pending Invoice': 'Invoicing', 'Partial Invoicing': 'Invoicing',
    'Invoiced': 'Invoicing',
    'On Hold': 'On Hold',
}
_FAMILY_ORDER = [
    'In Design', 'Pending Approval', 'Pre-Production', 'In Production',
    'Post-Install', 'Invoicing', 'On Hold',
]

_URGENCY_RANK = {'urgent': 0, 'warning': 1, 'info': 2}


def _signal_sort(item):
    return (_URGENCY_RANK.get(item['urgency'], 3), item['date'] or date.max)


def _active(projects):
    """The board's active set — cancelled projects drop out (drafts already
    excluded upstream)."""
    return [p for p in projects if p.cancelled_at is None]


def _snapshot(active, today):
    """Status + risk resolved once per project; every panel reads this so a
    project is never re-derived."""
    snap = []
    for p in active:
        status = effective_cs_status(p)[0]
        risk = effective_risk(p, status, today)[0]
        snap.append({'p': p, 'status': status, 'risk': risk})
    return snap


# --- links -----------------------------------------------------------------

def _projects_link(project_id):
    return url_for('project_list.index', project=project_id)


def _calendar_link(d):
    return url_for('client_servicing.calendar', month='%04d-%02d' % (d.year, d.month))


def _invoicing_link(today):
    return url_for('client_servicing.invoicing_summary', year=today.year, month=today.month)


# --- panels ----------------------------------------------------------------

def _kpi_band(snap, today, show_finance, month_row):
    horizon = today + timedelta(days=7)
    installs_month = next7 = at_risk = 0
    for r in snap:
        d = r['p'].installation_date
        if d and d.year == today.year and d.month == today.month:
            installs_month += 1
        if d and today <= d < horizon:
            next7 += 1
        if r['risk'] == 'At Risk':
            at_risk += 1
    band = {
        'active': len(snap), 'installs_month': installs_month,
        'next7': next7, 'at_risk': at_risk,
    }
    if show_finance and month_row is not None:
        band['pipeline'] = month_row['pipeline']
        band['stuck'] = month_row['stuck']
    return band


def _status_spread(snap):
    counts = {fam: 0 for fam in _FAMILY_ORDER}
    for r in snap:
        fam = _STATUS_FAMILY.get(r['status'])
        if fam:
            counts[fam] += 1
    return {
        'total': sum(counts.values()),
        'families': [{'name': fam, 'count': counts[fam]} for fam in _FAMILY_ORDER],
    }


def _workload(snap):
    by_lead = {}
    for r in snap:
        lead = r['p'].cs_lead
        if not lead:
            continue
        w = by_lead.setdefault(lead.id, {'name': lead.name, 'active': 0, 'at_risk': 0})
        w['active'] += 1
        if r['risk'] == 'At Risk':
            w['at_risk'] += 1
    return sorted(by_lead.values(), key=lambda w: (-w['active'], w['name']))


def _upcoming(snap, today):
    dated = [r for r in snap if r['p'].installation_date and r['p'].installation_date >= today]
    dated.sort(key=lambda r: r['p'].installation_date)
    return [build_install(r['p'], today) for r in dated[:_UPCOMING_LIMIT]]


def _gaps(p):
    # cs_lead_id is NOT NULL on Project, so a project always has a lead —
    # the only real gaps are a missing install date or value.
    gaps = []
    if p.installation_date is None:
        gaps.append('install date')
    if p.value is None:
        gaps.append('value')
    return gaps


def _finance_signals(due, today):
    """Urgent/feed rows from the month's uninvoiced set — one source with the
    Invoicing summary tab."""
    link = _invoicing_link(today)
    items = []
    for d in due:
        validation = d.get('validation')
        if validation == 'overdue':
            kind, urgency, tag = 'invoice_overdue', 'urgent', 'Overdue'
        elif validation == 'no_lpo':
            kind, urgency, tag = 'lpo_outstanding', 'warning', 'No LPO'
        else:
            kind, urgency, tag = 'invoice_due', 'warning', 'Unbilled'
        items.append({
            'source': 'client_servicing', 'kind': kind, 'title': d['project'],
            'detail': '%s · %s' % (tag, d['client'] or '—'),
            'link': link, 'urgency': urgency, 'date': None,
        })
    return items


def _urgent_actions(snap, due, today, show_finance):
    items = []
    for r in snap:
        p = r['p']
        if r['risk'] in ('At Risk', 'Attention') and p.installation_date:
            items.append({
                'source': 'client_servicing', 'kind': 'install_risk', 'title': p.name,
                'detail': '%s · installs %s' % (r['risk'], p.installation_date.strftime('%d %b')),
                'link': _calendar_link(p.installation_date),
                'urgency': 'urgent' if r['risk'] == 'At Risk' else 'warning',
                'date': p.installation_date,
            })
        gaps = _gaps(p)
        if gaps:
            items.append({
                'source': 'client_servicing', 'kind': 'data_gap', 'title': p.name,
                'detail': 'Missing ' + ', '.join(gaps), 'link': _projects_link(p.id),
                'urgency': 'info', 'date': None,
            })
    if show_finance:
        items += _finance_signals(due, today)
    items.sort(key=_signal_sort)
    return items


def _feed_installs(snap, today):
    horizon = today + timedelta(days=_FEED_INSTALL_DAYS)
    items = []
    for r in snap:
        d = r['p'].installation_date
        if not d or not (today <= d <= horizon):
            continue
        urgency = {'At Risk': 'urgent', 'Attention': 'warning'}.get(r['risk'], 'info')
        items.append({
            'source': 'client_servicing', 'kind': 'install_upcoming', 'title': r['p'].name,
            'detail': 'Installs %s' % d.strftime('%d %b'), 'link': _calendar_link(d),
            'urgency': urgency, 'date': d,
        })
    return items


# --- public ----------------------------------------------------------------

def dashboard_context(user):
    """Everything the dashboard template needs. Finance panels are present
    only for finance viewers; the template renders what it's given."""
    today = date.today()
    show_finance = can_view_finance(user)
    snap = _snapshot(_active(_base_projects().all()), today)

    month_row = due = None
    if show_finance:
        rows, _ = year_summary(today.year)
        month_row = rows[today.month - 1]
        due = due_this_month(today.year, today.month)

    return {
        'show_finance': show_finance,
        'today': today,
        'kpis': _kpi_band(snap, today, show_finance, month_row),
        'status_spread': _status_spread(snap),
        'workload': _workload(snap),
        'upcoming': _upcoming(snap, today),
        'urgent_actions': _urgent_actions(snap, due or [], today, show_finance),
        'invoicing_health': month_row,
    }


def feed_items(user):
    """The module's cross-cutting feed for the global Dashboard: upcoming
    installs plus (for finance viewers) the month's outstanding LPO / unbilled
    / overdue invoices. Empty for anyone without CS access."""
    if not can_access_client_servicing(user):
        return []
    today = date.today()
    snap = _snapshot(_active(_base_projects().all()), today)
    items = _feed_installs(snap, today)
    if can_view_finance(user):
        items += _finance_signals(due_this_month(today.year, today.month), today)
    items.sort(key=_signal_sort)
    return items