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
    is_conditional_reviewer = db.Column(db.Boolean, default=False)
    team = db.Column(db.String(20), nullable=True)

    def set_password(self, password):
     from werkzeug.security import generate_password_hash
     self.password_hash = generate_password_hash(password)

    def check_password(self, password):
     from werkzeug.security import check_password_hash
     return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f'<User {self.email}>'

class Notification(db.Model):
    __tablename__ = 'notifications'

    id = db.Column(db.Integer, primary_key=True)
    recipient_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    message = db.Column(db.String(500), nullable=False)
    notification_type = db.Column(db.String(50), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=True)
    triggered_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    is_read = db.Column(db.Boolean, default=False, nullable=False)
    is_archived = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    recipient = db.relationship('User', foreign_keys=[recipient_id], backref='notifications')
    project = db.relationship('Project', backref='notifications')
    triggered_by = db.relationship('User', foreign_keys=[triggered_by_id])

    def __repr__(self):
        return f'<Notification {self.id} for user {self.recipient_id}>'
    
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
    client = db.Column(db.String(200), nullable=True)
    scope_id = db.Column(db.Integer, db.ForeignKey('scopes.id'), nullable=True)
    design_teams_requested = db.Column(db.String(200), nullable=True)
    importance = db.Column(db.String(20), nullable=True)
    design_needed_by = db.Column(db.Date, nullable=True)
    execution_date = db.Column(db.Date, nullable=True)
    job_number = db.Column(db.String(100), nullable=True, unique=True)
    value = db.Column(db.Float, nullable=True)
    brief_file = db.Column(db.String(255), nullable=True)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=True)
    brief_type = db.Column(db.String(50), nullable=True)
    project_status = db.Column(db.String(50), default='draft', nullable=True)
    campaign_notes = db.Column(db.Text, nullable=True)
    urgency = db.Column(db.String(50), nullable=True)
    required_output = db.Column(db.String(100), nullable=True)
    briefing_date = db.Column(db.Date, nullable=True)
    first_output_deadline = db.Column(db.Date, nullable=True)
    installation_date = db.Column(db.Date, nullable=True)
    last_autosaved_at = db.Column(db.DateTime, nullable=True)
    concept_deadline = db.Column(db.Date, nullable=True)
    has_kv = db.Column(db.Boolean, default=False, nullable=False)
    kv_deadline = db.Column(db.Date, nullable=True)
    kv_requirements = db.Column(db.Text, nullable=True)
    kv_options_required = db.Column(db.Integer, nullable=True)
    concept_designer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    kv_designer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

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
    client_brand = db.relationship('Client', foreign_keys=[client_id])
    project_customers = db.relationship('ProjectCustomer', backref='project_ref', cascade='all, delete-orphan')
    project_regions = db.relationship('ProjectRegion', backref='project_region_ref', cascade='all, delete-orphan')
    project_deliverables = db.relationship('Deliverable', backref='project_ref', cascade='all, delete-orphan')
    concept_designer = db.relationship('User', foreign_keys=[concept_designer_id])
    kv_designer = db.relationship('User', foreign_keys=[kv_designer_id])
    

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
    
class ProjectReviewer(db.Model):
    __tablename__ = 'project_reviewers'

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

class ProjectApproval(db.Model):
    __tablename__ = 'project_approvals'

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    reviewer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    round = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(20), nullable=False, default='pending')   # 'Approved', 'Correction Requested', 'Rejected'
    comment = db.Column(db.Text, nullable=True)
    reviewed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# Client class. Notes who created the client and when, for auditing purposes.
class Client(db.Model):
    __tablename__ = 'clients'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False, unique=True)
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    created_by = db.relationship('User', foreign_keys=[created_by_id])

    def __repr__(self):
        return f'<Client {self.name}>'

# Customer Class, stores customer and their region.
class Customer(db.Model):
    __tablename__ = 'customers'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    region = db.Column(db.String(50), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# DeliverableType Class. Handles relationships for deliverable types, which are linked to clients and customers. Also stores reference images for deliverable types, which can be used in the project brief to help designers understand the requirements.
class DeliverableType(db.Model):
    __tablename__ = 'deliverable_types'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=False)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False) 
    reference_image = db.Column(db.String(255), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    is_custom = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    client = db.relationship('Client', backref='deliverable_types')
    customer = db.relationship('Customer', backref='deliverable_types')
    disciplines = db.relationship('DeliverableTypeDiscipline', backref='deliverable_type', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<DeliverableType {self.name}>'

# Child class, links deliverable types to disciplines/teams. This allows us to specify which teams are needed for each deliverable type, which can then be used in the project brief to help designers understand the requirements and ensure the right teams are assigned to each project.  
class DeliverableTypeDiscipline(db.Model):
    __tablename__ = 'deliverable_type_disciplines'

    id = db.Column(db.Integer, primary_key=True)
    deliverable_type_id = db.Column(db.Integer, db.ForeignKey('deliverable_types.id'), nullable=False)
    team = db.Column(db.String(20), nullable=False)

    def __repr__(self):
        return f'<DeliverableTypeDiscipline {self.team} for type {self.deliverable_type_id}>'

# Project Region Class. Handles region data for projects, allowing us to specify which regions are relevant for each project.
class ProjectRegion(db.Model):
    __tablename__ = 'project_regions'

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    region = db.Column(db.String(50), nullable=False)

    project = db.relationship('Project', backref='regions')

    def __repr__(self):
        return f'<ProjectRegion {self.region} for project {self.project_id}>'


# ProjectCustomer Class, Links projects to customers, allowing customers to be assigned to projects.  
class ProjectCustomer(db.Model):
    __tablename__ = 'project_customers'

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    design_deadline = db.Column(db.Date, nullable=True)
    installation_date = db.Column(db.Date, nullable=True)

    project = db.relationship('Project')
    customer = db.relationship('Customer', backref='customer_projects')
    deliverables = db.relationship('Deliverable', backref='project_customer', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<ProjectCustomer project={self.project_id} customer={self.customer_id}>'
    


# Deliverable Class, represents individual deliverables within a project. 
# Flagging system for brief issues: if the brief_flag field is populated, it indicates there is an issue with the brief that needs to be resolved before work can proceed.
# The brief_flag_resolved boolean indiciates whether the issue has been resolved
# Revision comments allows CS to request revisions for deliverables and free type the feedback, which can then be viewed by designers to understand what changes are needed.
class Deliverable(db.Model):
    __tablename__ = 'deliverables'

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    project_customer_id = db.Column(db.Integer, db.ForeignKey('project_customers.id'), nullable=False)
    deliverable_type_id = db.Column(db.Integer, db.ForeignKey('deliverable_types.id'), nullable=True)
    name = db.Column(db.String(200), nullable=False)
    reference_image = db.Column(db.String(255), nullable=True)
    status = db.Column(db.String(50), default='in_progress', nullable=False)
    revision_comment = db.Column(db.Text, nullable=True)
    brief_flag = db.Column(db.Text, nullable=True)
    brief_flag_resolved = db.Column(db.Boolean, default=False, nullable=False)
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    project = db.relationship('Project', backref='deliverables')
    deliverable_type = db.relationship('DeliverableType', backref='deliverables')
    created_by = db.relationship('User', foreign_keys=[created_by_id])
    disciplines = db.relationship('DeliverableAssignment', backref='deliverable', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Deliverable {self.name} status={self.status}>'

# DeliverableAssignment Class, records who is assigned to each deliverable, and who made that assignment.
class DeliverableAssignment(db.Model):
    __tablename__ = 'deliverable_assignments'

    id = db.Column(db.Integer, primary_key=True)
    deliverable_id = db.Column(db.Integer, db.ForeignKey('deliverables.id'), nullable=False)
    designer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    team = db.Column(db.String(20), nullable=False)
    assigned_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow)

    designer = db.relationship('User', foreign_keys=[designer_id], backref='deliverable_assignments')
    assigned_by = db.relationship('User', foreign_keys=[assigned_by_id])

    def __repr__(self):
        return f'<DeliverableAssignment deliverable={self.deliverable_id} designer={self.designer_id}>'