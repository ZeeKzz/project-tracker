from datetime import datetime

from app.modules.core.shared.extensions import db


class OvpChampion(db.Model):
    """One row per week naming that week's OVP champion. History is kept — a new
    week is a new row, never an update of the previous one."""
    __tablename__ = 'ovp_champions'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    # The Monday of the week this assignment covers; unique, so one champion per week.
    week_start = db.Column(db.Date, nullable=False, unique=True)
    set_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', foreign_keys=[user_id])
    set_by = db.relationship('User', foreign_keys=[set_by_id])

    def __repr__(self):
        return f'<OvpChampion user {self.user_id} week {self.week_start}>'
