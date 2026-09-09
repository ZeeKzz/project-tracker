"""Coverage for the admin surface after the move to the capabilities map.

The point of interest is not that a designer is refused — that was already
true. It is that these routes gate on the REAL logged-in user, so an admin
previewing the app as someone else keeps their own admin tools. That is what
the old @admin_required and @role_required('admin') did by reading
current_user, and what require(..., real_user=True) preserves.
"""
import pytest
from flask import url_for

from app.modules.core.shared.models import User
from app.modules.core.shared.testing import login_as


def _user(db_session, tag, role):
    user = User(name=f'Admin Surface {tag}', email=f'admin-surface-{tag}@example.com', role=role)
    user.set_password('password123')
    db_session.add(user)
    db_session.flush()
    return user


def _url(app, endpoint, **kwargs):
    with app.test_request_context():
        return url_for(endpoint, **kwargs)


def _emulate(client, target):
    with client.session_transaction() as sess:
        sess['emulating_user_id'] = target.id


# ── The admin API ──────────────────────────────────────────────────────────

@pytest.mark.parametrize('role', ['designer', 'cs', 'management', 'hr', 'project_owner'])
def test_admin_api_refuses_every_non_admin_role(app, client, db_session, role):
    login_as(client, app, _user(db_session, f'api-{role}', role), 'password123')
    assert client.get(_url(app, 'admin.list_users')).status_code == 403


def test_admin_api_opens_for_an_admin(app, client, db_session):
    login_as(client, app, _user(db_session, 'api-admin', 'admin'), 'password123')
    assert client.get(_url(app, 'admin.list_users')).status_code == 200


def test_an_emulating_admin_keeps_the_admin_api(app, client, db_session):
    """real_user=True: previewing as a designer must not cost the admin their
    own tools mid-preview. Same rule as CS's Scope CRUD."""
    admin = _user(db_session, 'api-emu-admin', 'admin')
    designer = _user(db_session, 'api-emu-designer', 'designer')
    login_as(client, app, admin, 'password123')
    _emulate(client, designer)

    assert client.get(_url(app, 'admin.list_users')).status_code == 200


# ── User management ────────────────────────────────────────────────────────

def test_user_admin_page_is_admin_only(app, client, db_session):
    login_as(client, app, _user(db_session, 'users-cs', 'cs'), 'password123')
    assert client.get(_url(app, 'auth.admin_users')).status_code == 403


def test_user_admin_page_opens_for_an_admin(app, client, db_session):
    login_as(client, app, _user(db_session, 'users-admin', 'admin'), 'password123')
    assert client.get(_url(app, 'auth.admin_users')).status_code == 200


# ── Wiki: editing is admin-only, viewing follows the emulated user ─────────

def test_wiki_editor_is_admin_only(app, client, db_session):
    login_as(client, app, _user(db_session, 'wiki-designer', 'designer'), 'password123')
    assert client.get(_url(app, 'wiki.editor_dashboard')).status_code == 403


def test_wiki_editor_opens_for_an_admin(app, client, db_session):
    login_as(client, app, _user(db_session, 'wiki-admin', 'admin'), 'password123')
    assert client.get(_url(app, 'wiki.editor_dashboard')).status_code == 200


def test_an_emulating_admin_keeps_the_wiki_editor(app, client, db_session):
    admin = _user(db_session, 'wiki-emu-admin', 'admin')
    designer = _user(db_session, 'wiki-emu-designer', 'designer')
    login_as(client, app, admin, 'password123')
    _emulate(client, designer)

    assert client.get(_url(app, 'wiki.editor_dashboard')).status_code == 200


def test_the_wiki_viewer_stays_open_to_everyone(app, client, db_session):
    """Reading the wiki was never gated — only editing is."""
    login_as(client, app, _user(db_session, 'wiki-reader', 'logistics'), 'password123')
    assert client.get(_url(app, 'wiki.index')).status_code == 200


# ── Achievements ───────────────────────────────────────────────────────────

def test_an_emulating_admin_keeps_the_badge_tools(app, client, db_session):
    admin = _user(db_session, 'ach-emu-admin', 'admin')
    designer = _user(db_session, 'ach-emu-designer', 'designer')
    login_as(client, app, admin, 'password123')
    _emulate(client, designer)

    resp = client.get(_url(app, 'admin_achievements.list_achievement_categories'))
    assert resp.status_code == 200
