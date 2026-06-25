from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_mail import Mail
from config import Config
import os

db = SQLAlchemy()
login_manager = LoginManager()
mail = Mail()

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)
    login_manager.init_app(app)
    mail.init_app(app)

    login_manager.login_view = 'auth.login'
    login_manager.login_message_category = 'info'

    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    from app.models import (User, Project, ProjectDesigner, Scope, Client, Customer, DeliverableType, DeliverableTypeDiscipline, ProjectRegion, ProjectCustomer, Deliverable, DeliverableAssignment, ActivityLog, DesignType, DesignDirection, ProjectFile, ProjectSubmission, ProjectSubmissionDeliverable, ProjectRevision, ProjectRevisionDeliverable)
    from app.routes import main
    from app.routes.auth import auth
    from app.routes.projects import projects
    from app.routes.notifications import notifications_bp
    from app.models import Notification
    from flask_login import current_user
    from app.routes.admin import admin_bp
    
    app.register_blueprint(notifications_bp)

    app.register_blueprint(main)
    app.register_blueprint(auth)
    app.register_blueprint(projects)
    app.register_blueprint(admin_bp)

    from app.utils import calculate_project_hours
    
    @app.context_processor
    def utility_processor():
        return dict(calculate_hours=calculate_project_hours)
    
    @app.context_processor
    def inject_notifications():
        from flask import session
        from flask_login import current_user
        from app.models import Notification

        if current_user.is_authenticated:
            # Use the emulated user's ID when in emulation mode
            emulating_id = session.get('emulating_user_id')
            notif_user_id = emulating_id if (emulating_id and current_user.role == 'admin') else current_user.id

            active_notifications = Notification.query.filter_by(
                recipient_id=notif_user_id,
                is_archived=False
            ).order_by(Notification.created_at.desc()).all()

            archived_notifications = Notification.query.filter_by(
                recipient_id=notif_user_id,
                is_archived=True
            ).order_by(Notification.created_at.desc()).limit(50).all()

            unread_count = sum(1 for n in active_notifications if not n.is_read)

            return {
                'user_notifications': active_notifications,
                'archived_notifications': archived_notifications,
                'unread_count': unread_count
            }
        return {
            'user_notifications': [],
            'archived_notifications': [],
            'unread_count': 0
        }

    @app.context_processor
    def inject_effective_user():
       from flask import session
       if current_user.is_authenticated:
             emulating_id = session.get('emulating_user_id')
             if emulating_id and current_user.role == 'admin':
                 effective_user = User.query.get(emulating_id)
                 is_emulating = True
             else:
                effective_user = current_user
                is_emulating = False
             return {
                 'effective_user': effective_user,
                 'is_emulating': is_emulating
             }
       return {
           'effective_user': current_user,
           'is_emulating': False
       }
    
    from datetime import timezone, timedelta

    def dubai_time(dt):
        if dt is None:
            return '_'
        dubai_tz = timezone(timedelta(hours=4))
        return dt.replace(tzinfo=timezone.utc).astimezone(dubai_tz).strftime('%d %b %Y, %H:%M')
    
    app.jinja_env_filters['dubai_time'] = dubai_time
        

    return app