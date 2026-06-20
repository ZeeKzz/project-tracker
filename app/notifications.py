from app import db
from app.models import Notification, User

def _send_notification_email(recipient, message, project=None):
    """
    Send an HTML email alongside an in-app notification.
    Silently does nothing if email is disabled or misconfigured.
    """
    from flask import current_app
    # If email is turned off in .env, skip silently
    if not current_app.config.get('MAIL_ENABLED'):
        return
    # If the user has no email address, skip
    if not recipient.email:
        return
    try:
        from flask_mail import Message as MailMessage
        from app import mail

        # Build the URL — link directly to the project if one is attached
        app_url = 'https://app.vitamin-e.work'
        if project:
            button_url = f'{app_url}/projects/{project.id}'
        else:
            button_url = app_url

        project_line = f'<p style="margin:0 0 12px;color:#555555;font-size:14px;"><strong>Project:</strong> {project.name}</p>' if project else ''

        # HTML email body using inline styles (required for email client compatibility)
        html_body = f"""
        <div style="background-color:#f5f5f5;padding:40px 20px;">
            <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

                <!-- Header -->
                <div style="background-color:#F27F55;padding:28px 32px;text-align:center;">
                    <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:bold;letter-spacing:2px;">Vitamin-E</h1>
                </div>

                <!-- Body -->
                <div style="background-color:#E5D259;padding:36px 32px;text-align:center;">
                    <p style="margin:0 0 20px;color:#1A1A1A;font-size:16px;">Hi {recipient.name},</p>
                    <p style="margin:0;color:#1A1A1A;font-size:15px;line-height:1.6;">{message}</p>
                    {project_line}
                </div>

                <!-- Button -->
                <div style="background-color:#F27F55;padding:28px 32px;text-align:center;">
                    <a href="{button_url}"
                       style="color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold;">
                        Go to Vitamin-E →
                    </a>
                </div>

            </div>
        </div>
        """

        # Plain text fallback for email clients that don't render HTML
        text_body = f"Hi {recipient.name},\n\n{message}"
        if project:
            text_body += f"\nProject: {project.name}"
        text_body += f"\n\nOpen Vitamin-E: {button_url}\n\n— Vitamin-E"

        msg = MailMessage(
            subject=f'[Vitamin-E] {message[:60]}{"..." if len(message) > 60 else ""}',
            recipients=[recipient.email],
            body=text_body,
            html=html_body
        )
        mail.send(msg)

    except Exception as e:
        current_app.logger.warning(f'Helix email notification failed for {recipient.email}: {e}')


def create_notification(recipient, message, notification_type, project=None, triggered_by=None):
    """
    Create a single in-app notification and send an email if mail is enabled.
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
    _send_notification_email(recipient, message, project)
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


def notify_cs_of_brief_flag(flag, project, triggered_by):
    """Notify the CS lead that a designer has raised a brief flag."""
    cs_lead = User.query.get(project.cs_lead_id)
    if cs_lead:
        type_label = {'project': 'the project', 'concept': 'the concept', 'kv': 'the KV'}.get(
            flag.flag_type,
            f'a deliverable' if not flag.deliverable else f'"{flag.deliverable.name}"'
        )
        create_notification(
            recipient=cs_lead,
            message=f'{triggered_by.name} flagged an issue on {type_label} in "{project.name}".',
            notification_type='brief_flag',
            project=project,
            triggered_by=triggered_by
        )


def notify_flag_reply(flag, project, triggered_by):
    """
    Notify the relevant party that a reply has been added to a flag.
    If CS replied → notify the original flagging designer.
    If designer replied → notify the CS lead.
    """
    if triggered_by.id == flag.created_by_id:
        # Designer replied — notify CS
        recipient = User.query.get(project.cs_lead_id)
        message = f'{triggered_by.name} replied to their flag on "{project.name}".'
    else:
        # CS/admin replied — notify the original flagging designer
        recipient = flag.created_by
        message = f'{triggered_by.name} responded to your flag on "{project.name}".'

    if recipient:
        create_notification(
            recipient=recipient,
            message=message,
            notification_type='brief_flag_reply',
            project=project,
            triggered_by=triggered_by
        )


def notify_designers_of_revision_flag(deliverable, project, triggered_by):
    """
    Notify all designers assigned to a deliverable that it has been flagged for revision.
    Uses deliverable.disciplines (DeliverableAssignment records) to find who to notify.
    """
    notified_ids = set()
    for assignment in deliverable.disciplines:
        if assignment.designer_id not in notified_ids:
            message = f'"{deliverable.name}" on "{project.name}" has been flagged for revision.'
            create_notification(
                recipient=assignment.designer,
                message=message,
                notification_type='revision_flagged',
                project=project,
                triggered_by=triggered_by
            )
            notified_ids.add(assignment.designer_id)


def notify_cs_of_revision_submitted(project, triggered_by):
    """
    Notify the CS lead of a project that all flagged revisions have been submitted.
    """
    cs_lead = User.query.get(project.cs_lead_id)
    if cs_lead:
        message = f'All flagged revisions on "{project.name}" have been submitted. (Revision #{project.revision_count})'
        create_notification(
            recipient=cs_lead,
            message=message,
            notification_type='revision_submitted',
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


def notify_designer_of_concept_kv_assignment(project, designer, role_label, triggered_by):
    """
    Notify a designer that they have been assigned the Concept or KV role on a project.
    role_label: 'Concept' or 'Key Visual'
    """
    message = f'You have been assigned as the {role_label} designer on "{project.name}".'
    create_notification(
        recipient=designer,
        message=message,
        notification_type='designer_assigned',
        project=project,
        triggered_by=triggered_by
    )


def notify_cs_of_flag_resolved(flag, project, triggered_by):
    """
    Notify the CS lead when the designer marks a brief flag as resolved.
    """
    cs_lead = User.query.get(project.cs_lead_id)
    if cs_lead:
        type_label = {'project': 'the project', 'concept': 'the concept', 'kv': 'the KV'}.get(
            flag.flag_type,
            f'"{flag.deliverable.name}"' if flag.deliverable else 'a deliverable'
        )
        create_notification(
            recipient=cs_lead,
            message=f'{triggered_by.name} marked their flag on {type_label} in "{project.name}" as resolved.',
            notification_type='brief_flag_resolved',
            project=project,
            triggered_by=triggered_by
        )