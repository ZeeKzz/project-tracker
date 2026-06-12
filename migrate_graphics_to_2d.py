from app import create_app, db
from app.models import Project

app = create_app()

with app.app_context():
    projects = Project.query.all()
    count = 0

    for project in projects:
        if 'Graphics' in project.design_teams_requested:
            project.design_teams_requested = project.design_teams_requested.replace('Graphics', '2D')
            count += 1

    db.session.commit()
    print(f'Updated {count} projects from Graphics to 2D.')