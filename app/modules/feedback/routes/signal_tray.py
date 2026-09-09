"""Signal tray — the Bug Report and Feature Request boards in their compact tray
form, plus the weekly Friction Log.

The boards read the same models the feedback module owns and post to its own
endpoints; only the list shape is new. The Friction Log is this file's own.
"""
from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_login import login_required
from sqlalchemy.orm import joinedload

from app.modules.core.shared.extensions import db
from app.modules.core.shared.lib.capabilities import effective_user
from app.modules.core.shared.lib.champions import (
    DEPARTMENT_LABELS, can_write_friction, current_champions, week_start_for,
)
from app.modules.core.shared.models import (
    BugReport, BugReportComment, FeatureRequest, FeatureRequestComment,
    FeatureRequestUpvote, FrictionLogEntry,
)

signal_tray_bp = Blueprint('signal_tray', __name__)

# The stored values, with the labels the tray shows. Deliberately the real
# vocabulary — the boards and the tray must word a status the same way.
BUG_STATUSES = [
    ('in_queue', 'In queue'),
    ('fix_in_progress', 'Fix in progress'),
    ('testing', 'Testing'),
    ('resolved', 'Resolved'),
]
FEATURE_STATUSES = [
    ('requested', 'Requested'),
    ('in_progress', 'In progress'),
    ('testing', 'Testing'),
    ('implemented', 'Implemented'),
]
SEVERITIES = [('high', 'High'), ('medium', 'Med'), ('low', 'Low')]

BUG_STATUS_LABELS = dict(BUG_STATUSES)
FEATURE_STATUS_LABELS = dict(FEATURE_STATUSES)
SEVERITY_LABELS = dict(SEVERITIES)

# How many weeks of the Friction Log come back at once.
_FRICTION_WEEKS = 8


def _counts(rows, statuses):
    """Chip counts: one per status in the board's own order, plus the total."""
    tally = {key: 0 for key, _ in statuses}
    for row in rows:
        if row['status'] in tally:
            tally[row['status']] += 1
    return {
        'all': len(rows),
        'by_status': [
            {'key': key, 'label': label, 'count': tally[key]}
            for key, label in statuses
        ],
    }


def _comment_counts(model, foreign_key):
    """Comments per item in one query, so a long board stays one round trip."""
    rows = db.session.query(foreign_key, db.func.count(model.id)).group_by(foreign_key).all()
    return dict(rows)


@signal_tray_bp.route('/signal/bugs')
@login_required
def bug_board():
    counts = _comment_counts(BugReportComment, BugReportComment.bug_id)
    bugs = (BugReport.query
            .options(joinedload(BugReport.submitter))
            .order_by(BugReport.created_at.desc())
            .all())
    rows = [{
        'id': bug.id,
        'title': bug.title,
        'status': bug.status,
        'status_label': BUG_STATUS_LABELS.get(bug.status, bug.status),
        'severity': bug.severity,
        'severity_label': SEVERITY_LABELS.get(bug.severity),
        'author': bug.submitter.name if bug.submitter else '',
        'created_at': bug.created_at.isoformat() if bug.created_at else None,
        'comments': counts.get(bug.id, 0),
    } for bug in bugs]
    return jsonify({
        'rows': rows,
        'counts': _counts(rows, BUG_STATUSES),
        'severities': [{'key': k, 'label': l} for k, l in SEVERITIES],
    })


def _di_states():
    """Which feature requests Digital Innovation declined, through DI's own
    service seam. DI reads status 'requested' as its incoming tray and flips
    the status when it picks one up, so queued/picked-up is decided here from
    our own model — only the dismissal lives over there."""
    from app.modules.digital_innovation.services.intake import declined_feature_ids

    return declined_feature_ids()


@signal_tray_bp.route('/signal/features')
@login_required
def feature_board():
    actor = effective_user()
    counts = _comment_counts(FeatureRequestComment, FeatureRequestComment.feature_id)
    votes = dict(
        db.session.query(FeatureRequestUpvote.feature_id, db.func.count(FeatureRequestUpvote.id))
        .group_by(FeatureRequestUpvote.feature_id).all()
    )
    mine = {
        row.feature_id for row in
        FeatureRequestUpvote.query.filter_by(user_id=actor.id).all()
    }
    declined = _di_states()

    features = (FeatureRequest.query
                .options(joinedload(FeatureRequest.submitter))
                .order_by(FeatureRequest.created_at.desc())
                .all())
    rows = []
    for feature in features:
        if feature.id in declined:
            di_state = 'declined'
        elif feature.status == 'requested':
            di_state = 'queued'
        else:
            di_state = 'picked_up'
        rows.append({
            'id': feature.id,
            'title': feature.title,
            'status': feature.status,
            'status_label': FEATURE_STATUS_LABELS.get(feature.status, feature.status),
            'author': feature.submitter.name if feature.submitter else '',
            'created_at': feature.created_at.isoformat() if feature.created_at else None,
            'comments': counts.get(feature.id, 0),
            'upvotes': votes.get(feature.id, 0),
            'voted': feature.id in mine,
            'di_state': di_state,
        })

    # The board sorts itself by support, which is the point of the upvote.
    rows.sort(key=lambda r: r['upvotes'], reverse=True)
    return jsonify({'rows': rows, 'counts': _counts(rows, FEATURE_STATUSES)})


@signal_tray_bp.route('/signal/friction')
@login_required
def friction_log():
    """The running thread, newest week first. Everyone reads it."""
    actor = effective_user()
    entries = (FrictionLogEntry.query
               .options(joinedload(FrictionLogEntry.author))
               .order_by(FrictionLogEntry.week_start.desc(), FrictionLogEntry.created_at.asc())
               .limit(500)
               .all())

    # Which department each author speaks for, when they hold a badge this week.
    department_by_user = {}
    for department, holder in current_champions().items():
        department_by_user.setdefault(holder.id, DEPARTMENT_LABELS[department])

    weeks = []
    for entry in entries:
        key = entry.week_start.isoformat()
        if not weeks or weeks[-1]['week_start'] != key:
            weeks.append({'week_start': key, 'entries': []})
        weeks[-1]['entries'].append({
            'id': entry.id,
            'body': entry.body,
            'author': entry.author.name if entry.author else '',
            'department': department_by_user.get(entry.author_id),
            'created_at': entry.created_at.isoformat() if entry.created_at else None,
        })

    return jsonify({
        'weeks': weeks,
        'current_week': week_start_for().isoformat(),
        'can_write': can_write_friction(actor),
    })


@signal_tray_bp.route('/signal/friction', methods=['POST'])
@login_required
def post_friction():
    actor = effective_user()
    if not can_write_friction(actor):
        return jsonify({'success': False,
                        'error': "Only this week's OVP champions, management and admin can post."}), 403

    body = ((request.get_json() or {}).get('body') or '').strip()
    if not body:
        return jsonify({'success': False, 'error': 'Write something first'}), 400

    db.session.add(FrictionLogEntry(author_id=actor.id, body=body, week_start=week_start_for()))
    db.session.commit()
    return jsonify({'success': True})


def _unread_since(seen_at):
    """New bug, feature and friction items since this user last opened the tray.
    Three counts in three cheap queries, summed for the launcher bubble."""
    if seen_at is None:
        # Never opened it: the bubble would be the whole history, which is noise.
        return 0
    return (
        BugReport.query.filter(BugReport.created_at > seen_at).count()
        + FeatureRequest.query.filter(FeatureRequest.created_at > seen_at).count()
        + FrictionLogEntry.query.filter(FrictionLogEntry.created_at > seen_at).count()
    )


@signal_tray_bp.route('/signal/unread')
@login_required
def unread():
    actor = effective_user()
    return jsonify({'unread': _unread_since(actor.signal_seen_at)})


@signal_tray_bp.route('/signal/seen', methods=['POST'])
@login_required
def mark_seen():
    """Opening the tray clears its bubble."""
    actor = effective_user()
    actor.signal_seen_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'success': True})
