"""
Migration: add the Chat tray's per-user state columns (added / pinned / hidden)
to chat_tray_projects. Existing rows were all manual adds, so added_at is
backfilled from created_at.
Run via: python migrate.py (NOT directly - see migrate.py at project root)

Safe to re-run: ADD COLUMN IF NOT EXISTS, and the backfill only touches rows
whose added_at is still NULL.
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import create_app, db

app = create_app()
with app.app_context():
    conn = db.engine.raw_connection()
    cur = conn.cursor()

    cur.execute("""
        ALTER TABLE chat_tray_projects
            ADD COLUMN IF NOT EXISTS added_at  TIMESTAMP,
            ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMP;
    """)
    cur.execute("""
        UPDATE chat_tray_projects
           SET added_at = created_at
         WHERE added_at IS NULL;
    """)

    conn.commit()
    cur.close()
    conn.close()
    print("Done - chat_tray_projects state columns added.")
