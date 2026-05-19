from flask import Blueprint, render_template
from app.models import Project

main = Blueprint('main', __name__)

@main.route('/')
def index():
    projects = Project.query.all()
    return render_template('index.html', projects=projects)

