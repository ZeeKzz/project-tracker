"""The weekly OVP champion helpers and the Friction Log write gate.

The gate is the interesting part: it is a capability OR a per-person weekly
grant, so both halves need their own coverage.
"""
from datetime import timedelta

from app.modules.core.shared.lib.champions import (
    can_write_friction,
    champion_for_week,
    current_champion,
    is_champion,
    week_start_for,
)
from app.modules.core.shared.models import OvpChampion, User


def _user(db_session, tag, role='designer'):
    user = User(name=f'Champion {tag}', email=f'champion-{tag}@example.com', role=role)
    user.set_password('password123')
    db_session.add(user)
    db_session.flush()
    return user


def _assign(db_session, user, week_start, set_by=None):
    row = OvpChampion(user_id=user.id, week_start=week_start,
                      set_by_id=set_by.id if set_by else None)
    db_session.add(row)
    db_session.flush()
    return row


def test_week_start_is_the_monday_of_that_week():
    monday = week_start_for()
    assert monday.weekday() == 0
    assert week_start_for(monday + timedelta(days=4)) == monday


def test_no_assignment_means_no_champion(app, db_session):
    assert current_champion() is None


def test_current_champion_resolves_this_week(app, db_session):
    user = _user(db_session, 'this-week')
    _assign(db_session, user, week_start_for())
    assert current_champion().id == user.id


def test_current_champion_falls_back_to_the_most_recent(app, db_session):
    """A missed rotation must not leave the designation empty."""
    older = _user(db_session, 'older')
    recent = _user(db_session, 'recent')
    _assign(db_session, older, week_start_for() - timedelta(weeks=3))
    _assign(db_session, recent, week_start_for() - timedelta(weeks=1))
    assert current_champion().id == recent.id


def test_champion_for_week_reads_the_history(app, db_session):
    user = _user(db_session, 'history')
    last_week = week_start_for() - timedelta(weeks=1)
    _assign(db_session, user, last_week)
    assert champion_for_week(last_week).id == user.id
    assert champion_for_week(week_start_for()) is None


def test_is_champion_is_true_only_for_the_holder(app, db_session):
    holder = _user(db_session, 'holder')
    other = _user(db_session, 'other')
    _assign(db_session, holder, week_start_for())
    assert is_champion(holder)
    assert not is_champion(other)


def test_the_champion_may_write_friction(app, db_session):
    designer = _user(db_session, 'gate-designer')
    _assign(db_session, designer, week_start_for())
    assert can_write_friction(designer)


def test_management_and_admin_may_write_friction(app, db_session):
    assert can_write_friction(_user(db_session, 'gate-management', 'management'))
    assert can_write_friction(_user(db_session, 'gate-admin', 'admin'))


def test_a_plain_designer_may_not_write_friction(app, db_session):
    assert not can_write_friction(_user(db_session, 'gate-plain'))
