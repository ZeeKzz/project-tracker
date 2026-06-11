from app import create_app, db
from sqlalchemy import text

app = create_app()

with app.app_context():
    with db.engine.connect() as conn:
        conn.execute(text("""
            ALTER TABLE projects
            ALTER COLUMN client DROP NOT NULL;
        """))
        conn.commit()
    print("Done — client column is now nullable.")