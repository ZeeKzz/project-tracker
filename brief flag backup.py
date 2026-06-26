class BriefFlag(db.Model):
    __tablename__ = 'brief_flags'

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    deliverable_id = db.Column(db.Integer, db.ForeignKey('deliverables.id'), nullable=True)
    flag_type = db.Column(db.String(20), nullable=False)  # 'project', 'deliverable', 'concept', 'kv'
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_resolved = db.Column(db.Boolean, default=False, nullable=False)
    resolved_at = db.Column(db.DateTime, nullable=True)
    resolved_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    project = db.relationship('Project', backref='brief_flags')
    deliverable = db.relationship('Deliverable', backref='brief_flags')
    created_by = db.relationship('User', foreign_keys=[created_by_id])
    resolved_by = db.relationship('User', foreign_keys=[resolved_by_id])
    messages = db.relationship('BriefFlagMessage', backref='flag', cascade='all, delete-orphan', order_by='BriefFlagMessage.created_at')

    def __repr__(self):
        return f'<BriefFlag project={self.project_id} type={self.flag_type} resolved={self.is_resolved}>'