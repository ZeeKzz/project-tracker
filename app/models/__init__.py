from app import db, login_manager
from flask_login import UserMixin
from datetime import datetime


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


class User(db.Model, UserMixin):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(50), nullable=False, default='designer')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<User {self.email}>'
    
class Scope(db.Model):
    __tablename__ = 'scopes'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    active = db.Column(db.Boolean, default=True)

    def __repr__(self):
        return f'<Scope {self.name}>'


class Project(db.Model):
    __tablename__ = 'projects'

    id = db.Column(db.Integer, primary_key=True)

    # Required Fields - set on creation
    name = db.Column(db.String(200), nullable=False)
    cs_lead_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    client = db.Column(db.String(200), nullable=False)
    scope_id = db.Column(db.Integer, db.ForeignKey('scopes.id'), nullable=False)
    design_teams_requested = db.Column(db.String(200), nullable=False)
    importance = db.Column(db.String(20), nullable=False)
    design_needed_by = db.Column(db.Date, nullable=False)
    execution_date = db.Column(db.Date, nullable=False)
    job_number = db.Column(db.String(100), nullable=False, unique=True)
    value = db.Column(db.Float, nullable=False)
    brief_file = db.Column(db.String(255), nullable=True)

    # Auto-populated on creation

    status = db.Column(db.String(50), default='To Be Briefed', nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    # Set by Head of Design Ops
    lead_designer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    design_start_date = db.Column(db.Date, nullable=True)

    # Hours counter
    hours_accumulated = db.Column(db.Float, default=0.0)
    timer_started_at = db.Column(db.DateTime, nullable=True)

    # Relationships
    cs_lead = db.relationship('User', foreign_keys=[cs_lead_id])
    creator = db.relationship('User', foreign_keys=[created_by_id])
    lead_designer = db.relationship('User', foreign_keys=[lead_designer_id])
    scope = db.relationship('Scope', backref='projects')
    assigned_designers = db.relationship('ProjectDesigner', backref='project', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Project {self.name}>'
    
class ProjectDesigner(db.Model):
    __tablename__ = 'project_designers'

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    team = db.Column(db.String(50), nullable=False)

    designer = db.relationship('User', backref ='project_assignments')

    def __repr__(self):
        return f'<ProjectDesigner ProjectID={self.project_id} DesignerID={self.user_id}>'
    
    
