from datetime import datetime, time, timedelta


def get_actor():
    """Return the effective acting user.

    When an admin is emulating another user, actions like posting comments
    or submitting requests should be recorded as that user, not the admin.
    Admin-only write routes (delete, publish, status change) should use
    current_user directly — they don't call this helper.
    """
    from flask import session
    from flask_login import current_user
    from app.models import User
    emulating_id = session.get('emulating_user_id')
    if emulating_id and current_user.role == 'admin':
        return User.query.get(emulating_id)
    return current_user

WORK_START = time(9, 30)  # 9:30 AM
WORK_END = time(18, 30)  # 6:30 PM
WORK_DAYS = {0, 1, 2, 3, 4}  # Monday to Friday

TIME_ACTIVE_STATUSES = {'In Progress', 'Revision in Progress'}

def work_hours_between(start, end):
    if start >= end:
        return 0.0
    
    total_hours = 0.0
    current = start

    while current < end:
        if current.weekday() in WORK_DAYS:
            day_start = current.replace(
                hour=WORK_START.hour, minute=WORK_START.minute, second=0, microsecond=0
            )

            day_end = current.replace(
                hour=WORK_END.hour, minute=WORK_END.minute, second=0, microsecond=0
            )
            period_start = max(current, day_start)
            period_end = min(end, day_end)

            if period_start < period_end:
                total_hours += (period_end - period_start).total_seconds() / 3600

        next_day = (current + timedelta(days=1)).replace(
            hour = WORK_START.hour, minute=WORK_START.minute, second=0, microsecond=0
        )
        current = next_day

        return round(total_hours, 1)

def calculate_project_hours(project):
    total_hours = project.hours_accumulated

    if project.timer_started_at and project.status in TIME_ACTIVE_STATUSES:
        total_hours += work_hours_between(project.timer_started_at, datetime.utcnow())
    return round(total_hours, 1)

def log_activity(action, description, user=None, entity_type=None, entity_name=None, entity_id=None):
    from app import db
    from app.models import ActivityLog
    try:
        entry = ActivityLog(
            user_id=user.id if user else None,
            action=action,
            description=description,
            entity_type=entity_type,
            entity_name=entity_name,
            entity_id=entity_id
        )
        db.session.add(entry)
        db.session.commit()
    except Exception:
        db.session.rollback()
        import traceback
        traceback.print_exc()