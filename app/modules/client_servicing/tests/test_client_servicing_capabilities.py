"""Coverage for CS access after the move to the capabilities map.

The module's three helpers now read the map instead of their own role sets.
What is worth pinning here is the part the map cannot express — the
config-driven review lock — and that the read-only roles land where intended:
in the page, out of the money.
"""
from contextlib import contextmanager

from flask import url_for

from app.modules.core.shared.models import User
from app.modules.core.shared.testing import login_as
from app.modules.client_servicing.lib.access import (
    can_access_client_servicing,
    can_close_projects,
    can_view_finance,
)


def _user(db_session, tag, role):
    user = User(name=f'CS Capability {tag}', email=f'cs-cap-test-{tag}@example.com', role=role)
    user.set_password('password123')
    db_session.add(user)
    db_session.flush()
    return user


@contextmanager
def _review_lock(app, on):
    """Flip CLIENT_SERVICING_REVIEW_ONLY for one test. The app fixture is
    session-scoped, so the previous value has to go back."""
    key = 'CLIENT_SERVICING_REVIEW_ONLY'
    previous = app.config.get(key)
    app.config[key] = on
    try:
        yield
    finally:
        app.config[key] = previous


def test_review_lock_narrows_the_page_to_admin_and_management(app, db_session):
    cs = _user(db_session, 'lock-cs', 'cs')
    project_owner = _user(db_session, 'lock-po', 'project_owner')
    hr = _user(db_session, 'lock-hr', 'hr')
    management = _user(db_session, 'lock-mgmt', 'management')
    admin = _user(db_session, 'lock-admin', 'admin')

    with app.test_request_context():
        with _review_lock(app, False):
            assert can_access_client_servicing(cs) is True
            assert can_access_client_servicing(project_owner) is True
            assert can_access_client_servicing(hr) is True

        with _review_lock(app, True):
            assert can_access_client_servicing(cs) is False
            assert can_access_client_servicing(project_owner) is False
            assert can_access_client_servicing(hr) is False
            assert can_access_client_servicing(management) is True
            assert can_access_client_servicing(admin) is True


def test_a_role_outside_the_page_stays_out_under_the_lock(app, db_session):
    designer = _user(db_session, 'lock-designer', 'designer')

    with app.test_request_context():
        with _review_lock(app, True):
            assert can_access_client_servicing(designer) is False


def test_a_logged_out_visitor_holds_nothing(app):
    with app.test_request_context():
        assert can_access_client_servicing(None) is False


def test_the_read_only_roles_see_the_page_and_the_money_but_cannot_close(app, db_session):
    for role in ('hr', 'production', 'logistics'):
        user = _user(db_session, f'ro-{role}', role)
        with app.test_request_context():
            assert can_access_client_servicing(user) is True
            assert can_view_finance(user) is True
            assert can_close_projects(user) is False


def test_an_hr_user_can_open_the_cs_page(app, client, db_session):
    """End-to-end proof that @require_cs reads the map: hr holds view_cs and
    did not exist as a role before this refactor."""
    user = _user(db_session, 'route-hr', 'hr')
    login_as(client, app, user, 'password123')

    with app.test_request_context():
        url = url_for('client_servicing.index')
    resp = client.get(url)
    assert resp.status_code == 200


def test_a_designer_is_still_refused(app, client, db_session):
    user = _user(db_session, 'route-designer', 'designer')
    login_as(client, app, user, 'password123')

    with app.test_request_context():
        url = url_for('client_servicing.index')
    resp = client.get(url)
    assert resp.status_code == 403
