from app import db
from app.models import Notification, User, ProjectSecondaryCS, ProjectSecondaryCsRegion


def _get_secondary_cs(project):
    """Return all secondary CS User objects for a project."""
    return [a.user for a in ProjectSecondaryCS.query.filter_by(project_id=project.id).all()]


def _secondary_cs_subscribed_to_region(project, user, region):
    """
    Return True if this secondary CS should receive notifications for the given region.
    Logic: if they have NO region preferences set → receive all regions.
            if they have preferences set → only receive for subscribed regions.
    """
    subs = ProjectSecondaryCsRegion.query.filter_by(project_id=project.id, user_id=user.id).all()
    if not subs:
        return True  # No filter set — receive everything
    return any(s.region == region for s in subs)


def _deliverable_region(deliverable):
    """Get the region of a C&CM deliverable via its project_customer → customer chain."""
    if deliverable and deliverable.project_customer and deliverable.project_customer.customer:
        return deliverable.project_customer.customer.region
    return None

def _send_notification_email(recipient, message, project=None):
    """
    Send an HTML email alongside an in-app notification.
    Silently does nothing if email is disabled or misconfigured.
    """
    from flask import current_app
    # If email is turned off in .env, skip silently
    if str(current_app.config.get('MAIL_ENABLED', 'false')).lower() != 'true':
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
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="background-color:#f5f5f5;">
            <tr>
                <td align="center" style="padding:40px 20px;">

                    <table width="480" cellpadding="0" cellspacing="0" border="0"
                           style="max-width:480px;width:100%;">

                        <!-- Header -->
                        <tr>
                            <td bgcolor="#F27F55" align="center"
                                style="background-color:#F27F55;padding:28px 32px;">
                                <h1 style="margin:0;color:#ffffff;font-size:24px;
                                           font-weight:bold;letter-spacing:2px;
                                           font-family:Arial,sans-serif;">Vitamin-E</h1>
                            </td>
                        </tr>

                        <!-- Body -->
                        <tr>
                            <td bgcolor="#E5D259" align="center"
                                style="background-color:#E5D259;padding:36px 32px;">
                                <p style="margin:0 0 20px 0;color:#1A1A1A;font-size:16px;
                                          font-family:Arial,sans-serif;">Hi {recipient.name},</p>
                                <p style="margin:0;color:#1A1A1A;font-size:15px;
                                          line-height:1.6;font-family:Arial,sans-serif;">{message}</p>
                                {project_line}
                            </td>
                        </tr>

                        <!-- Button -->
                        <tr>
                            <td bgcolor="#F27F55" align="center"
                                style="background-color:#F27F55;padding:28px 32px;">
                                <a href="{button_url}"
                                   style="color:#ffffff;text-decoration:none;font-size:16px;
                                          font-weight:bold;font-family:Arial,sans-serif;">
                                    Go to Vitamin-E &#8594;
                                </a>
                            </td>
                        </tr>

                    </table>
                </td>
            </tr>
        </table>
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
    """Notify the CS lead and secondary CS that a designer has raised a brief flag."""
    type_label = {'project': 'the project', 'concept': 'the concept', 'kv': 'the KV'}.get(
        flag.flag_type,
        f'a deliverable' if not flag.deliverable else f'"{flag.deliverable.name}"'
    )
    message = f'{triggered_by.name} flagged an issue on {type_label} in "{project.name}".'

    cs_lead = User.query.get(project.cs_lead_id)
    if cs_lead:
        create_notification(recipient=cs_lead, message=message, notification_type='brief_flag',
                            project=project, triggered_by=triggered_by)

    # Notify secondary CS, with region filtering for C&CM deliverable-level flags
    region = _deliverable_region(flag.deliverable) if flag.flag_type == 'deliverable' else None
    for secondary in _get_secondary_cs(project):
        if region and project.brief_type == 'ccm':
            if not _secondary_cs_subscribed_to_region(project, secondary, region):
                continue
        create_notification(recipient=secondary, message=message, notification_type='brief_flag',
                            project=project, triggered_by=triggered_by)


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
    """Notify the CS lead and secondary CS that all flagged revisions have been submitted."""
    message = f'All flagged revisions on "{project.name}" have been submitted. (Revision #{project.revision_count})'
    cs_lead = User.query.get(project.cs_lead_id)
    if cs_lead:
        create_notification(recipient=cs_lead, message=message, notification_type='revision_submitted',
                            project=project, triggered_by=triggered_by)
    for secondary in _get_secondary_cs(project):
        create_notification(recipient=secondary, message=message, notification_type='revision_submitted',
                            project=project, triggered_by=triggered_by)


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
    """Notify the CS lead and secondary CS when the designer marks a brief flag as resolved."""
    type_label = {'project': 'the project', 'concept': 'the concept', 'kv': 'the KV'}.get(
        flag.flag_type,
        f'"{flag.deliverable.name}"' if flag.deliverable else 'a deliverable'
    )
    message = f'{triggered_by.name} marked their flag on {type_label} in "{project.name}" as resolved.'
    cs_lead = User.query.get(project.cs_lead_id)
    if cs_lead:
        create_notification(recipient=cs_lead, message=message, notification_type='brief_flag_resolved',
                            project=project, triggered_by=triggered_by)

    region = _deliverable_region(flag.deliverable) if flag.flag_type == 'deliverable' else None
    for secondary in _get_secondary_cs(project):
        if region and project.brief_type == 'ccm':
            if not _secondary_cs_subscribed_to_region(project, secondary, region):
                continue
        create_notification(recipient=secondary, message=message, notification_type='brief_flag_resolved',
                            project=project, triggered_by=triggered_by)


def notify_cs_of_lead_change(project, new_designer, team_name, triggered_by, previous_designer=None):
    """
    Notify CS lead + secondary CS when a designer self-assigns or takes over as team lead.
    If previous_designer is provided, also notify them that they've been replaced.
    """
    if previous_designer:
        cs_message = (f'{new_designer.name} has taken over as {team_name} lead on '
                      f'"{project.name}" (previously {previous_designer.name}).')
        prev_message = (f'{new_designer.name} has taken over from you as {team_name} lead '
                        f'on "{project.name}".')
    else:
        cs_message = (f'{new_designer.name} has self-assigned as {team_name} lead '
                      f'on "{project.name}".')

    cs_lead = User.query.get(project.cs_lead_id)
    if cs_lead:
        create_notification(recipient=cs_lead, message=cs_message,
                            notification_type='lead_assigned',
                            project=project, triggered_by=triggered_by)
    for secondary in _get_secondary_cs(project):
        create_notification(recipient=secondary, message=cs_message,
                            notification_type='lead_assigned',
                            project=project, triggered_by=triggered_by)

    if previous_designer and previous_designer.id != triggered_by.id:
        create_notification(recipient=previous_designer, message=prev_message,
                            notification_type='lead_assigned',
                            project=project, triggered_by=triggered_by)


def notify_secondary_cs_of_deliverable_status(deliverable, project, new_status, triggered_by):
    """
    Notify secondary CS of a C&CM deliverable status change, filtered by their region subscriptions.
    Called from set_deliverable_status. Does nothing for standard briefs.
    """
    if project.brief_type != 'ccm':
        return

    secondary_cs = _get_secondary_cs(project)
    if not secondary_cs:
        return

    region = _deliverable_region(deliverable)
    status_label = new_status.replace('_', ' ').title()
    message = f'"{deliverable.name}" in "{project.name}" is now {status_label}.'

    for secondary in secondary_cs:
        if region and not _secondary_cs_subscribed_to_region(project, secondary, region):
            continue
        create_notification(recipient=secondary, message=message, notification_type='status_change',
                            project=project, triggered_by=triggered_by)

def notify_cs_of_project_started(project, triggered_by):
    """Notify CS lead and secondary CS when a designer starts the project."""
    message = f'{triggered_by.name} has started work on "{project.name}".'
    cs_lead = User.query.get(project.cs_lead_id)
    if cs_lead:
        create_notification(recipient=cs_lead, message=message, notification_type='project_started', project=project, triggered_by=triggered_by)
    for secondary in _get_secondary_cs(project):
        create_notification(recipient=secondary, message=message, notification_type='project_started', project=project, triggered_by=triggered_by)