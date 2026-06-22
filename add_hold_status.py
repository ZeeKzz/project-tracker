"""
Migration: add held_from_status column to projects table
Run once from the project root:  python add_hold_status.py
"""
from app import create_app, db
from sqlalchemy import text

app = create_app()

with app.app_context():
    with db.engine.connect() as conn:
        conn.execute(text("""
            ALTER TABLE projects
            ADD COLUMN IF NOT EXISTS held_from_status VARCHAR(50);
        """))
        conn.commit()

    print("Migration complete: held_from_status column added to projects.")
