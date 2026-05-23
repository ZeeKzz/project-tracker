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

    from app.models import User, Project, ProjectDesigner, Scope
    from app.routes import main
    from app.routes.auth import auth
    from app.routes.projects import projects

    app.register_blueprint(main)
    app.register_blueprint(auth)
    app.register_blueprint(projects)

    from app.utils import calculate_project_hours
    
    @app.context_processor
    def utility_processor():
        return dict(calculate_hours=calculate_project_hours)

    return app