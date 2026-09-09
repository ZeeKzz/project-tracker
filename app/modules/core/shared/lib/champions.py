"""The weekly OVP champions — who holds each department, and the Friction Log
write gate.

Shared, not module-local: the Friction Log reads it now and Adoption reads it
later. The designation rotates weekly and is orthogonal to User.role, so it is
never a role.
"""
from datetime import date, timedelta

from sqlalchemy.orm import joinedload

from app.modules.core.shared.lib.capabilities import can
from app.modules.core.shared.models import OvpChampion

# The departments that rotate a champion, in the order the admin panel lists
# them. Management and admin are absent on purpose — they hold the Friction Log
# capability outright, so a badge would add nothing. Digital Innovation and HR
# are absent because neither reports friction with the platform.
CHAMPION_DEPARTMENTS = [
    ('client_servicing', 'Client Servicing'),
    ('design', 'Design'),
    ('production', 'Production'),
    ('logistics', 'Logistics'),
    ('finance', 'Finance'),
]

DEPARTMENT_KEYS = [key for key, _ in CHAMPION_DEPARTMENTS]
DEPARTMENT_LABELS = dict(CHAMPION_DEPARTMENTS)


# How long a badge keeps working after a missed rotation. A departmental
# champion who was never replaced still counts for this many weeks, so one
# skipped Friday does not empty the Friction Log — but a badge from months ago
# stops granting write access on its own.
CHAMPION_CARRY_OVER_WEEKS = 2


def week_start_for(day=None):
    """The Monday of the week `day` falls in; today's Monday when omitted."""
    day = day or date.today()
    return day - timedelta(days=day.weekday())


def _carry_over_floor(week_start):
    """The oldest assignment still considered current for that week."""
    return week_start - timedelta(weeks=CHAMPION_CARRY_OVER_WEEKS)


def champion_for(department, week_start=None):
    """One department's champion, falling back to that department's most recent
    assignment within the carry-over window so a missed rotation never empties
    it. None when never set, or when the last badge has lapsed."""
    week_start = week_start or week_start_for()
    row = (OvpChampion.query
           .filter(OvpChampion.department == department,
                   OvpChampion.week_start <= week_start,
                   OvpChampion.week_start >= _carry_over_floor(week_start))
           .order_by(OvpChampion.week_start.desc())
           .first())
    return row.user if row else None


def champion_for_week(week_start):
    """Who held each department that exact week — history, so no fallback.
    Returns {department: User} for the departments assigned that week."""
    rows = (OvpChampion.query
            .filter_by(week_start=week_start)
            .options(joinedload(OvpChampion.user))
            .all())
    return {r.department: r.user for r in rows}


def current_champions():
    """Every department's champion right now, keyed by department, in one query.
    Bounded to the carry-over window — this runs on every permission check, so
    it must never read the whole history. A department with no live assignment
    is simply absent."""
    this_week = week_start_for()
    rows = (OvpChampion.query
            .filter(OvpChampion.week_start <= this_week,
                    OvpChampion.week_start >= _carry_over_floor(this_week))
            .options(joinedload(OvpChampion.user))
            .order_by(OvpChampion.week_start.desc())
            .all())
    found = {}
    for row in rows:
        if row.department in DEPARTMENT_LABELS and row.department not in found:
            found[row.department] = row.user
    return found


def is_champion(user):
    """True if this person holds any department's badge right now."""
    user_id = getattr(user, 'id', None)
    if user_id is None:
        return False
    return any(holder.id == user_id for holder in current_champions().values())


def can_write_friction(user):
    """Friction Log write access — any current champion, plus whoever the map grants."""
    return is_champion(user) or can('write_friction_log', user)
