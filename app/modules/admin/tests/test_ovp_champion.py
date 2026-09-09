"""The admin-only set-champion endpoint."""
import pytest
from flask import url_for

from app.modules.core.shared.models import OvpChampion, User
from app.modules.core.shared.testing import login_as
from app.modules.core.shared.lib.champions import week_start_for


def _user(db_session, tag, role):
    user = User(name=f'Champion Admin {tag}', email=f'champion-admin-{tag}@example.com', role=role)
    user.set_password('password123')
    db_session.add(user)
    db_session.flush()
    return user


def _url(app, endpoint):
    with app.test_request_context():
        return url_for(endpoint)


@pytest.mark.parametrize('role', ['designer', 'cs', 'management'])
def test_setting_the_champion_is_admin_only(app, client, db_session, role):
    login_as(client, app, _user(db_session, f'refuse-{role}', role), 'password123')
    target = _user(db_session, f'target-{role}', 'designer')
    response = client.post(_url(app, 'admin.set_ovp_champion'), json={'user_id': target.id})
    assert response.status_code == 403


def test_an_admin_sets_the_champion_and_is_recorded_as_the_setter(app, client, db_session):
    admin = _user(db_session, 'setter', 'admin')
    target = _user(db_session, 'chosen', 'designer')
    login_as(client, app, admin, 'password123')

    response = client.post(_url(app, 'admin.set_ovp_champion'), json={'user_id': target.id})
    assert response.status_code == 200
    assert response.get_json()['success'] is True

    row = OvpChampion.query.filter_by(week_start=week_start_for()).first()
    assert row.user_id == target.id
    assert row.set_by_id == admin.id


def test_setting_twice_in_a_week_replaces_rather_than_duplicates(app, client, db_session):
    admin = _user(db_session, 'setter-twice', 'admin')
    first = _user(db_session, 'first', 'designer')
    second = _user(db_session, 'second', 'designer')
    login_as(client, app, admin, 'password123')

    client.post(_url(app, 'admin.set_ovp_champion'), json={'user_id': first.id})
    client.post(_url(app, 'admin.set_ovp_champion'), json={'user_id': second.id})

    rows = OvpChampion.query.filter_by(week_start=week_start_for()).all()
    assert len(rows) == 1
    assert rows[0].user_id == second.id


def test_a_deactivated_account_is_refused(app, client, db_session):
    login_as(client, app, _user(db_session, 'setter-inactive', 'admin'), 'password123')
    target = _user(db_session, 'inactive', 'designer')
    target.is_active = False
    db_session.flush()

    response = client.post(_url(app, 'admin.set_ovp_champion'), json={'user_id': target.id})
    assert response.status_code == 400


def test_the_read_endpoint_reports_the_current_champion(app, client, db_session):
    admin = _user(db_session, 'reader', 'admin')
    target = _user(db_session, 'reported', 'designer')
    login_as(client, app, admin, 'password123')
    client.post(_url(app, 'admin.set_ovp_champion'), json={'user_id': target.id})

    data = client.get(_url(app, 'admin.get_ovp_champion')).get_json()
    assert data['current']['id'] == target.id
    assert data['week_start'] == week_start_for().isoformat()
