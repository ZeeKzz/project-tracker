"""
Seed the Client Servicing module with demo data covering every case the
module can show: the Table's statuses and gaps, the Calendar's risk levels,
Invoicing's validation and days-pending bands, the Monthly Summary's year,
and the Closed page's months and invoice states.

Reuses existing users and clients — it never invents people. Every project it
creates is named "[SEED] ..." with a SEED-### job number, so --wipe removes
exactly what it added and nothing else.

    python _seed_client_servicing_demo.py --confirm
    python _seed_client_servicing_demo.py --wipe --confirm

Not a migration; it only writes rows. Named with the leading underscore the
other helper scripts in this folder use.
"""
import sys, os
from datetime import date, datetime, timedelta
from itertools import cycle

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import create_app, db
from app.modules.core.shared.models import Project, User, Client
from app.modules.client_servicing.models import ClientServicing, ClientServicingScope


PREFIX = '[SEED] '
JOB_PREFIX = 'SEED-'

TODAY = date.today()
THIS_MONTH = TODAY.replace(day=1)


def month_start(offset):
    """The 1st of the month `offset` months from this one (negative = past)."""
    index = (THIS_MONTH.year * 12 + THIS_MONTH.month - 1) + offset
    return date(index // 12, index % 12 + 1, 1)


def wipe():
    projects = Project.query.filter(Project.name.like(PREFIX + '%')).all()
    ids = [p.id for p in projects]
    if not ids:
        print('Nothing seeded to remove.')
        return
    ClientServicing.query.filter(ClientServicing.project_id.in_(ids)).delete(
        synchronize_session=False)
    Project.query.filter(Project.id.in_(ids)).delete(synchronize_session=False)
    db.session.commit()
    print('Removed {} seeded project(s).'.format(len(ids)))


def seed():
    leads = (User.query.filter_by(role='cs', is_active=True).all()
             or User.query.filter_by(is_active=True).all())
    if not leads:
        raise SystemExit('No active users to use as CS leads — add one first.')
    owners = User.query.filter_by(role='project_owner', is_active=True).all() or leads
    clients = Client.query.order_by(Client.id).limit(6).all()
    if not clients:
        raise SystemExit('No clients in the database — add one first.')
    scopes = ClientServicingScope.query.filter_by(active=True).limit(4).all()

    lead_cycle, owner_cycle = cycle(leads), cycle(owners)
    client_cycle = cycle(clients)
    scope_cycle = cycle(scopes) if scopes else None
    counter = {'n': 0}

    def mk(name, status='briefed', value=None, install=None, brief=None, due=None,
           cancelled=False, **cs_fields):
        """One project plus its CS row. cs_fields go on ClientServicing."""
        counter['n'] += 1
        lead = next(lead_cycle)
        project = Project(
            name=PREFIX + name,
            job_number='{}{:03d}'.format(JOB_PREFIX, counter['n']),
            cs_lead_id=lead.id,
            created_by_id=lead.id,
            project_owner_id=next(owner_cycle).id,
            client_id=next(client_cycle).id,
            project_status=status,
            value=value,
            installation_date=install,
            briefing_date=brief or (TODAY - timedelta(days=30)),
            first_output_deadline=due,
        )
        if cancelled:
            project.cancelled_at = datetime.utcnow() - timedelta(days=9)
            project.cancelled_by_id = lead.id
        db.session.add(project)
        db.session.flush()

        if scope_cycle is not None and 'scope_id' not in cs_fields:
            cs_fields['scope_id'] = next(scope_cycle).id
        if cs_fields.pop('closed', False):
            cs_fields.setdefault('closed_by_id', lead.id)
        db.session.add(ClientServicing(project_id=project.id, **cs_fields))
        db.session.flush()
        return project

    # ── Table: a spread of CS statuses, plus the awkward rows ──────────
    statuses = ['Briefing', 'Survey', 'KV in Progress', 'AW in Progress',
                'Pending Approval', 'Pending LPO', 'In Production', 'On Hold']
    for i, status in enumerate(statuses):
        mk('Shelf Refresh {}'.format(i + 1), value=40000 + i * 7500,
           install=TODAY + timedelta(days=12 + i * 3),
           due=TODAY + timedelta(days=6 + i * 3),
           cs_status=status, store_location='Store {}'.format(i + 1),
           lpo='LPO-{:04d}'.format(1200 + i),
           cost_to_client=40000 + i * 7500, inward_cost=26000 + i * 4000)

    mk('Nationwide Seasonal Rollout Across Every Mall Location Phase Two',
       value=310000, install=TODAY + timedelta(days=21), cs_status='Pending Quotation',
       store_location='Multiple', priority='High')

    # ── Dashboard gaps: these drive the "Missing …" urgent actions ─────
    mk('Gap — no value, no install date', cs_status='Briefing')
    mk('Gap — no value', install=TODAY + timedelta(days=18), cs_status='Survey')
    mk('Gap — no install date', value=52000, cs_status='KV in Progress')

    # ── Drafts: must not appear anywhere in the module ─────────────────
    mk('Draft one', status='draft', value=15000)
    mk('Draft two', status='draft', value=22000)

    # ── Cancelled but not closed out: the strip above the Table ────────
    mk('Cancelled — awaiting close out', cancelled=True, value=48000,
       cs_status='Cancelled')
    mk('Cancelled — no value yet', cancelled=True, cs_status='Cancelled')

    # ── Calendar: every risk level, plus the extras a card can show ────
    mk('Install today', value=64000, install=TODAY, cs_status='Pending Production',
       install_qty=12, next_action='Confirm access with mall ops', action_owner='Ops')
    mk('Install tomorrow', value=38000, install=TODAY + timedelta(days=1),
       cs_status='AW in Progress', install_qty=4,
       next_action='Artwork still with client', action_owner='CS')
    mk('Install in three days', value=71000, install=TODAY + timedelta(days=3),
       cs_status='Pending Approval', install_qty=8)
    mk('Install next week', value=45000, install=TODAY + timedelta(days=9),
       cs_status='In Production', install_qty=20)
    mk('Install done', value=59000, install=TODAY - timedelta(days=6),
       cs_status='Installed', install_qty=15, removal_date=TODAY + timedelta(days=24))
    mk('Risk overridden to On Track', value=33000, install=TODAY + timedelta(days=2),
       cs_status='Briefing', risk='On Track')

    # ── Invoicing: validation vocabulary and the days-pending bands ────
    mk('Invoiced 10 days ago', value=88000, cs_status='Invoiced',
       lpo='LPO-2001', lpo_date=TODAY - timedelta(days=60),
       invoice_number='INV-3001', invoice_date=TODAY - timedelta(days=10),
       invoice_amount=88000, invoice_month_date=month_start(0),
       gr_received=True, validation_status='valid',
       cost_to_client=88000, inward_cost=61000)
    mk('Invoiced 45 days ago', value=54000, cs_status='Invoiced',
       lpo='LPO-2002', invoice_number='INV-3002',
       invoice_date=TODAY - timedelta(days=45), invoice_amount=54000,
       invoice_month_date=month_start(-1), gr_received=True,
       validation_status='pending', cost_to_client=54000, inward_cost=39000)
    mk('Invoiced 90 days ago', value=97000, cs_status='Invoiced',
       lpo='LPO-2003', invoice_number='INV-3003',
       invoice_date=TODAY - timedelta(days=90), invoice_amount=97000,
       invoice_month_date=month_start(-3), gr_received=False,
       validation_status='overdue', cost_to_client=97000, inward_cost=70000)
    mk('Waiting to invoice — 5 days', value=42000, cs_status='Pending Invoice',
       lpo='LPO-2004', removal_date=TODAY - timedelta(days=5),
       invoice_month_date=month_start(0), validation_status='valid')
    mk('Waiting to invoice — 40 days', value=36000, cs_status='Pending Invoice',
       lpo='LPO-2005', removal_date=TODAY - timedelta(days=40),
       invoice_month_date=month_start(0), validation_status='pending')
    mk('Waiting to invoice — 80 days, no LPO', value=29000,
       cs_status='Pending Invoice', removal_date=TODAY - timedelta(days=80),
       invoice_month_date=month_start(-1), validation_status='no_lpo')
    mk('No validation set', value=31000, cs_status='Pending Invoice',
       lpo='LPO-2006', removal_date=TODAY - timedelta(days=20),
       invoice_month_date=month_start(0))

    # ── Monthly Summary: something in every month of the year so far ───
    for offset in range(-8, 1):
        start = month_start(offset)
        billed = offset % 3 != 0            # two in three actually invoiced
        has_lpo = offset % 4 != 0           # one in four stuck with no LPO
        mk('Month {} — {}'.format(start.strftime('%b'), 'invoiced' if billed else 'open'),
           value=50000 + abs(offset) * 6000, cs_status='Invoiced' if billed else 'Pending Invoice',
           lpo='LPO-{:04d}'.format(2100 + abs(offset)) if has_lpo else None,
           invoice_month_date=start,
           invoice_number='INV-{:04d}'.format(3100 + abs(offset)) if billed else None,
           invoice_date=start + timedelta(days=14) if billed else None,
           invoice_amount=50000 + abs(offset) * 6000 if billed else None,
           validation_status='valid' if has_lpo else 'no_lpo',
           cost_to_client=50000 + abs(offset) * 6000, inward_cost=34000 + abs(offset) * 4000)

    # ── Closed: four months, all three invoice states ──────────────────
    closed_cases = [
        (0, 'invoiced', True, month_start(0) + timedelta(days=8)),
        (0, 'pending', True, None),
        (-1, 'invoiced', True, month_start(-1) + timedelta(days=11)),
        (-1, 'not needed', False, None),
        (-2, 'invoiced', True, month_start(-2) + timedelta(days=6)),
        (-2, 'pending', True, None),
        (-3, 'not needed', False, None),
        (-3, 'invoiced', True, month_start(-3) + timedelta(days=19)),
    ]
    for i, (offset, label, needed, invoiced_on) in enumerate(closed_cases):
        start = month_start(offset)
        mk('Closed {} — {}'.format(start.strftime('%b'), label),
           value=45000 + i * 5000, cs_status='Invoiced',
           closed=True,
           closed_at=datetime.combine(start + timedelta(days=20), datetime.min.time()),
           invoice_needed=needed,
           invoice_date=invoiced_on,
           invoice_amount=45000 + i * 5000 if invoiced_on else None,
           invoice_month_date=start if invoiced_on else None,
           lpo='LPO-{:04d}'.format(2200 + i) if needed else None,
           validation_status='valid' if invoiced_on else None,
           removal_date=start + timedelta(days=4))

    # A closed project that is still stuck — the Dashboard lists it and links
    # to the Closed page rather than to Invoicing, which no longer shows it.
    mk('Closed but still stuck — no LPO', value=76000, cs_status='Invoiced',
       closed=True, closed_at=datetime.utcnow() - timedelta(days=2),
       invoice_needed=True, removal_date=TODAY - timedelta(days=12),
       invoice_month_date=month_start(0))

    db.session.commit()
    print('Seeded {} project(s), all named "{}…".'.format(counter['n'], PREFIX.strip()))
    print('CS leads used: {}'.format(', '.join(sorted({u.name for u in leads}))))
    print('Clients used: {}'.format(', '.join(c.name for c in clients)))


if __name__ == '__main__':
    app = create_app()
    with app.app_context():
        url = db.engine.url
        print('Target database: {} on {}'.format(url.database, url.host or 'localhost'))
        if '--confirm' not in sys.argv:
            raise SystemExit('Add --confirm once that is the database you meant.')
        if '--wipe' in sys.argv:
            wipe()
        else:
            seed()
