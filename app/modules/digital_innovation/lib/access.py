"""Single choke point for Digital Innovation access: who may view Performance
and cost surfaces, who may view a given project, and who may edit boards or
templates. Routes and templates gate through these functions instead of inline
role checks; the role sets themselves live in core/shared's capabilities map.

All checks are emulation-aware — when an admin emulates another user, the
emulated person's role governs, resolved once in _effective_role_user(). That
resolution is deliberately about the user PASSED IN, not the logged-in one, so
these stay answerable for any user object a caller hands over.
"""
from app.modules.core.shared.lib.capabilities import can


def _effective_role_user(user):
    """The user whose role governs DI access — the emulated user when an admin
    is emulating, else `user`. Only swaps when `user` is genuinely an admin;
    safe for a logged-out AnonymousUserMixin."""
    from flask import session
    from app.modules.core.shared.models import User

    emulating_id = session.get('emulating_user_id')
    if emulating_id and getattr(user, 'role', None) == 'admin':
        return User.query.get(emulating_id) or user
    return user


def can_view_di_performance(user):
    """True if `user` may view Performance / Cost breakdown / the feature-detail
    cost note. Safe when logged out."""
    return can('view_di_performance', _effective_role_user(user))


def can_view_di_project(user, project):
    """True if `user` may view `project` — its board, features, archive entry.
    Every DiProject is restricted to view_all_di holders; everyone else sees
    only the permanent OVP board (project.is_permanent). Emulation-aware."""
    if project is not None and getattr(project, 'is_permanent', False):
        return True
    return can('view_all_di', _effective_role_user(user))


def visible_di_projects(user, projects):
    """Filter DiProject rows to those `user` may see, preserving order. Use for
    any sidebar/list surface instead of a per-template role check."""
    return [p for p in projects if can_view_di_project(user, p)]


def can_edit_di_templates(user):
    """True if `user` may view/edit the department step-templates screen.
    Emulation-aware."""
    return can('manage_di_templates', _effective_role_user(user))


def can_edit_di_board(user):
    """True if `user` may change DI data — create a project/feature, or tick,
    add, delete, advance or close a feature's steps. Viewing stays open to all;
    only writes are gated. Emulation-aware."""
    return can('edit_di_board', _effective_role_user(user))
