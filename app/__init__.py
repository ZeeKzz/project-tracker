from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from config import Config
import os

db = SQLAlchemy()
login_manager = LoginManager()

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)
    login_manager.init_app(app)

    login_manager.login_view = 'auth.login'
    login_manager.login_message_category = 'info'

    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    from app.models import (User, Project, ProjectDesigner, Scope, Client, Customer, DeliverableType, DeliverableTypeDiscipline, ProjectRegion, ProjectCustomer, Deliverable, DeliverableAssignment)
    from app.routes import main
    from app.routes.auth import auth
    from app.routes.projects import projects
    from app.routes.notifications import notifications_bp
    from app.models import Notification
    from flask_login import current_user
    
    app.register_blueprint(notifications_bp)

    app.register_blueprint(main)
    app.register_blueprint(auth)
    app.register_blueprint(projects)

    from app.utils import calculate_project_hours
    
    @app.context_processor
    def utility_processor():
        return dict(calculate_hours=calculate_project_hours)
    
    @app.context_processor
    def inject_notifications():
      from flask_login import current_user
      from app.models import Notification

      if current_user.is_authenticated:
        active_notifications = Notification.query.filter_by(
            recipient_id=current_user.id,
            is_archived=False
        ).order_by(Notification.created_at.desc()).all()

        archived_notifications = Notification.query.filter_by(
            recipient_id=current_user.id,
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

    return app