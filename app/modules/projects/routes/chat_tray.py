"""Chat tray — the global conversation list over project chat.

Only the list is new. The thread itself is the overlay's chat drawer, rendered
by project_notes.render_project_chat() and driven by ProjectChatPanel, so there
is one chat implementation showing in two places.
"""
from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_login import login_required
from sqlalchemy.orm import joinedload

from app.modules.core.shared.extensions import db
from app.modules.core.shared.lib.capabilities import can, effective_user
from app.modules.core.shared.models import (
    ChatTrayProject, Project, ProjectActivitySeen, ProjectDesigner,
    ProjectNote, ProjectSecondaryCS,
)

chat_tray_bp = Blueprint('chat_tray', __name__)

# Rows returned at once. The list is newest-activity-first, so the cut falls on
# conversations nobody has touched in a long time.
_LIST_CAP = 50


def _unread_baseline():
    """Chat older than the unread-dot rollout never counts as unread. Read from
    core/shared so the tray bubble and the Projects table's chat dot can never
    disagree."""
    from app.modules.core.shared.lib.utils import ACTIVITY_SEEN_ROLLOUT_CUTOFF
    return ACTIVITY_SEEN_ROLLOUT_CUTOFF


def _pool_query(user):
    """Projects this person is actually on — CS lead, secondary CS, project
    owner, or assigned designer. The same relationship set that decides who may
    post in a project's chat, so what you can read and what you can say agree."""
    secondary_ids = db.session.query(ProjectSecondaryCS.project_id).filter_by(user_id=user.id).subquery()
    assigned_ids = db.session.query(ProjectDesigner.project_id).filter_by(user_id=user.id).subquery()
    return Project.query.filter(
        db.or_(
            Project.cs_lead_id == user.id,
            Project.project_owner_id == user.id,
            Project.id.in_(secondary_ids),
            Project.id.in_(assigned_ids),
        ),
        Project.project_status != 'draft',
    )


def _reachable_query(user):
    """What you may open, as opposed to what surfaces on its own. Management and
    admin reach any project — the same rule the chat's own post gate uses — so
    they can pull any conversation into their tray."""
    if can('manage_projects', user):
        return Project.query.filter(Project.project_status != 'draft')
    return _pool_query(user)


def _tray_state(user):
    """This user's tray rows, keyed by project."""
    return {r.project_id: r for r in ChatTrayProject.query.filter_by(user_id=user.id).all()}


def _tray_row(user, project_id):
    """The tray row for this pair, created if it does not exist yet. Caller commits."""
    row = ChatTrayProject.query.filter_by(user_id=user.id, project_id=project_id).first()
    if not row:
        row = ChatTrayProject(user_id=user.id, project_id=project_id)
        db.session.add(row)
    return row


def _initials(name):
    parts = [p for p in (name or '').split() if p]
    return ''.join(p[0] for p in parts[:2]).upper() or '?'


def _last_notes(project_ids):
    """The newest message per project, in two bounded queries — never one per
    project. Ties on created_at keep the first row seen."""
    if not project_ids:
        return {}
    latest = (
        db.session.query(
            ProjectNote.project_id.label('project_id'),
            db.func.max(ProjectNote.created_at).label('at'),
        )
        .filter(ProjectNote.project_id.in_(project_ids))
        .group_by(ProjectNote.project_id)
        .subquery()
    )
    rows = (
        ProjectNote.query
        .join(latest, db.and_(
            ProjectNote.project_id == latest.c.project_id,
            ProjectNote.created_at == latest.c.at,
        ))
        .options(joinedload(ProjectNote.author))
        .all()
    )
    by_project = {}
    for note in rows:
        by_project.setdefault(note.project_id, note)
    return by_project


def _unread_counts(project_ids, user):
    """Messages from other people newer than this user's chat watermark, counted
    per project in one query. COALESCE supplies the rollout baseline for a
    project the user has no watermark row for yet."""
    if not project_ids:
        return {}
    seen = (
        db.session.query(
            ProjectActivitySeen.project_id.label('project_id'),
            ProjectActivitySeen.last_seen_chat_at.label('seen_at'),
        )
        .filter(ProjectActivitySeen.user_id == user.id)
        .subquery()
    )
    rows = (
        db.session.query(ProjectNote.project_id, db.func.count(ProjectNote.id))
        .outerjoin(seen, seen.c.project_id == ProjectNote.project_id)
        .filter(
            ProjectNote.project_id.in_(project_ids),
            ProjectNote.author_id != user.id,
            ProjectNote.created_at > db.func.coalesce(seen.c.seen_at, _unread_baseline()),
        )
        .group_by(ProjectNote.project_id)
        .all()
    )
    return dict(rows)


@chat_tray_bp.route('/chat-tray/conversations')
@login_required
def conversations():
    """The left pane: projects in your pool that have chat, plus anything you
    added or pinned, minus anything you hid that has gone quiet since. Pinned
    first, then newest activity."""
    actor = effective_user()
    state = _tray_state(actor)

    projects = _pool_query(actor).all()
    # Added or pinned projects can sit outside your own pool.
    kept = {pid for pid, row in state.items() if row.added_at or row.pinned_at}
    off_pool = kept - {p.id for p in projects}
    if off_pool:
        projects = projects + Project.query.filter(Project.id.in_(off_pool)).all()
    project_ids = [p.id for p in projects]

    last_notes = _last_notes(project_ids)
    unread = _unread_counts(project_ids, actor)

    rows = []
    for project in projects:
        row = state.get(project.id)
        note = last_notes.get(project.id)
        added = bool(row and row.added_at)
        pinned = bool(row and row.pinned_at)

        # Hidden stays hidden until a message newer than the hide arrives.
        # A pin overrides a hide.
        if row and row.hidden_at and not pinned:
            if note is None or note.created_at is None or note.created_at <= row.hidden_at:
                continue

        if note is None and not added and not pinned:
            continue

        rows.append({
            'project_id': project.id,
            'name': project.name,
            'job_number': project.job_number,
            'initials': _initials(project.name),
            'added': added,
            'pinned': pinned,
            'unread': unread.get(project.id, 0),
            'last_message': None if note is None else {
                'author': note.author.name if note.author else '',
                'text': note.display_text(),
                'at': note.created_at.isoformat() if note.created_at else None,
            },
        })

    # Two stable passes: newest activity first, then pinned lifted to the top
    # keeping that order within each group.
    rows.sort(key=lambda r: (r['last_message'] or {}).get('at') or '', reverse=True)
    rows.sort(key=lambda r: 0 if r['pinned'] else 1)

    return jsonify({
        'conversations': rows[:_LIST_CAP],
        'unread_total': sum(r['unread'] for r in rows),
    })


@chat_tray_bp.route('/chat-tray/addable')
@login_required
def addable_projects():
    """The ＋ picker: every project you could add, name-ordered."""
    actor = effective_user()
    projects = _reachable_query(actor).order_by(Project.name).all()
    return jsonify({'projects': [
        {'project_id': p.id, 'name': p.name, 'job_number': p.job_number}
        for p in projects
    ]})


@chat_tray_bp.route('/chat-tray/projects', methods=['POST'])
@login_required
def add_project():
    """Adds a conversation by hand, and lifts any previous hide."""
    actor = effective_user()
    project_id = (request.get_json() or {}).get('project_id')
    project = _reachable_query(actor).filter(Project.id == project_id).first() if project_id else None
    if not project:
        return jsonify({'success': False, 'error': 'Not one of your projects'}), 403

    row = _tray_row(actor, project.id)
    row.added_at = datetime.utcnow()
    row.hidden_at = None
    db.session.commit()
    return jsonify({'success': True})


@chat_tray_bp.route('/chat-tray/projects/<int:project_id>', methods=['DELETE'])
@login_required
def hide_project(project_id):
    """Drops a conversation off your list until someone posts in it again."""
    actor = effective_user()
    project = _reachable_query(actor).filter(Project.id == project_id).first()
    if not project:
        return jsonify({'success': False, 'error': 'Not one of your projects'}), 403

    row = _tray_row(actor, project.id)
    row.hidden_at = datetime.utcnow()
    row.added_at = None
    row.pinned_at = None
    db.session.commit()
    return jsonify({'success': True})


@chat_tray_bp.route('/chat-tray/projects/<int:project_id>/pin', methods=['POST'])
@login_required
def pin_project(project_id):
    """Holds a conversation at the top of your list, or releases it."""
    actor = effective_user()
    project = _reachable_query(actor).filter(Project.id == project_id).first()
    if not project:
        return jsonify({'success': False, 'error': 'Not one of your projects'}), 403

    pinned = bool((request.get_json() or {}).get('pinned', True))
    row = _tray_row(actor, project.id)
    row.pinned_at = datetime.utcnow() if pinned else None
    if pinned:
        row.hidden_at = None
    db.session.commit()
    return jsonify({'success': True, 'pinned': pinned})


@chat_tray_bp.route('/chat-tray/projects/<int:project_id>/thread')
@login_required
def project_thread(project_id):
    """The right pane. Pool-gated, then renders the same drawer the overlay uses
    — which also advances the chat watermark, clearing every unread marker for
    this project at once."""
    from app.modules.projects.routes.project_notes import render_project_chat

    actor = effective_user()
    project = _reachable_query(actor).filter(Project.id == project_id).first()
    if not project:
        return jsonify({'error': 'Not one of your projects'}), 403
    return render_project_chat(project, actor)
