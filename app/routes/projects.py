import os
import uuid
from datetime import date
from flask import (Blueprint, render_template, redirect, url_for, flash, request, current_app, send_from_directory, jsonify, abort, session)
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename
from app import db
from app.models import (Project, ProjectDesigner, Scope, User, Client,
                        Customer, DeliverableType, ProjectRegion,
                        ProjectCustomer, Deliverable, DeliverableAssignment,
                        DeliverableTypeDiscipline)
from app.decorators import role_required
from datetime import date, datetime
from app.notifications import notify_team_leads_of_new_project, notify_cs_lead_of_assignment, notify_designers_of_revision_flag, notify_cs_of_revision_submitted, notify_cs_of_brief_flag, notify_flag_reply, notify_cs_of_flag_resolved, notify_designer_of_concept_kv_assignment, create_notification
from app.utils import log_activity

projects = Blueprint('projects', __name__)

@projects.route('/projects/create', methods=['GET'])
@login_required
@role_required('admin', 'cs')
def create():
    cs_users = User.query.filter(
        User.role.in_(['cs', 'admin'])
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
    
    has_other_drafts = Project.query.filter_by(
         created_by_id=current_user.id,
         project_status='draft'
    ).count() > 0

    from app.models import DesignType, DesignDirection
    design_types = DesignType.query.order_by(DesignType.name).all()
    design_directions = DesignDirection.query.order_by(DesignDirection.name).all()

    return render_template(
        'projects/create.html',
        cs_users=cs_users,
        clients=clients,
        customers_by_region=customers_by_region,
        draft=draft,
        has_other_drafts=has_other_drafts,
        design_types=design_types,
        design_directions=design_directions,
        today=date.today().isoformat(),
    )

@projects.route('/projects/<int:project_id>/edit', methods=['GET'])
@login_required
@role_required('admin', 'cs')
def edit_project(project_id):
    project = Project.query.get_or_404(project_id)

    if current_user.role == 'cs' and project.cs_lead_id != current_user.id:
        abort(403)

    cs_users = User.query.filter(User.role.in_(['cs', 'admin'])).order_by(User.name).all()
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

    existing_customers = []
    for pc in project.project_customers:
        existing_customers.append({
            'customer_id': pc.customer_id,
            'region': pc.customer.region,
            'design_deadline': pc.design_deadline.isoformat() if pc.design_deadline else None,
            'installation_date': pc.installation_date.isoformat() if pc.installation_date else None,
        })

    existing_deliverables = []
    for d in project.project_deliverables:
        if d.project_customer_id is None:
            continue  # Skip standard brief deliverables (added post-creation)
        disciplines = [dtd.team.lower() for dtd in d.deliverable_type.disciplines] if d.deliverable_type else []
        existing_deliverables.append({
            'customer_id': d.project_customer.customer_id,
            'type_id': d.deliverable_type_id,
            'name': d.name,
            'disciplines': disciplines,
        })

    from app.models import DesignType, DesignDirection
    design_types = DesignType.query.order_by(DesignType.name).all()
    design_directions = DesignDirection.query.order_by(DesignDirection.name).all()

    existing_standard_deliverables = [
        {
            'name': d.name,
            'design_deadline': d.design_deadline.isoformat() if d.design_deadline else None,
            'teams': [t.strip() for t in d.teams.split(',')] if d.teams else []
        }
        for d in Deliverable.query.filter_by(
            project_id=project.id, project_customer_id=None
        ).order_by(Deliverable.created_at).all()
    ]

    return render_template(
        'projects/create.html',
        draft=project,
        edit_mode=True,
        edit_project_id=project.id,
        cs_users=cs_users,
        clients=clients,
        customers_by_region=customers_by_region,
        existing_customers=existing_customers,
        existing_deliverables=existing_deliverables,
        has_other_drafts=False,
        design_types=design_types,
        design_directions=design_directions,
        existing_standard_deliverables=existing_standard_deliverables,
        today=date.today().isoformat(),
    )


@projects.route('/projects/<int:project_id>/update', methods=['POST'])
@login_required
@role_required('admin', 'cs')
def update_project(project_id):
    project = Project.query.get_or_404(project_id)

    if current_user.role == 'cs' and project.cs_lead_id != current_user.id:
        abort(403)

    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        def parse_date(val):
            if not val:
                return None
            try:
                from datetime import datetime
                return datetime.strptime(val, '%Y-%m-%d').date()
            except ValueError:
                return None

        project.name = data['name']
        project.client_id = int(data['client_id']) if data.get('client_id') else project.client_id
        project.cs_lead_id = int(data['cs_lead_id']) if data.get('cs_lead_id') else project.cs_lead_id
        job_num = data.get('job_number')
        if job_num:
            conflict = Project.query.filter(
                Project.job_number == job_num,
                Project.id != project.id
            ).first()
            if conflict:
                return jsonify({'error': f'Job number {job_num} is already in use'}), 400
        project.job_number = job_num
        project.design_teams_requested = ','.join(data.get('design_teams', []))
        project.brief_type = data.get('brief_type', project.brief_type)
        project.urgency = data.get('urgency')
        project.required_output = data.get('required_output')
        project.campaign_notes = data.get('concept_requirements')
        project.concept_deadline = parse_date(data.get('concept_deadline'))
        project.has_concept = bool(data.get('has_concept', False))
        project.concept_options_required = data.get('concept_options_required')
        project.has_kv = bool(data.get('has_kv', False))
        project.kv_requirements = data.get('kv_requirements')
        project.kv_deadline = parse_date(data.get('kv_deadline'))
        project.kv_options_required = data.get('kv_options_required')
        # briefing_date intentionally excluded — locked for accountability
        project.first_output_deadline = parse_date(data.get('first_output_deadline'))
        project.execution_date = parse_date(data.get('final_deadline'))

        db.session.flush()

        if project.brief_type == 'standard':
            # Update standard brief fields
            project.design_type_id = int(data['design_type_id']) if data.get('design_type_id') else None
            project.design_direction_id = int(data['design_direction_id']) if data.get('design_direction_id') else None
            project.client_expectation = data.get('client_expectation')
            project.what_to_avoid = data.get('what_to_avoid')
            project.additional_information = data.get('additional_information')

            # Replace standard deliverables
            Deliverable.query.filter_by(project_id=project.id, project_customer_id=None).delete()
            db.session.flush()
            for del_item in data.get('standard_deliverables', []):
                if isinstance(del_item, str):
                    del_name = del_item.strip()
                    del_deadline = None
                    del_teams = None
                else:
                    del_name = (del_item.get('name') or '').strip()
                    raw_dd = del_item.get('design_deadline')
                    del_deadline = parse_date(raw_dd) if raw_dd else None
                    raw_teams = del_item.get('teams') or []
                    del_teams = ','.join(raw_teams) if raw_teams else None
                if not del_name:
                    continue
                db.session.add(Deliverable(
                    project_id=project.id,
                    project_customer_id=None,
                    deliverable_type_id=None,
                    name=del_name,
                    design_deadline=del_deadline,
                    teams=del_teams,
                    status='in_queue',
                    created_by=current_user
                ))
        else:
            ProjectRegion.query.filter_by(project_id=project.id).delete()
            for region_name in data.get('regions', []):
                db.session.add(ProjectRegion(project_id=project.id, region=region_name))

            for pc in ProjectCustomer.query.filter_by(project_id=project.id).all():
                db.session.delete(pc)
            db.session.flush()

            customer_map = {}
            for item in data.get('deliverables', []):
                customer_id = int(item['customer_id'])
                if customer_id not in customer_map:
                    customer_dates = data.get('customer_dates', {})
                    dates = customer_dates.get(str(customer_id), {})
                    pc = ProjectCustomer(
                        project_id=project.id,
                        customer_id=customer_id,
                        design_deadline=parse_date(dates.get('design_deadline')),
                        installation_date=parse_date(dates.get('installation_date')),
                    )
                    db.session.add(pc)
                    db.session.flush()
                    customer_map[customer_id] = pc.id

                db.session.add(Deliverable(
                    project_id=project.id,
                    project_customer_id=customer_map[customer_id],
                    deliverable_type_id=int(item['type_id']) if item.get('type_id') and item['type_id'] != 'custom' else None,
                    name=item['name'],
                    created_by=current_user
                ))

        db.session.commit()

        log_activity('project_edited', f'Project "{project.name}" was edited by {current_user.name}',
                     user=current_user, entity_type='project', entity_name=project.name, entity_id=project.id)

        return jsonify({'success': True, 'redirect_url': url_for('projects.detail', project_id=project.id)})

    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Something went wrong. Please try again.'}), 500


@projects.route('/projects/autosave', methods=['POST'])
@login_required
@role_required('admin', 'cs')
def autosave():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400

        draft_id = data.get('draft_id')
        draft = None

        if draft_id:
            candidate = Project.query.get(int(draft_id))
            if candidate and candidate.created_by_id == current_user.id and candidate.project_status == 'draft':
                draft = candidate
            elif candidate and candidate.project_status != 'draft':
                return jsonify({'success': False, 'error': 'Project already submitted'}), 400

        default_scope = Scope.query.filter_by(active=True).first()

        if not draft:
            draft = Project(
                name=data.get('name', '').strip() or 'Untitled Draft',
                client='TBD',
                cs_lead_id=int(data['cs_lead_id']) if data.get('cs_lead_id') else current_user.id,
                creator=current_user,
                project_status='draft',
                scope_id=default_scope.id if default_scope else 1
            )
            db.session.add(draft)
            db.session.flush()

        draft.name = data.get('name', '').strip() or 'Untitled Draft'

        if data.get('cs_lead_id'):
            draft.cs_lead_id = int(data['cs_lead_id'])

        if data.get('client_id'):
            draft.client_id = int(data['client_id'])

        if data.get('job_number'):
            job_num = data['job_number'].strip()
            conflict = Project.query.filter(
                Project.job_number == job_num,
                Project.id != draft.id
            ).first()
            if not conflict:
                draft.job_number = job_num or None

        if data.get('design_teams'):
            draft.design_teams_requested = ', '.join(data['design_teams'])

        if data.get('brief_type'):
            draft.brief_type = data['brief_type']

        if data.get('urgency'):
            draft.urgency = data['urgency']

        if data.get('required_output'):
            draft.required_output = data['required_output']

        if data.get('concept_deadline'):
            draft.concept_deadline = date.fromisoformat(data['concept_deadline'])

        if data.get('concept_requirements') is not None:
            draft.campaign_notes = data['concept_requirements']

        if 'has_concept' in data:
            draft.has_concept = bool(data['has_concept'])

        if data.get('concept_options_required') is not None:
            draft.concept_options_required = data['concept_options_required']

        if 'has_kv' in data:
            draft.has_kv = bool(data['has_kv'])

        if data.get('kv_requirements') is not None:
            draft.kv_requirements = data['kv_requirements']

        if data.get('kv_deadline'):
            draft.kv_deadline = date.fromisoformat(data['kv_deadline'])

        if data.get('kv_options_required') is not None:
            draft.kv_options_required = data['kv_options_required']

        if data.get('briefing_date'):
            draft.briefing_date = date.fromisoformat(data['briefing_date'])

        if data.get('first_output_deadline'):
            draft.first_output_deadline = date.fromisoformat(data['first_output_deadline'])

        if data.get('final_deadline'):
            draft.design_needed_by = date.fromisoformat(data['final_deadline'])

        if data.get('installation_date'):
            draft.installation_date = date.fromisoformat(data['installation_date'])

        # Standard brief fields
        if data.get('design_type_id'):
            draft.design_type_id = int(data['design_type_id'])
        elif data.get('design_type_id') is None and 'design_type_id' in data:
            draft.design_type_id = None

        if data.get('design_direction_id'):
            draft.design_direction_id = int(data['design_direction_id'])
        elif data.get('design_direction_id') is None and 'design_direction_id' in data:
            draft.design_direction_id = None

        if data.get('client_expectation') is not None:
            draft.client_expectation = data['client_expectation']

        if data.get('what_to_avoid') is not None:
            draft.what_to_avoid = data['what_to_avoid']

        if data.get('additional_information') is not None:
            draft.additional_information = data['additional_information']

        draft.last_autosaved_at = datetime.now()
        db.session.commit()

        return jsonify({'success': True, 'draft_id': draft.id})

    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': 'Autosave failed'}), 500

@projects.route('/projects/<int:project_id>')
@login_required
def detail(project_id):
    project = Project.query.get_or_404(project_id)

    from app.models import ProjectSubmission
    import json as _json

    # Active submission: the deck currently under review or awaiting upload
    active_submission = ProjectSubmission.query.filter_by(
        project_id=project_id, is_active=True
    ).first()

    # Submission history: only decks that were fully submitted to the client.
    # Drafts/flagged decks that were replaced are not in this list (their files were deleted).
    submitted_history = ProjectSubmission.query.filter(
        ProjectSubmission.project_id == project_id,
        ProjectSubmission.submitted_to_client_at.isnot(None)
    ).order_by(ProjectSubmission.submitted_to_client_at.desc()).all()

    # All inactive submissions that were NOT submitted to client (flagged drafts) — for completeness
    past_submissions = ProjectSubmission.query.filter_by(
        project_id=project_id, is_active=False
    ).order_by(ProjectSubmission.uploaded_at.desc()).all()

    # Deliverables as JSON for the submission deliverable picker (JS needs this)
    # Only include standard deliverables (no project_customer_id) — the ones
    # shown on the page that the designer can include in the deck
    all_deliverables_for_picker = Deliverable.query.filter_by(
        project_id=project_id
    ).order_by(Deliverable.created_at).all()

    deliverables_json = _json.dumps([
        {'id': d.id, 'name': d.name, 'status': d.status}
        for d in all_deliverables_for_picker
    ])

    _d3 = User.query.filter(User.role.in_(['designer', 'team_lead']), User.team == '3D').order_by(User.name).all()
    _d2 = User.query.filter(User.role.in_(['designer', 'team_lead']), User.team == '2D').order_by(User.name).all()
    _dt = User.query.filter(User.role.in_(['designer', 'team_lead']), User.team == 'Technical').order_by(User.name).all()
    designers_by_team = {
        '3D': _d3, '3d': _d3,
        '2D': _d2, '2d': _d2,
        'Technical': _dt, 'technical': _dt,
    }

    assignments_by_team = {}
    for assignment in project.assigned_designers:
        assignments_by_team[assignment.team] = assignment

    brief_sections = {}
    for pc in project.project_customers:
        region = pc.customer.region
        if region not in brief_sections:
            brief_sections[region] = []
        brief_sections[region].append(pc)

    assignments_by_deliverable = {}
    for deliverable in project.project_deliverables:
        by_team = {}
        for assignment in deliverable.disciplines:
            by_team[assignment.team] = assignment  # DeliverableAssignment object (one per team)
        assignments_by_deliverable[deliverable.id] = by_team

    from app.models import BriefFlag
    open_flags = BriefFlag.query.filter_by(project_id=project_id, is_resolved=False).order_by(BriefFlag.created_at).all()
    all_flags = BriefFlag.query.filter_by(project_id=project_id).order_by(BriefFlag.created_at.desc()).all()

    # Standard brief deliverables (no project_customer_id)
    standard_deliverables = Deliverable.query.filter_by(
        project_id=project_id, project_customer_id=None
    ).order_by(Deliverable.created_at).all()

    standard_assignments_by_deliverable = {}
    for d in standard_deliverables:
        # Standard deliverables have one assignment per deliverable (not per team)
        asgn = d.disciplines[0] if d.disciplines else None
        standard_assignments_by_deliverable[d.id] = asgn

    # Designers per standard brief deliverable — filtered by each deliverable's own teams
    # Falls back to the project's design type teams, then all designers
    dt = project.design_type
    dt_teams = [t.strip() for t in dt.team.split(',') if t.strip()] if (dt and dt.team) else []

    def _designers_for_teams(teams):
        if not teams:
            return [d for team_list in designers_by_team.values() for d in team_list]
        pool = []
        for t in teams:
            pool.extend(designers_by_team.get(t, []))
        seen = set()
        return [d for d in pool if not (d.id in seen or seen.add(d.id))]

    # Fallback: project-level design type teams
    standard_designers = _designers_for_teams(dt_teams)
    standard_team = dt.team if (dt and dt.team) else None

    # Per-deliverable overrides when the deliverable itself has teams set
    standard_designers_by_deliverable = {}
    for d in standard_deliverables:
        if d.teams:
            d_teams = [t.strip() for t in d.teams.split(',') if t.strip()]
            standard_designers_by_deliverable[d.id] = _designers_for_teams(d_teams)
        else:
            standard_designers_by_deliverable[d.id] = standard_designers

    return render_template(
        'projects/detail.html',
        project=project,
        designers_by_team=designers_by_team,
        assignments_by_team=assignments_by_team,
        brief_sections=brief_sections,
        assignments_by_deliverable=assignments_by_deliverable,
        open_flags=open_flags,
        all_flags=all_flags,
        standard_deliverables=standard_deliverables,
        standard_assignments_by_deliverable=standard_assignments_by_deliverable,
        standard_designers=standard_designers,
        standard_team=standard_team,
        standard_designers_by_deliverable=standard_designers_by_deliverable,
        active_submission=active_submission,
        past_submissions=past_submissions,
        submitted_history=submitted_history,
        deliverables_json=deliverables_json
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

@projects.route('/projects/<int:project_id>/set-status', methods=['POST'])
@login_required
@role_required('admin', 'cs', 'designer', 'team_lead')
def set_project_status(project_id):
    from app.utils import log_activity
    project = Project.query.get_or_404(project_id)
    data = request.get_json()
    new_status = data.get('status')

    VALID = ['briefed', 'in_queue', 'in_progress', 'submitted',
             'revision_in_queue', 'revision_in_progress', 'approved']
    if new_status not in VALID:
        return jsonify({'error': 'Invalid status'}), 400

    old_status = project.project_status
    project.project_status = new_status
    db.session.commit()

    log_activity(
        'project_status_changed',
        f'Project "{project.name}" status changed from "{old_status}" to "{new_status}" by {current_user.name}',
        user=current_user, entity_type='project', entity_name=project.name, entity_id=project.id
    )
    return jsonify({'success': True})  

@projects.route('/projects/<int:project_id>/customer/<int:pc_id>/set-status', methods=['POST'])
@login_required
@role_required('admin', 'cs', 'designer', 'team_lead')
def set_customer_status(project_id, pc_id):
    from app.utils import log_activity
    from app.models import ProjectCustomer
    project = Project.query.get_or_404(project_id)
    pc = ProjectCustomer.query.get_or_404(pc_id)
    data = request.get_json()
    new_status = data.get('status')

    VALID = ['briefed', 'in_queue', 'in_progress', 'submitted',
             'revision_in_queue', 'revision_in_progress', 'approved']
    if new_status not in VALID:
        return jsonify({'error': 'Invalid status'}), 400

    old_status = pc.status
    pc.status = new_status
    db.session.commit()

    log_activity(
        'customer_status_changed',
        f'Customer "{pc.customer.name}" on "{project.name}" status changed from "{old_status}" to "{new_status}" by {current_user.name}',
        user=current_user, entity_type='project', entity_name=project.name, entity_id=project.id
    )
    return jsonify({'success': True})

@projects.route('/projects/<int:project_id>/deliverable/<int:d_id>/set-status', methods=['POST'])
@login_required
@role_required('admin', 'cs', 'designer', 'team_lead')
def set_deliverable_status(project_id, d_id):
    from app.utils import log_activity
    from app.models import Deliverable
    project = Project.query.get_or_404(project_id)
    deliverable = Deliverable.query.get_or_404(d_id)
    data = request.get_json()
    new_status = data.get('status')

    # Valid deliverable statuses — includes the new submission flow statuses
    VALID = ['in_queue', 'in_progress', 'submitted',
             'revision_in_queue', 'revision_in_progress', 'approved',
             'internal_review', 'internal_revision', 'submitted_to_client']
    if new_status not in VALID:
        return jsonify({'error': 'Invalid status'}), 400

    from app.models import Deliverable as Del

    old_status = deliverable.status
    deliverable.status = new_status

    revision_completed = False

    # Per-deliverable revision cycle: when a designer re-submits a flagged deliverable
    # and it's the last flagged one, increment per-deliverable revision counts.
    # NOTE: project.revision_count and project_status are no longer changed here —
    # those are now managed exclusively by the client submission flow (submit_to_client).
    if new_status == 'submitted' and deliverable.flagged_for_revision:
        others_pending = Del.query.filter(
            Del.project_id == project_id,
            Del.flagged_for_revision == True,
            Del.id != deliverable.id,
            Del.status != 'submitted'
        ).count()

        if others_pending == 0:
            # Last flagged deliverable re-submitted — clear all revision flags
            all_flagged = Del.query.filter_by(project_id=project_id, flagged_for_revision=True).all()
            for d in all_flagged:
                d.revision_count += 1
                d.flagged_for_revision = False
            revision_completed = True

    db.session.commit()

    log_activity(
        'deliverable_status_changed',
        f'Deliverable "{deliverable.name}" on "{project.name}" status changed from "{old_status}" to "{new_status}" by {current_user.name}',
        user=current_user, entity_type='project', entity_name=project.name, entity_id=project.id
    )

    if revision_completed:
        notify_cs_of_revision_submitted(project, triggered_by=current_user)

    return jsonify({'success': True, 'revision_completed': revision_completed})

@projects.route('/projects/<int:project_id>/deliverable/<int:d_id>/flag-revision', methods=['POST'])
@login_required
@role_required('admin', 'cs')
def flag_deliverable_revision(project_id, d_id):
    from app.models import Deliverable
    project = Project.query.get_or_404(project_id)
    deliverable = Deliverable.query.get_or_404(d_id)

    deliverable.flagged_for_revision = True
    deliverable.status = 'revision_in_queue'
    project.project_status = 'revision_in_queue'

    db.session.commit()

    notify_designers_of_revision_flag(deliverable, project, triggered_by=current_user)

    log_activity(
        'revision_flagged',
        f'"{deliverable.name}" on "{project.name}" flagged for revision by {current_user.name}',
        user=current_user, entity_type='project', entity_name=project.name, entity_id=project.id
    )

    return jsonify({'success': True})


@projects.route('/projects/<int:project_id>/deliverable/<int:d_id>/assign', methods=['POST'])
@login_required
@role_required('admin', 'designer', 'team_lead')
def assign_deliverable(project_id, d_id):
    from app.models import Deliverable, DeliverableAssignment
    project = Project.query.get_or_404(project_id)
    deliverable = Deliverable.query.get_or_404(d_id)

    designer_id = request.form.get('designer_id')
    team = request.form.get('team')

    if not designer_id or not team:
        return redirect(url_for('projects.detail', project_id=project_id))

    designer_id = int(designer_id)
    designer = User.query.get_or_404(designer_id)

    existing = DeliverableAssignment.query.filter_by(
        deliverable_id=d_id,
        team=team
    ).first()

    if existing:
        existing.designer_id = designer_id
        existing.assigned_by_id = current_user.id
        existing.assigned_at = datetime.utcnow()
        action_word = 'reassigned'
    else:
        db.session.add(DeliverableAssignment(
            deliverable_id=d_id,
            designer_id=designer_id,
            team=team,
            assigned_by_id=current_user.id
        ))
        action_word = 'assigned'

    db.session.commit()

    log_activity(
        'deliverable_assigned',
        f'{designer.name} {action_word} to "{deliverable.name}" ({team}) on "{project.name}" by {current_user.name}',
        user=current_user, entity_type='project', entity_name=project.name, entity_id=project.id
    )

    return redirect(url_for('projects.detail', project_id=project_id))


# ── Brief Flag System ────────────────────────────────────────────────────────

@projects.route('/projects/<int:project_id>/flags/create', methods=['POST'])
@login_required
@role_required('admin', 'cs', 'designer', 'team_lead')
def create_flag(project_id):
    from app.models import BriefFlag, BriefFlagMessage, User as UserModel
    project = Project.query.get_or_404(project_id)
    data = request.get_json()

    flag_type = data.get('flag_type')
    deliverable_id = data.get('deliverable_id')
    message_text = (data.get('message') or '').strip()

    if flag_type not in ('project', 'deliverable', 'concept', 'kv') or not message_text:
        return jsonify({'error': 'Invalid data'}), 400

    emulating_id = session.get('emulating_user_id')
    actor = UserModel.query.get(emulating_id) if (emulating_id and current_user.role == 'admin') else current_user

    flag = BriefFlag(
        project_id=project_id,
        deliverable_id=deliverable_id or None,
        flag_type=flag_type,
        created_by_id=actor.id
    )
    db.session.add(flag)
    db.session.flush()

    db.session.add(BriefFlagMessage(
        flag_id=flag.id,
        author_id=actor.id,
        message=message_text
    ))
    db.session.commit()

    notify_cs_of_brief_flag(flag, project, triggered_by=actor)

    log_activity(
        'brief_flag_created',
        f'{actor.name} raised a {flag_type} flag on "{project.name}"',
        user=actor, entity_type='project', entity_name=project.name, entity_id=project.id
    )

    return jsonify({'success': True})


@projects.route('/projects/<int:project_id>/flags/<int:flag_id>/reply', methods=['POST'])
@login_required
@role_required('admin', 'cs', 'designer', 'team_lead')
def reply_flag(project_id, flag_id):
    from app.models import BriefFlag, BriefFlagMessage, User as UserModel
    project = Project.query.get_or_404(project_id)
    flag = BriefFlag.query.get_or_404(flag_id)

    message_text = (request.form.get('message') or '').strip()
    if not message_text:
        return redirect(url_for('projects.detail', project_id=project_id))

    emulating_id = session.get('emulating_user_id')
    actor = UserModel.query.get(emulating_id) if (emulating_id and current_user.role == 'admin') else current_user

    db.session.add(BriefFlagMessage(
        flag_id=flag_id,
        author_id=actor.id,
        message=message_text
    ))
    db.session.commit()

    notify_flag_reply(flag, project, triggered_by=actor)

    log_activity(
        'brief_flag_reply',
        f'{actor.name} replied to a flag on "{project.name}"',
        user=actor, entity_type='project', entity_name=project.name, entity_id=project.id
    )

    return redirect(url_for('projects.detail', project_id=project_id))


@projects.route('/projects/<int:project_id>/flags/<int:flag_id>/resolve', methods=['POST'])
@login_required
@role_required('admin', 'designer', 'team_lead')
def resolve_flag(project_id, flag_id):
    from app.models import BriefFlag, User as UserModel
    project = Project.query.get_or_404(project_id)
    flag = BriefFlag.query.get_or_404(flag_id)

    emulating_id = session.get('emulating_user_id')
    actor = UserModel.query.get(emulating_id) if (emulating_id and current_user.role == 'admin') else current_user

    if flag.created_by_id != actor.id and current_user.role != 'admin':
        return jsonify({'error': 'Only the person who raised this flag can resolve it'}), 403

    flag.is_resolved = True
    flag.resolved_at = datetime.utcnow()
    flag.resolved_by_id = actor.id
    db.session.commit()

    notify_cs_of_flag_resolved(flag, project, triggered_by=actor)

    log_activity(
        'brief_flag_resolved',
        f'{actor.name} resolved a {flag.flag_type} flag on "{project.name}"',
        user=actor, entity_type='project', entity_name=project.name, entity_id=project.id
    )

    return jsonify({'success': True})


# ── Designer / Team assignment ───────────────────────────────────────────────

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
        log_activity('designer_assigned', f'{designer.name} assigned to {team} team on "{project.name}"', user=current_user, entity_type='project', entity_name=project.name, entity_id=project.id)

    flash('Designer assignment updated successfully.', 'success')
    return redirect(url_for('projects.detail', project_id=project_id))

@projects.route('/projects/<int:project_id>/assign-concept-kv', methods=['POST'])
@login_required
@role_required('admin', 'team_lead', 'cs')
def assign_concept_kv(project_id):
    project = Project.query.get_or_404(project_id)

    # Only admin and 2D team lead can assign concept/KV designers
    is_allowed = (
        current_user.role == 'admin' or
        (current_user.role == 'team_lead' and current_user.team == '2D')
    )
    if not is_allowed:
        abort(403)

    concept_id = request.form.get('concept_designer_id')
    kv_id = request.form.get('kv_designer_id')

    if concept_id:
        project.concept_designer_id = int(concept_id)
    if kv_id:
        project.kv_designer_id = int(kv_id)

    db.session.commit()
    if concept_id:
        concept_designer = User.query.get(int(concept_id))
        if concept_designer:
            notify_designer_of_concept_kv_assignment(project, concept_designer, 'Concept', triggered_by=current_user)
            log_activity('designer_assigned', f'{concept_designer.name} assigned as Concept designer on "{project.name}"', user=current_user, entity_type='project', entity_name=project.name, entity_id=project.id)
    if kv_id:
        kv_designer = User.query.get(int(kv_id))
        if kv_designer:
            notify_designer_of_concept_kv_assignment(project, kv_designer, 'Key Visual', triggered_by=current_user)
            log_activity('designer_assigned', f'{kv_designer.name} assigned as KV designer on "{project.name}"', user=current_user, entity_type='project', entity_name=project.name, entity_id=project.id)
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

@projects.route('/<int:project_id>/delete', methods=['POST'])
@login_required
def delete_project(project_id):
    from app.models import ProjectFile

    # Use effective_user so emulation mode respects the underlying admin session
    effective_user = User.query.get(session['emulating_user_id']) if session.get('emulating_user_id') else current_user

    project = Project.query.get_or_404(project_id)

    if effective_user.role != 'admin' and project.cs_lead_id != effective_user.id:
        flash('You do not have permission to delete this project.', 'error')
        return redirect(url_for('projects.detail', project_id=project.id))

    # Remove any uploaded reference files from disk before deleting the project row.
    # The SQLAlchemy cascade handles the DB records; this handles the physical files.
    upload_folder = current_app.config['UPLOAD_FOLDER']
    for ref_file in project.reference_files:
        file_path = os.path.join(upload_folder, ref_file.filename)
        if os.path.exists(file_path):
            os.remove(file_path)

    project_name = project.name
    db.session.delete(project)
    db.session.commit()
    flash(f'Project "{project_name}" has been deleted.', 'success')
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
        log_activity('deliverable_created', f'Custom deliverable type "{new_type.name}" created', user=current_user, entity_type='deliverable', entity_name=new_type.name, entity_id=new_type.id)

        return jsonify({
            'id': new_type.id,
            'name': new_type.name,
            'disciplines': disciplines,
            'is_custom': True
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Something went wrong. Please try again.'}), 500
    

@projects.route('/projects/submit', methods=['POST'])
@login_required
@role_required('cs', 'admin')
def submit_project():
    try:
        data = request.get_json()

        print(f"Draft ID received: {data.get('draft_id')}")
        print(f"Current user ID: {current_user.id}")

        # ── Basic validation ─────────────────────────────────
        required_fields = ['name', 'client_id', 'cs_lead_id', 'brief_type']
        for field in required_fields:
          if not data.get(field):
             return jsonify({'error': f'Missing required field: {field}'}), 400

        # ── Parse dates ──────────────────────────────────────
        from datetime import datetime
        def parse_date(val):
            if not val:
                return None
            try:
                return datetime.strptime(val, '%Y-%m-%d').date()
            except ValueError:
                return None

        # ── Promote draft to active, or create fresh ─────────
        draft_id = data.get('draft_id')
        project = None

        if draft_id:
            candidate = Project.query.get(int(draft_id))
            if candidate and candidate.created_by_id == current_user.id and candidate.project_status == 'draft':
                project = candidate

        if not project:
            project = Project(creator=current_user)
            db.session.add(project)

        project.name = data['name']
        project.client_id = int(data['client_id'])
        project.cs_lead_id = int(data['cs_lead_id'])
        job_num = data.get('job_number')
        if job_num:
            conflict = Project.query.filter(
                Project.job_number == job_num,
                Project.id != project.id
            ).first()
            if conflict:
                return jsonify({'error': f'Job number {job_num} is already in use'}), 400
        project.job_number = job_num
        project.design_teams_requested = ','.join(data.get('design_teams', []))
        project.brief_type = data['brief_type']
        project.project_status = 'briefed'
        project.urgency = data.get('urgency')
        project.required_output = data.get('required_output')
        project.campaign_notes = data.get('concept_requirements')
        project.concept_deadline = parse_date(data.get('concept_deadline'))
        project.has_concept = bool(data.get('has_concept', False))
        project.concept_options_required = data.get('concept_options_required')
        project.has_kv = bool(data.get('has_kv', False))
        project.kv_requirements = data.get('kv_requirements')
        project.kv_deadline = parse_date(data.get('kv_deadline'))
        project.kv_options_required = data.get('kv_options_required')
        project.briefing_date = parse_date(data.get('briefing_date'))
        project.first_output_deadline = parse_date(data.get('first_output_deadline'))
        project.execution_date = parse_date(data.get('final_deadline'))
        project.installation_date = parse_date(data.get('installation_date'))

        # ── Standard brief fields ────────────────────────────
        if data['brief_type'] == 'standard':
            from app.models import DesignType, DesignDirection
            project.design_type_id = int(data['design_type_id']) if data.get('design_type_id') else None
            project.design_direction_id = int(data['design_direction_id']) if data.get('design_direction_id') else None
            project.client_expectation = data.get('client_expectation')
            project.what_to_avoid = data.get('what_to_avoid')
            project.additional_information = data.get('additional_information')

        db.session.flush()

        if data['brief_type'] == 'standard':
            for del_item in data.get('standard_deliverables', []):
                if isinstance(del_item, str):
                    del_name = del_item.strip()
                    del_deadline = None
                    del_teams = None
                else:
                    del_name = (del_item.get('name') or '').strip()
                    raw_dd = del_item.get('design_deadline')
                    del_deadline = datetime.strptime(raw_dd, '%Y-%m-%d').date() if raw_dd else None
                    raw_teams = del_item.get('teams') or []
                    del_teams = ','.join(raw_teams) if raw_teams else None
                if not del_name:
                    continue
                deliverable = Deliverable(
                    project_id=project.id,
                    project_customer_id=None,
                    deliverable_type_id=None,
                    name=del_name,
                    design_deadline=del_deadline,
                    teams=del_teams,
                    status='in_queue',
                    created_by=current_user
                )
                db.session.add(deliverable)
        else:
            # ── Create regions ───────────────────────────────────
            ProjectRegion.query.filter_by(project_id=project.id).delete()
            for region_name in data['regions']:
                region = ProjectRegion(
                    project_id=project.id,
                    region=region_name
                )
                db.session.add(region)

            # ── Create customers and deliverables ────────────────
            for pc in ProjectCustomer.query.filter_by(project_id=project.id).all():
                db.session.delete(pc)
            db.session.flush()

            customer_map = {}
            for item in data['deliverables']:
                customer_id = int(item['customer_id'])

                if customer_id not in customer_map:
                    customer_dates = data.get('customer_dates', {})
                    dates = customer_dates.get(str(customer_id), {})
                    project_customer = ProjectCustomer(
                        project_id=project.id,
                        customer_id=customer_id,
                        design_deadline=datetime.strptime(dates['design_deadline'], '%Y-%m-%d').date() if dates.get('design_deadline') else None,
                        installation_date=datetime.strptime(dates['installation_date'], '%Y-%m-%d').date() if dates.get('installation_date') else None,
                        status='briefed'
                    )
                    db.session.add(project_customer)
                    db.session.flush()
                    customer_map[customer_id] = project_customer.id

                deliverable = Deliverable(
                    project_id=project.id,
                    project_customer_id=customer_map[customer_id],
                    deliverable_type_id=int(item['type_id']) if item.get('type_id') and item['type_id'] != 'custom' else None,
                    name=item['name'],
                    created_by=current_user,
                    status='in_queue'
                )
                db.session.add(deliverable)

        db.session.commit()

        # Notifications (non-blocking)
        try:
            selected_cs_id = int(data['cs_lead_id'])
            if selected_cs_id != current_user.id:
                cs_lead = User.query.get(selected_cs_id)
                if cs_lead:
                    create_notification(
                        recipient=cs_lead,
                        message=f'You have been assigned as CS Lead on "{project.name}".',
                        notification_type='project_assigned',
                        project=project,
                        triggered_by=current_user
                    )

            disciplines_used = set()
            for item in data.get('deliverables', []):
                if item.get('type_id') and item['type_id'] != 'custom':
                    dt = DeliverableType.query.get(int(item['type_id']))
                    if dt:
                        for d in dt.disciplines:
                            disciplines_used.add(d.team)

            team_leads = User.query.filter_by(role='team_lead').all()
            for lead in team_leads:
                if lead.team in disciplines_used:
                    create_notification(
                        recipient=lead,
                        message=f'New project "{project.name}" requires your team. Please assign designers.',
                        notification_type='project_assigned',
                        project=project,
                        triggered_by=current_user
                    )
        except Exception as notif_err:
            import traceback
            traceback.print_exc()

        log_activity('project_submitted', f'Project "{project.name}" submitted', user=current_user, entity_type='project', entity_name=project.name, entity_id=project.id)

        return jsonify({
            'success': True,
            'project_id': project.id,
            'redirect_url': '/'
        }), 201

    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Something went wrong. Please try again.'}), 500


# ── Standard Brief Deliverables ───────────────────────────────────────────────

@projects.route('/projects/<int:project_id>/standard-deliverables/add', methods=['POST'])
@login_required
@role_required('admin', 'cs', 'designer', 'team_lead')
def add_standard_deliverable(project_id):
    project = Project.query.get_or_404(project_id)
    data = request.get_json()
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Deliverable name is required'}), 400

    from datetime import date as date_type
    def parse_date(val):
        if not val:
            return None
        try:
            from datetime import datetime
            return datetime.strptime(val, '%Y-%m-%d').date()
        except ValueError:
            return None

    deliverable = Deliverable(
        project_id=project_id,
        project_customer_id=None,
        deliverable_type_id=None,
        name=name,
        design_deadline=parse_date(data.get('design_deadline')),
        installation_deadline=parse_date(data.get('installation_deadline')),
        status='in_queue',
        created_by=current_user
    )
    db.session.add(deliverable)
    db.session.commit()

    log_activity('deliverable_created', f'Standard deliverable "{name}" added to "{project.name}"',
                 user=current_user, entity_type='project', entity_name=project.name, entity_id=project.id)

    return jsonify({
        'id': deliverable.id,
        'name': deliverable.name,
        'status': deliverable.status,
        'design_deadline': deliverable.design_deadline.isoformat() if deliverable.design_deadline else None,
        'installation_deadline': deliverable.installation_deadline.isoformat() if deliverable.installation_deadline else None,
    })


@projects.route('/projects/<int:project_id>/standard-deliverables/<int:d_id>/delete', methods=['POST'])
@login_required
@role_required('admin', 'cs')
def delete_standard_deliverable(project_id, d_id):
    deliverable = Deliverable.query.filter_by(id=d_id, project_id=project_id).first_or_404()
    name = deliverable.name
    project = Project.query.get_or_404(project_id)
    db.session.delete(deliverable)
    db.session.commit()
    log_activity('deliverable_deleted', f'Standard deliverable "{name}" removed from "{project.name}"',
                 user=current_user, entity_type='project', entity_name=project.name, entity_id=project.id)
    return jsonify({'success': True})


@projects.route('/projects/<int:project_id>/standard-deliverables/<int:d_id>/assign', methods=['POST'])
@login_required
@role_required('admin', 'designer', 'team_lead')
def assign_standard_deliverable(project_id, d_id):
    from app.models import DeliverableAssignment
    project = Project.query.get_or_404(project_id)
    deliverable = Deliverable.query.filter_by(id=d_id, project_id=project_id).first_or_404()

    designer_id = request.form.get('designer_id')
    if not designer_id:
        return redirect(url_for('projects.detail', project_id=project_id))

    designer_id = int(designer_id)
    designer = User.query.get_or_404(designer_id)
    team = designer.team or 'General'

    # For standard brief deliverables, one assignment per deliverable (replace any existing)
    existing = DeliverableAssignment.query.filter_by(deliverable_id=d_id).first()
    if existing:
        existing.designer_id = designer_id
        existing.team = team
        existing.assigned_by_id = current_user.id
        existing.assigned_at = datetime.utcnow()
    else:
        db.session.add(DeliverableAssignment(
            deliverable_id=d_id,
            designer_id=designer_id,
            team=team,
            assigned_by_id=current_user.id
        ))

    db.session.commit()
    log_activity('deliverable_assigned',
                 f'{designer.name} assigned to "{deliverable.name}" on "{project.name}"',
                 user=current_user, entity_type='project', entity_name=project.name, entity_id=project.id)
    return redirect(url_for('projects.detail', project_id=project_id))

import uuid

@projects.route('/projects/<int:project_id>/upload-file', methods=['POST'])
@login_required
@role_required('admin', 'cs')
def upload_project_file(project_id):
    """Handle reference file uploads for a project. CS and admin only."""
    from app.models import ProjectFile
    import os

    project = Project.query.get_or_404(project_id)

    # Check a file was actually included in the request
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'No file provided'}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({'success': False, 'error': 'No file selected'}), 400

    # Only allow safe file types
    allowed_extensions = {'jpg', 'jpeg', 'png', 'pdf', 'docx', 'xlsx', 'pptx'}
    original_filename = file.filename
    ext = original_filename.rsplit('.', 1)[-1].lower() if '.' in original_filename else ''

    if ext not in allowed_extensions:
        return jsonify({'success': False, 'error': f'File type .{ext} not allowed'}), 400

    # Generate a unique filename to avoid collisions on disk
    stored_filename = f"{uuid.uuid4().hex}.{ext}"
    save_path = os.path.join(current_app.config['UPLOAD_FOLDER'], stored_filename)
    file.save(save_path)

    # Save the record to the database
    project_file = ProjectFile(
        project_id=project_id,
        filename=stored_filename,
        original_filename=original_filename,
        file_type=ext,
        uploaded_by_id=current_user.id
    )
    db.session.add(project_file)
    db.session.commit()

    log_activity('file_uploaded', f'Reference file "{original_filename}" uploaded to "{project.name}"',
                 user=current_user, entity_type='project', entity_name=project.name, entity_id=project.id)

    return jsonify({
        'success': True,
        'file': {
            'id': project_file.id,
            'original_filename': original_filename,
            'file_type': ext,
            'uploaded_by': current_user.name
        }
    })


@projects.route('/projects/files/<int:file_id>/download')
@login_required
def download_project_file(file_id):
    """Serve a reference file for download. All authenticated users can download."""
    from app.models import ProjectFile
    import os

    project_file = ProjectFile.query.get_or_404(file_id)
    file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], project_file.filename)

    if not os.path.exists(file_path):
        abort(404)

    # send_file serves the file to the browser with the original filename
    from flask import send_file
    return send_file(file_path, as_attachment=True, download_name=project_file.original_filename)


@projects.route('/projects/files/<int:file_id>/delete', methods=['POST'])
@login_required
@role_required('admin', 'cs')
def delete_project_file(file_id):
    """Delete a reference file. CS and admin only."""
    from app.models import ProjectFile
    import os

    project_file = ProjectFile.query.get_or_404(file_id)
    project = Project.query.get(project_file.project_id)

    # Remove the file from disk
    file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], project_file.filename)
    if os.path.exists(file_path):
        os.remove(file_path)

    log_activity('file_deleted', f'Reference file "{project_file.original_filename}" deleted from "{project.name}"',
                 user=current_user, entity_type='project', entity_name=project.name, entity_id=project.id)

    db.session.delete(project_file)
    db.session.commit()

    return jsonify({'success': True})

# ── Project Submission Routes ─────────────────────────────────────────────────
# Flow:
#   1. Designer uploads deck → upload_submission (returns submission.id + previous deliverable IDs)
#   2. Designer picks deliverables → submit_for_internal_review (project + deliverables → internal_review)
#   3. CS reviews:
#      a. Flags it  → flag_submission (project + deliverables → internal_revision, notify designer)
#         Designer reuploads (repeat from step 1), new submission inherits previous picker selection
#      b. Approves  → submit_to_client (project + ALL deliverables → submitted_to_client,
#                                        revision_count +1, open mailto in browser)
#   Deck files that reached "submitted_to_client" are kept permanently for audit history.
#   Draft/flagged decks that are replaced on reupload are deleted from disk.

@projects.route('/projects/<int:project_id>/submission/upload', methods=['POST'])
@login_required
@role_required('admin', 'cs', 'designer', 'team_lead')
def upload_submission(project_id):
    """Designer uploads a new client deck (PDF or PPTX).
    - Deactivates any previous active submission.
    - If the previous deck was never submitted to the client, its physical file is deleted (draft only).
    - If it was submitted to the client, the file is kept for audit history.
    - Returns the new submission ID and the deliverable IDs from the previous submission
      so the frontend can pre-check the deliverable picker."""
    from app.models import ProjectSubmission
    import os

    project = Project.query.get_or_404(project_id)

    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'No file provided'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'error': 'No file selected'}), 400

    # Only PDF and PPTX are valid client decks
    allowed = {'pdf', 'pptx'}
    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    if ext not in allowed:
        return jsonify({'success': False, 'error': 'Only PDF and PPTX files are accepted'}), 400

    upload_folder = current_app.config['UPLOAD_FOLDER']

    # Find the current active submission (if any)
    previous = ProjectSubmission.query.filter_by(
        project_id=project_id, is_active=True
    ).first()

    # Collect the deliverable IDs that were included in the previous submission
    # so the picker can pre-populate the checkboxes for the designer
    previous_deliverable_ids = []
    if previous:
        previous_deliverable_ids = [
            link.deliverable_id for link in previous.included_deliverables
        ]
        # Only delete the physical file if this deck was never approved and sent to the client.
        # Approved decks are kept permanently for invoice / audit history.
        if not previous.submitted_to_client_at:
            old_path = os.path.join(upload_folder, previous.filename)
            if os.path.exists(old_path):
                os.remove(old_path)
        previous.is_active = False

    # Save the new file with a UUID-based name to prevent filename collisions
    stored_filename = f"submission_{uuid.uuid4().hex}.{ext}"
    file.save(os.path.join(upload_folder, stored_filename))

    submission = ProjectSubmission(
        project_id=project_id,
        filename=stored_filename,
        original_filename=file.filename,
        file_type=ext,
        uploaded_by_id=current_user.id,
        is_active=True,
        is_flagged=False
    )
    db.session.add(submission)
    db.session.commit()

    log_activity('submission_uploaded',
                 f'Client deck "{file.filename}" uploaded for "{project.name}" by {current_user.name}',
                 user=current_user, entity_type='project',
                 entity_name=project.name, entity_id=project.id)

    return jsonify({
        'success': True,
        'submission': {
            'id': submission.id,
            'original_filename': submission.original_filename,
            'file_type': submission.file_type,
            'uploaded_by': current_user.name
        },
        # Pre-populate the deliverable picker with whatever was selected last time
        'previous_deliverable_ids': previous_deliverable_ids
    })


@projects.route('/projects/<int:project_id>/submission/submit-for-review', methods=['POST'])
@login_required
@role_required('admin', 'cs', 'designer', 'team_lead')
def submit_for_internal_review(project_id):
    """Designer locks in which deliverables are included and sends the deck to CS for review.
    - Creates ProjectSubmissionDeliverable rows linking this submission to its deliverables.
    - Sets project status → internal_review.
    - Sets each included deliverable status → internal_review.
    - Notifies all CS / admin users."""
    from app.models import ProjectSubmission, ProjectSubmissionDeliverable

    project = Project.query.get_or_404(project_id)

    data = request.get_json() or {}
    submission_id = data.get('submission_id')
    deliverable_ids = data.get('deliverable_ids', [])

    if not submission_id:
        return jsonify({'success': False, 'error': 'No submission ID provided'}), 400
    if not deliverable_ids:
        return jsonify({'success': False, 'error': 'Select at least one deliverable'}), 400

    # Make sure the submission belongs to this project and is active
    submission = ProjectSubmission.query.filter_by(
        id=submission_id, project_id=project_id, is_active=True
    ).first()
    if not submission:
        return jsonify({'success': False, 'error': 'Submission not found or no longer active'}), 400

    # Clear any previous deliverable links on this submission (safe to replace
    # if designer submits for review more than once without CS touching it)
    ProjectSubmissionDeliverable.query.filter_by(submission_id=submission.id).delete()

    # Create a link row for each selected deliverable
    for d_id in deliverable_ids:
        deliverable = Deliverable.query.filter_by(id=d_id, project_id=project_id).first()
        if deliverable:
            link = ProjectSubmissionDeliverable(
                submission_id=submission.id,
                deliverable_id=d_id
            )
            db.session.add(link)
            # Move the deliverable into internal review
            deliverable.status = 'internal_review'

    # Move the project into internal review
    project.project_status = 'internal_review'

    db.session.commit()

    # Notify every CS and admin user so they know a deck needs reviewing
    cs_users = User.query.filter(User.role.in_(['cs', 'admin'])).all()
    for cs_user in cs_users:
        if cs_user.id != current_user.id:  # Don't notify yourself
            create_notification(
                recipient_id=cs_user.id,
                message=f'"{project.name}" has been submitted for internal review by {current_user.name}',
                notification_type='internal_review_submitted',
                project_id=project_id,
                triggered_by_id=current_user.id
            )

    log_activity('internal_review_submitted',
                 f'"{project.name}" submitted for internal review by {current_user.name} '
                 f'({len(deliverable_ids)} deliverable(s) included)',
                 user=current_user, entity_type='project',
                 entity_name=project.name, entity_id=project.id)

    return jsonify({'success': True})


@projects.route('/projects/<int:project_id>/submission/flag', methods=['POST'])
@login_required
@role_required('admin', 'cs')
def flag_submission(project_id):
    """CS flags the active deck with a revision note.
    - Sets project status → internal_revision.
    - Sets every deliverable that was included in this submission → internal_revision.
    - Notifies the designer who uploaded the deck."""
    from app.models import ProjectSubmission
    from datetime import datetime as dt

    project = Project.query.get_or_404(project_id)

    data = request.get_json() or {}
    message = (data.get('message') or '').strip()
    if not message:
        return jsonify({'success': False, 'error': 'Please provide a reason for flagging'}), 400

    submission = ProjectSubmission.query.filter_by(
        project_id=project_id, is_active=True
    ).first()
    if not submission:
        return jsonify({'success': False, 'error': 'No active submission to flag'}), 400

    # Mark the submission as flagged
    submission.is_flagged = True
    submission.flag_message = message
    submission.flagged_by_id = current_user.id
    submission.flagged_at = dt.utcnow()

    # Push project into internal_revision state
    project.project_status = 'internal_revision'

    # Push every included deliverable into internal_revision
    for link in submission.included_deliverables:
        if link.deliverable:
            link.deliverable.status = 'internal_revision'

    db.session.commit()

    # Notify the designer who uploaded the deck
    create_notification(
        recipient_id=submission.uploaded_by_id,
        message=f'Your client deck for "{project.name}" was flagged by CS: {message}',
        notification_type='submission_flagged',
        project_id=project_id,
        triggered_by_id=current_user.id
    )

    log_activity('submission_flagged',
                 f'Client deck for "{project.name}" flagged by {current_user.name}: {message}',
                 user=current_user, entity_type='project',
                 entity_name=project.name, entity_id=project.id)

    return jsonify({'success': True})


@projects.route('/projects/<int:project_id>/submission/submit-to-client', methods=['POST'])
@login_required
@role_required('admin', 'cs')
def submit_to_client(project_id):
    """CS approves the deck and marks it as submitted to the client.
    - Guards: must have an active, unflagged submission in internal_review state.
    - Stamps submitted_to_client_at on the submission (file is now kept permanently).
    - Increments project.revision_count.
    - Sets project status → submitted_to_client.
    - Sets ALL project deliverables → submitted_to_client.
    - Returns client email (if stored) and project name so the frontend can open a mailto prompt."""
    from app.models import ProjectSubmission
    from datetime import datetime as dt

    project = Project.query.get_or_404(project_id)

    # Guard: must have an active, unflagged deck
    submission = ProjectSubmission.query.filter_by(
        project_id=project_id, is_active=True
    ).first()
    if not submission:
        return jsonify({'success': False, 'error': 'Upload a client deck before submitting'}), 400
    if submission.is_flagged:
        return jsonify({'success': False, 'error': 'The current deck is flagged — wait for the designer to reupload'}), 400
    if project.project_status != 'internal_review':
        return jsonify({'success': False, 'error': 'Deck must be in Internal Review before submitting to client'}), 400

    # Stamp the submission as officially submitted — this file is now permanent
    submission.submitted_to_client_at = dt.utcnow()
    submission.submitted_by_id = current_user.id

    # Increment the project revision counter (counts how many times we've sent to the client)
    project.revision_count = (project.revision_count or 0) + 1
    project.project_status = 'submitted_to_client'

    # Mark ALL deliverables on this project as submitted to client
    for deliverable in project.deliverables:
        deliverable.status = 'submitted_to_client'

    db.session.commit()

    log_activity('submitted_to_client',
                 f'"{project.name}" submitted to client by {current_user.name} '
                 f'(revision #{project.revision_count})',
                 user=current_user, entity_type='project',
                 entity_name=project.name, entity_id=project.id)

    # Return the client's email (dormant — will be populated once v1.1 adds client email UI)
    client_email = project.client_brand.contact_email if project.client_brand else None

    return jsonify({
        'success': True,
        'client_email': client_email or '',
        'project_name': project.name
    })


@projects.route('/projects/submission/<int:submission_id>/download')
@login_required
def download_submission(submission_id):
    """Serve a submission deck for download. Available to all authenticated users."""
    from app.models import ProjectSubmission
    import os
    submission = ProjectSubmission.query.get_or_404(submission_id)
    file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], submission.filename)
    if not os.path.exists(file_path):
        abort(404)
    from flask import send_file
    return send_file(file_path, as_attachment=True, download_name=submission.original_filename)