from flask import Blueprint, render_template
from flask_login import login_required
from app.models import Project

main = Blueprint('main', __name__)

@main.route('/')
@login_required
def index():
    projects = Project.query.all()
    return render_template('index.html', projects=projects)

