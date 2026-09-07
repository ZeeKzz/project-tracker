"""
Single choke point for who can see the Client Servicing page — every route
gates through this, never an inline role check. Same pattern as the
Digital Innovation module's access.py. When CS gets its own role, adding
it here is the only change needed anywhere.
"""
from flask import current_app, session
from flask_login import current_user

_CLIENT_SERVICING_ROLES = {
    'admin',
    'management',
    'cs',
    'project_owner',
    'finance',
}


def _effective_user():
    """Emulation-aware actor: the emulated user when an admin is viewing
    the app as someone else (session['emulating_user_id']), otherwise the
    logged-in user. The access check, saved layout, and edit attribution
    all resolve identity through this. The admin-only Scope CRUD in
    scopes_admin.py stays on current_user, so an admin previewing as
    someone else keeps real admin tools."""
    from app.modules.core.shared.models import User
    emulating_id = session.get('emulating_user_id')
    if emulating_id and current_user.role == 'admin':
        return User.query.get(emulating_id)
    return current_user


# While the review lock is on the module narrows to these two. Kept separate
# from _CLIENT_SERVICING_ROLES above so the permanent role model survives the
# review intact — clearing the flag restores it with no code change.
_REVIEW_ROLES = {'admin', 'management'}


def can_access_client_servicing(user):
    """True if `user` may view/use the Client Servicing page. Pass the
    _effective_user() result; getattr guards the logged-out case, which
    has no .role.

    While config CLIENT_SERVICING_REVIEW_ONLY is on, the module is under
    management review and only _REVIEW_ROLES get in."""
    role = getattr(user, 'role', None)
    if role not in _CLIENT_SERVICING_ROLES:
        return False
    if current_app.config.get('CLIENT_SERVICING_REVIEW_ONLY'):
        return role in _REVIEW_ROLES
    return True

_FINANCE_VIEW_ROLES = {'admin', 'management', 'cs', 'finance'}


def can_view_finance(user):
    """True if `user` may see finance figures — money, invoicing, stuck.
    Page access is wider: project_owner can open CS but not see finance."""
    return getattr(user, 'role', None) in _FINANCE_VIEW_ROLES


_CLOSE_ROLES = {'admin', 'management', 'cs'}


def can_close_projects(user):
    """True if `user` may close a project or close out a cancelled one.
    Narrower than page access — project_owner and finance cannot close."""
    return getattr(user, 'role', None) in _CLOSE_ROLES
