"""Smoke tests for the feedback module, using the shared fixtures.

The two standalone board pages are gone — both boards live in the Signal tray
now — so these cover what remains: the tray's list endpoints, and the detail
fragments the tray renders.
"""
from flask import url_for


def _url(app, endpoint):
    with app.test_request_context():
        return url_for(endpoint)


def test_the_bug_board_requires_auth(app, client):
    assert client.get(_url(app, 'signal_tray.bug_board')).status_code in (302, 401)


def test_the_feature_board_requires_auth(app, client):
    assert client.get(_url(app, 'signal_tray.feature_board')).status_code in (302, 401)


def test_the_friction_log_requires_auth(app, client):
    assert client.get(_url(app, 'signal_tray.friction_log')).status_code in (302, 401)


def test_the_detail_fragments_resolve(app):
    for name in ('feedback/_feature_content.html', 'feedback/_bug_content.html'):
        assert app.jinja_env.get_template(name) is not None
