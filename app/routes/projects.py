import os
import uuid
from datetime import date
from flask import (Blueprint, render_template, redirect, url_for, flash, request, current_app, send_from_directory)
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename
from app import db
from app.models import Project, ProjectDesigner, Scope, User
from app.decorators import role_required
from datetime import date, datetime

projects = Blueprint('projects', __name__)

@projects.route('/projects')
@login_required
def index():
    all_prjects = Project.query.order_by(Project.created_at.desc()).all()
    return render_template('projects/index.html', projects=all_prjects)

@projects.route('/projects/create', methods=['GET', 'POST'])
@login_required
@role_required('admin', 'cs')
def create():
    scopes = Scope.query.filter_by(active=True).order_by(Scope.name).all()
    cs_users = User.query.filter(
        User.role.in_(['cs', 'admin'])
    ).order_by(User.name).all()

    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        cs_lead_id = request.form.get('cs_lead_id')
        client = request.form.get('client', '').strip()
        scope_id = request.form.get('scope_id')
        design_teams = request.form.getlist('design_teams') 
        importance = request.form.get('importance')
        design_needed_by = request.form.get('design_needed_by')
        execution_date = request.form.get('execution_date')
        job_number = request.form.get('job_number', '').strip()
        value = request.form.get('value')

        errors = []

        if not name:
            errors.append("Project name is required.")
        if not cs_lead_id:
            errors.append("Client Servicing Lead is required.")
        if not client:
            errors.append("Client name is required.")    
        if not scope_id:
            errors.append("Project scope is required.")
        if not design_teams:    
            errors.append("At least one design team must be selected.")
        if not importance:
            errors.append("Importance level is required.")
        if not design_needed_by:
            errors.append("Design needed by date is required.")
        if not execution_date:        
            errors.append("Execution date is required.")
        if not job_number:
            errors.append("Job number is required.")
        if not value:
            errors.append("Project value is required.")
        

        if job_number:
            existing = Project.query.filter_by(job_number=job_number).first()
            if existing:
                errors.append("Job number must be unique. A project with this job number already exists.")
        

        brief_file = None
        file = request.files.get('brief_file')
        if not file or file.filename == '':
            errors.append("Project brief file is required.")
        else:
            filename = secure_filename(file.filename)
            unique_filename = f"{uuid.uuid4().hex}_{filename}"
            file.save(os.path.join(current_app.config['UPLOAD_FOLDER'], unique_filename))
            brief_file = unique_filename
        
        if errors:
            for error in errors:
                flash(error, 'error')
            return render_template('projects/create.html', scopes=scopes, cs_users=cs_users)
        
        project = Project(
            name=name,
            cs_lead_id=int(cs_lead_id),
            client=client,
            scope_id=int(scope_id),
            design_teams_requested=','.join(design_teams),
            importance=importance,
            design_needed_by=date.fromisoformat(design_needed_by),
            execution_date=date.fromisoformat(execution_date),
            job_number=job_number,
            value=float(value),
            brief_file=brief_file,
            created_by_id=current_user.id
        )
        db.session.add(project)
        db.session.commit()

        flash(f'Project "{name}" created successfully.', 'success')
        return redirect(url_for('projects.index'))

    return render_template('projects/create.html',
                           scopes=scopes, cs_users=cs_users)

@projects.route('/projects/<int:project_id>')
@login_required
def detail(project_id):
    project = Project.query.get_or_404(project_id)
    designers = User.query.filter_by(role='designer').order_by(User.name).all()
    return render_template('projects/detail.html', project=project, designers=designers)

@projects.route('/projects/<int:project_id>/update-status', methods=['POST'])
@login_required
@role_required('admin')
def update_status(project_id):
    project = Project.query.get_or_404(project_id)
    new_status = request.form.get('status')

    TIMER_ACTIVE = {'In Progress', 'Revision in Progress'}

    was_active = project.status in TIMER_ACTIVE
    now_active = new_status in TIMER_ACTIVE

    if not was_active and now_active:
        if project.timer_started_at is None and project.hours_accumulated == 0:
            project.design_start_date = datetime.now()
        project.timer_started_at = datetime.now()

    if was_active and not now_active:
        if project.timer_started_at:
            from app.utils import work_hours_between
            project.hours_accumulated += work_hours_between(project.timer_started_at, datetime.now())
            project.timer_started_at = None
    
    project.status = new_status
    db.session.commit()

    flash(f'Project status updated to "{new_status}".', 'success')
    return redirect(url_for('projects.detail', project_id=project.id))
    
@projects.route('/projects/<int:project_id>/assign-designers', methods=['POST'])
@login_required
@role_required('admin')
def assign_designers(project_id):
    project = Project.query.get_or_404(project_id)

    lead_designer_id = request.form.get('lead_designer_id')
    project.lead_designer_id = int(lead_designer_id) if lead_designer_id else None

    ProjectDesigner.query.filter_by(project_id=project.id).delete()

    requested_teams = project.design_teams_requested.split(',')

    for team in requested_teams:
        field_name = f"designer_{team.lower()}"
        user_id = request.form.get(field_name)
        if user_id:
            assignment = ProjectDesigner(
                project_id=project.id,
                user_id=int(user_id),
                team=team
            )
            db.session.add(assignment)

    db.session.commit()
    flash('Designers assigned successfully.', 'success')
    return redirect(url_for('projects.detail', project_id=project.id))

@projects.route('/projects/<int:project_id>/download-brief')
@login_required
def download_brief(project_id):
    project = Project.query.get_or_404(project_id)
    return send_from_directory(
        current_app.config['UPLOAD_FOLDER'],
        project.brief_file,
        as_attachment=True
    )

        


