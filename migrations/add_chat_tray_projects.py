"""
Migration: create chat_tray_projects table (projects a user pinned to their
Chat tray — the ones that would not surface on message activity alone).
Run via: python migrate.py (NOT directly - see migrate.py at project root)

This script is applied, and its filename recorded in the schema_migrations
table, by migrate.py. Running it a second time is harmless because the
statement below uses IF NOT EXISTS.
"""

import sys, os
# Add the project root (one level up from migrations/) to the import path,
# so "from app import ..." below can find the app package.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import create_app, db

app = create_app()
with app.app_context():
    conn = db.engine.raw_connection()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS chat_tray_projects (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),        -- matches ChatTrayProject.user_id
            project_id INTEGER NOT NULL REFERENCES projects(id),  -- matches ChatTrayProject.project_id
            created_at TIMESTAMP,
            -- One pin per (user, project); the add endpoint upserts against this.
            CONSTRAINT uq_chat_tray_projects_user_project UNIQUE (user_id, project_id)
        );
    """)

    conn.commit()
    cur.close()
    conn.close()
    print("Done - chat_tray_projects table created.")
