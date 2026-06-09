from app import db
from app.models import Notification, User


def create_notification(recipient, message, notification_type, project=None, triggered_by=None):
    """
    Create a single notification for a user.
    """
    notification = Notification(
        recipient_id=recipient.id,
        message=message,
        notification_type=notification_type,
        project_id=project.id if project else None,
        triggered_by_id=triggered_by.id if triggered_by else None
    )
    db.session.add(notification)
    db.session.commit()
    return notification


def notify_team_leads_of_new_project(project, teams_requested, triggered_by):
    """
    Notify the team leads of every team requested on a new project.
    teams_requested is a list like ['3D', '2D'].
    """
    for team_name in teams_requested:
        team_leads = User.query.filter_by(role='team_lead', team=team_name).all()

        for team_lead in team_leads:
            message = f"New project requires the {team_name} team: {project.name}"
            create_notification(
                recipient=team_lead,
                message=message,
                notification_type='project_created',
                project=project,
                triggered_by=triggered_by
            )


def notify_cs_lead_of_assignment(project, designer, team_name, triggered_by):
    """
    Notify the CS lead of a project when a designer has been assigned to a team.
    """
    cs_lead = User.query.get(project.cs_lead_id)
    if cs_lead:
        message = f"{designer.name} has been assigned to the {team_name} team on project: {project.name}"
        create_notification(
            recipient=cs_lead,
            message=message,
            notification_type='designer_assigned',
            project=project,
            triggered_by=triggered_by
        )