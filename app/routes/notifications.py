from flask import Blueprint, jsonify, url_for
from flask_login import login_required, current_user
from app import db
from app.models import Notification

notifications_bp = Blueprint('notifications', __name__)


@notifications_bp.route('/notifications/<int:notification_id>/read', methods=['POST'])
@login_required
def mark_read(notification_id):
    """
    Mark a single notification as read.
    Returns JSON with the URL to navigate to (the related project).
    """
    notification = Notification.query.get_or_404(notification_id)

    # Security check - users can only mark their own notifications as read
    if notification.recipient_id != current_user.id:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 403

    notification.is_read = True
    db.session.commit()

    # Build the URL to redirect the user to
    if notification.project_id:
        redirect_url = url_for('projects.detail', project_id=notification.project_id)
    else:
        redirect_url = url_for('projects.index')

    return jsonify({
        'success': True,
        'redirect_url': redirect_url
    })


@notifications_bp.route('/notifications/mark-all-read', methods=['POST'])
@login_required
def mark_all_read():
    """
    Mark every unread notification for the current user as read.
    """
    Notification.query.filter_by(
        recipient_id=current_user.id,
        is_read=False
    ).update({'is_read': True})
    db.session.commit()
    return jsonify({'success': True})