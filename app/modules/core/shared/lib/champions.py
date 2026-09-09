"""The weekly OVP champion — who holds it, and the Friction Log write gate.

Shared, not module-local: the Friction Log reads it now and Adoption reads it
later. The designation rotates weekly and is orthogonal to User.role, so it is
never a role.
"""
from datetime import date, timedelta

from app.modules.core.shared.lib.capabilities import can
from app.modules.core.shared.models import OvpChampion


def week_start_for(day=None):
    """The Monday of the week `day` falls in; today's Monday when omitted."""
    day = day or date.today()
    return day - timedelta(days=day.weekday())


def champion_for_week(week_start):
    """The User who held the designation that week, or None."""
    row = OvpChampion.query.filter_by(week_start=week_start).first()
    return row.user if row else None


def current_champion():
    """This week's champion, falling back to the most recent assignment so the
    designation never lapses between rotations. None when never set."""
    row = (OvpChampion.query
           .filter(OvpChampion.week_start <= week_start_for())
           .order_by(OvpChampion.week_start.desc())
           .first())
    return row.user if row else None


def is_champion(user):
    champion = current_champion()
    return bool(champion and getattr(user, 'id', None) == champion.id)


def can_write_friction(user):
    """Friction Log write access — the champion, plus whoever the map grants."""
    return is_champion(user) or can('write_friction_log', user)
