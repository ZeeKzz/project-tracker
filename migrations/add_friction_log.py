"""
Migration: create friction_log_entries (the Signal tray's weekly Friction Log).
Run via: python migrate.py (NOT directly - see migrate.py at project root)

Safe to re-run: CREATE TABLE / CREATE INDEX both use IF NOT EXISTS.
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import create_app, db

app = create_app()
with app.app_context():
    conn = db.engine.raw_connection()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS friction_log_entries (
            id SERIAL PRIMARY KEY,
            author_id INTEGER NOT NULL REFERENCES users(id),  -- matches FrictionLogEntry.author_id
            body TEXT NOT NULL,
            week_start DATE NOT NULL,                          -- the Monday the thread groups on
            created_at TIMESTAMP
        );
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS ix_friction_log_entries_week_start
            ON friction_log_entries (week_start);
    """)

    conn.commit()
    cur.close()
    conn.close()
    print("Done - friction_log_entries table created.")
