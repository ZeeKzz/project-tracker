from flask import Blueprint, render_template, redirect, url_for
from flask_login import login_required, current_user
from datetime import date, timedelta
from app import db
from app.models import Project, ProjectDesigner, User

main = Blueprint('main', __name__)


@main.route('/')
@login_required
def index():
    """
    Role-aware dashboard router.
    Looks at the current user's role and renders the appropriate dashboard.
    """
    if current_user.role in ['cs', 'admin']:
        return cs_dashboard()
    elif current_user.role == 'designer':
        return designer_dashboard()
    elif current_user.role == 'team_lead':
        return team_lead_dashboard()
    else:
        return redirect(url_for('projects.index'))


def cs_dashboard():
    """Render the CS dashboard - own projects default, all projects toggle."""
    today = date.today()

    if current_user.role == 'admin':
        my_projects = Project.query.order_by(
            Project.design_needed_by.asc()
        ).all()
    else:
        my_projects = Project.query.filter_by(
            cs_lead_id=current_user.id
        ).order_by(Project.design_needed_by.asc()).all()

    all_projects = Project.query.order_by(
        Project.cs_lead_id.asc(),
        Project.design_needed_by.asc()
    ).all()

    cs_users = User.query.filter(
        User.role.in_(['cs', 'admin'])
    ).order_by(User.name).all()

    return render_template(
        'dashboards/cs.html',
        projects=my_projects,
        all_projects=all_projects,
        cs_users=cs_users,
        today=today
    )


def designer_dashboard():
    """Render the designer dashboard - projects this designer is assigned to."""
    # Get all project IDs this user is assigned to as a designer
    assigned_project_ids = [
        pd.project_id for pd in
        ProjectDesigner.query.filter_by(user_id=current_user.id).all()
    ]

    if assigned_project_ids:
        my_projects = Project.query.filter(
            Project.id.in_(assigned_project_ids)
        ).order_by(Project.design_needed_by.asc()).all()
    else:
        my_projects = []

    today = date.today()
    tomorrow = today + timedelta(days=1)

    active_count = len(my_projects)
    due_today = sum(1 for p in my_projects if p.design_needed_by == today)
    due_tomorrow = sum(1 for p in my_projects if p.design_needed_by == tomorrow)

    return render_template(
        'dashboards/designer.html',
        projects=my_projects,
        active_count=active_count,
        due_today=due_today,
        due_tomorrow=due_tomorrow,
        today=today
    )


def team_lead_dashboard():
    """Render the team lead dashboard - both team-wide and personal views."""
    team = current_user.team
    today = date.today()
    tomorrow = today + timedelta(days=1)

    # Team data: all projects requesting this team
    team_projects = Project.query.filter(
        Project.design_teams_requested.contains(team)
    ).order_by(Project.design_needed_by.asc()).all()

    team_active = len(team_projects)
    team_due_today = sum(1 for p in team_projects if p.design_needed_by == today)
    team_due_tomorrow = sum(1 for p in team_projects if p.design_needed_by == tomorrow)

    # Workload per designer in this team
    designers_in_team = User.query.filter(
        User.team == team,
        User.role.in_(['designer', 'team_lead'])
    ).order_by(User.name).all()

    team_workload = []
    for designer in designers_in_team:
        count = ProjectDesigner.query.filter_by(user_id=designer.id).count()
        team_workload.append({'name': designer.name, 'count': count})

    # Personal data: projects this team lead is assigned to as a designer
    personal_project_ids = [
        pd.project_id for pd in
        ProjectDesigner.query.filter_by(user_id=current_user.id).all()
    ]

    if personal_project_ids:
        personal_projects = Project.query.filter(
            Project.id.in_(personal_project_ids)
        ).order_by(Project.design_needed_by.asc()).all()
    else:
        personal_projects = []

    personal_active = len(personal_projects)
    personal_due_today = sum(1 for p in personal_projects if p.design_needed_by == today)
    personal_due_tomorrow = sum(1 for p in personal_projects if p.design_needed_by == tomorrow)

    return render_template(
        'dashboards/team_lead.html',
        team_projects=team_projects,
        team_active=team_active,
        team_due_today=team_due_today,
        team_due_tomorrow=team_due_tomorrow,
        team_workload=team_workload,
        personal_projects=personal_projects,
        personal_active=personal_active,
        personal_due_today=personal_due_today,
        personal_due_tomorrow=personal_due_tomorrow,
        today=today
    )