from app import create_app, db
from sqlalchemy import text

app = create_app()

with app.app_context():
    db.session.execute(text('''
        ALTER TABLE projects
            ALTER COLUMN job_number DROP NOT NULL,
            ALTER COLUMN design_teams_requested DROP NOT NULL,
            ALTER COLUMN design_needed_by DROP NOT NULL,
            ALTER COLUMN execution_date DROP NOT NULL,
            ALTER COLUMN importance DROP NOT NULL,
            ALTER COLUMN value DROP NOT NULL'''))
    db.session.commit()
    print("Project fields made nullable - autosave ready")