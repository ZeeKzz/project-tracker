import os
import uuid
from datetime import date
from flask import (Blueprint, render_template, redirect, url_for, flash, request, current_app, send_from_directory, jsonify)
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename
from app import db
from app.models import (Project, ProjectDesigner, Scope, User, Client,
                        Customer, DeliverableType, ProjectRegion,
                        ProjectCustomer, Deliverable, DeliverableAssignment,
                        DeliverableTypeDiscipline)
from app.decorators import role_required
from datetime import date, datetime
from app.notifications import notify_team_leads_of_new_project, notify_cs_lead_of_assignment

projects = Blueprint('projects', __name__)

@projects.route('/projects/create', methods=['GET'])
@login_required
@role_required('admin', 'cs')
def create():
    cs_users = User.query.filter(
        User.role.in_(['cs'])  
    ).order_by(User.name).all()

    clients = Client.query.order_by(Client.name).all()

    customers_raw = {
    'uae': Customer.query.filter_by(region='uae').order_by(Customer.name).all(),
    'kuwait': Customer.query.filter_by(region='kuwait').order_by(Customer.name).all(),
    'qatar': Customer.query.filter_by(region='qatar').order_by(Customer.name).all(),
    'bahrain': Customer.query.filter_by(region='bahrain').order_by(Customer.name).all(),
    'oman': Customer.query.filter_by(region='oman').order_by(Customer.name).all(),
    }

    customers_by_region = {
    region: [{'id': c.id, 'name': c.name} for c in customers]
    for region, customers in customers_raw.items()
    }

    draft = None
    draft_id = request.args.get('draft_id')
    if draft_id:
        candidate = Project.query.get(int(draft_id))
        if candidate and candidate.created_by_id == current_user.id and candidate.project_status == 'draft':
            draft = candidate

    return render_template(
        'projects/create.html',
        cs_users=cs_users,
        clients=clients,
        customers_by_region=customers_by_region,
        draft=draft
    )

@projects.route('/projects/autosave', methods=['POST'])
@login_required
@role_required('admin', 'cs')
def autosave():
    # Implementation for autosaving project data
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': 'No data provided'}), 400
    
    draft_id = data.get('draft_id')
    draft = None

    if draft_id:
        candidate = Project.query.get(int(draft_id))
        if candidate and candidate.created_by_id == current_user.id and candidate.project_status == 'draft':
            draft = candidate
    
    default_scope = Scope.query.filter_by(active=True).first()

    if not draft:
        draft = Project(
            name=data.get('name', '').strip() or 'Untitled Draft',
            client='TBD',
            cs_lead_id=int(data['cs_lead_id']) if data.get('cs_lead_id') else current_user.id,
            created_by=current_user,
            project_status='draft',
            scope_id=default_scope.id if default_scope else 1
        )
        db.session.add(draft)
        db.session.flush()  # Get the ID before commit for the response 

    
    draft.name = data.get('name', '').strip() or 'Untitled Draft'

    if data.get('cs_lead_id'):
        draft.cs_lead_id = int(data['cs_lead_id'])

    if data.get('client_id'):
        draft.client_id = int(data['client_id'])
    
    if data.get('job_number'):
        draft.job_number = data['job_number'].strip() or None
    
    if data.get('design_teams'):
        draft.design_teams_requested = ', '.join(data['design_teams'])
    
    if data.get('brief_type'):
        draft.brief_type = data['brief_type']
    
    if data.get('urgency'):
        draft.urgency = data['urgency']

    if data.get('required_output'):
        draft.required_output = data['required_output']

    if data.get('campaign_notes'):
        draft.campaign_notes = data['campaign_notes']

    if data.get('briefing_date'):
        from datetime import date
        draft.briefing_date = date.fromisoformat(data['briefing_date'])

    if data.get('first_output_deadline'):
        from datetime import date
        draft.first_output_deadline = date.fromisoformat(data['first_output_deadline'])

    if data.get('final_deadline'):
        from datetime import date
        draft.design_needed_by = date.fromisoformat(data['final_deadline']) 

    if data.get('installation_date'):
        from datetime import date
        draft.installation_date = date.fromisoformat(data['installation_date'])
    
    from datetime import datetime
    draft.last_autosaved_at = datetime.now()

    db.session.commit()

    return jsonify({'success': True, 'draft_id': draft.id})

@projects.route('/projects/<int:project_id>')
@login_required
def detail(project_id):
    project = Project.query.get_or_404(project_id)

    # Get designers organised by team for the assignment dropdowns
    designers_by_team = {
        '3D': User.query.filter(
            User.role.in_(['designer', 'team_lead']),
            User.team == '3D'
        ).order_by(User.name).all(),
        '2D': User.query.filter(
            User.role.in_(['designer', 'team_lead']),
            User.team == '2D'
        ).order_by(User.name).all(),
        'Technical': User.query.filter(
            User.role.in_(['designer', 'team_lead']),
            User.team == 'Technical'
        ).order_by(User.name).all(),
    }

    # Build a lookup dict mapping team name to its existing assignment (if any)
    assignments_by_team = {}
    for assignment in project.assigned_designers:
        assignments_by_team[assignment.team] = assignment

    return render_template(
        'projects/detail.html',
        project=project,
        designers_by_team=designers_by_team,
        assignments_by_team=assignments_by_team
    )

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
@role_required('admin', 'team_lead')
def assign_designers(project_id):
    project = Project.query.get_or_404(project_id)

    # Lead designer logic - commented out for MVP, will return in Phase 2
    # lead_designer_id = request.form.get('lead_designer_id')
    # project.lead_designer_id = int(lead_designer_id) if lead_designer_id else None

    requested_teams = [t.strip() for t in project.design_teams_requested.split(',')]

    # Track new assignments so we can fire notifications after commit
    new_assignments = []

    for team in requested_teams:
        field_name = f"designer_{team.lower()}"
        user_id = request.form.get(field_name)

        if not user_id:
            continue  # Skip teams that weren't submitted in this form

        # Team leads can only assign for their own team
        if current_user.role == 'team_lead' and current_user.team != team:
            continue

        designer = User.query.get(int(user_id))
        if not designer:
            continue

        # Remove existing assignment for THIS team only - not all teams
        existing = ProjectDesigner.query.filter_by(
            project_id=project.id,
            team=team
        ).first()
        if existing:
            db.session.delete(existing)

        # Create the new assignment
        assignment = ProjectDesigner(
            project_id=project.id,
            user_id=int(user_id),
            team=team
        )
        db.session.add(assignment)

        new_assignments.append((designer, team))

    db.session.commit()

    # Send notifications for each new assignment - after commit so the data is saved
    for designer, team in new_assignments:
        notify_cs_lead_of_assignment(
            project=project,
            designer=designer,
            team_name=team,
            triggered_by=current_user
        )

    flash('Designer assignment updated successfully.', 'success')
    return redirect(url_for('projects.detail', project_id=project_id))

@projects.route('/projects/<int:project_id>/download-brief')
@login_required
def download_brief(project_id):
    project = Project.query.get_or_404(project_id)
    return send_from_directory(
        current_app.config['UPLOAD_FOLDER'],
        project.brief_file,
        as_attachment=True
    )

@projects.route('/<int:project_id>/delete', methods=['POST'])
@login_required
def delete_project(project_id):
    project = Project.query.get_or_404(project_id)

    if current_user.role != 'admin' and project.cs_lead_id != current_user.id:
        flash('You do not have permission to delete this project.', 'error')
        return redirect(url_for('projects.detail', project_id=project.id))

    db.session.delete(project)
    db.session.commit()
    flash(f'Project "{project.name}" has been deleted.', 'success')
    return redirect(url_for('main.index'))


@projects.route('/projects/drafts')
@login_required
@role_required('admin', 'cs')
def drafts():
    user_drafts = Project.query.filter_by(
        created_by_id=current_user.id,
        project_status='draft'
    ).order_by(Project.last_autosaved_at.desc()).all()

    if not user_drafts:
        return redirect(url_for('projects.create'))

    return render_template('projects/drafts.html', drafts=user_drafts)


@projects.route('/projects/drafts/<int:draft_id>/delete', methods=['POST'])
@login_required
@role_required('admin', 'cs')
def delete_draft(draft_id):
    draft = Project.query.get_or_404(draft_id)

    if draft.created_by_id != current_user.id:
        return jsonify({'success': False, 'error': 'Unauthorised'}), 403

    if draft.project_status != 'draft':
        return jsonify({'success': False, 'error': 'This project is not a draft'}), 400

    db.session.delete(draft)
    db.session.commit()

    return jsonify({'success': True})

@projects.route('/projects/deliverable-types/<int:customer_id>')
@login_required
def get_deliverable_types(customer_id):
    client_id = request.args.get('client_id', type=int)

    types = DeliverableType.query.filter_by(
        customer_id=customer_id,
        client_id=client_id,
        is_active=True
    ).order_by(DeliverableType.name).all()

    return jsonify([{
        'id': dt.id,
        'name': dt.name,
        'disciplines': [d.team for d in dt.disciplines],
        'is_custom': dt.is_custom
    } for dt in types])


@projects.route('/clients/add', methods=['POST'])
@login_required
@role_required('admin', 'cs')
def add_client():
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({'success': False, 'error': 'Client name is required'}), 400

    try:
        name = data['name'].strip()

        existing = Client.query.filter_by(name=name).first()
        if existing:
            return jsonify({'success': False, 'error': 'A client with this name already exists'}), 400

        client = Client(name=name, created_by=current_user)
        db.session.add(client)
        db.session.commit()

        return jsonify({
            'success': True,
            'client': {'id': client.id, 'name': client.name}
        })

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Add client failed: {str(e)}')
        return jsonify({'success': False, 'error': 'Something went wrong. Please try again.'}), 500
    
@projects.route('/projects/deliverable-types/add', methods=['POST'])
@login_required
@role_required('cs', 'admin')
def add_deliverable_type():
    try:
        data = request.get_json()

        name = data.get('name', '').strip()
        client_id = data.get('client_id')
        customer_id = data.get('customer_id')
        disciplines = data.get('disciplines', [])

        if not name:
            return jsonify({'error': 'Deliverable name is required.'}), 400

        if not disciplines:
            return jsonify({'error': 'At least one discipline is required.'}), 400

        if not client_id or not customer_id:
            return jsonify({'error': 'Client and customer are required.'}), 400

        existing = DeliverableType.query.filter_by(
            name=name,
            client_id=client_id,
            customer_id=customer_id
        ).first()

        if existing:
            return jsonify({'error': 'A deliverable called "' + name + '" already exists for this customer.'}), 409

        new_type = DeliverableType(
            name=name,
            client_id=client_id,
            customer_id=customer_id,
            is_active=True,
            is_custom=True
        )
        db.session.add(new_type)
        db.session.flush()

        for team in disciplines:
            discipline = DeliverableTypeDiscipline(
                deliverable_type_id=new_type.id,
                team=team
            )
            db.session.add(discipline)

        db.session.commit()

        return jsonify({
            'id': new_type.id,
            'name': new_type.name,
            'disciplines': disciplines,
            'is_custom': True
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Something went wrong. Please try again.'}), 500




