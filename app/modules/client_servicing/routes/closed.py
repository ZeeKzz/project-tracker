"""
Client Servicing — Closed Projects. A read view of everything that has been
closed: KPI cards, a month/quarter/year filter, and the closing months.

The only write here is marking a pending project invoiced, and that reuses
edit.py's field endpoint rather than adding a second permission list.
"""
from datetime import date

from flask import render_template, request
from flask_login import login_required

from app.modules.core.shared.lib.capabilities import can, effective_user
from app.modules.client_servicing.lib.access import require_cs
from app.modules.client_servicing.lib import closed as closed_lib
from app.modules.client_servicing.routes.blueprint import client_servicing_bp


def _int_arg(name, default=0):
    try:
        return int(request.args.get(name, default))
    except (TypeError, ValueError):
        return default


@client_servicing_bp.route('/closed')
@login_required
@require_cs
def closed():
    actor = effective_user()

    today = date.today()
    year = _int_arg('year', today.year)
    quarter = _int_arg('quarter') or None
    month = _int_arg('month') or None
    if quarter not in (1, 2, 3, 4):
        quarter = None
    if month is not None and not 1 <= month <= 12:
        month = None

    projects = closed_lib.closed_projects(year=year, quarter=quarter, month=month)
    groups = closed_lib.month_groups(projects)

    return render_template(
        'client_servicing/closed.html',
        kpis=closed_lib.kpis(today),
        groups=groups,
        shown=len(projects),
        year=year, quarter=quarter, month=month,
        years=list(range(today.year - 3, today.year + 2)),
        months=[(m, date(2000, m, 1).strftime('%B')) for m in range(1, 13)],
        can_edit_finance=can('edit_finance', actor),
    )
