"""
Migration: bug_reports.severity (the Signal tray's bug board shows it) and
users.signal_seen_at (the per-user watermark behind the Signal unread bubble).
Run via: python migrate.py (NOT directly - see migrate.py at project root)

Safe to re-run: both use ADD COLUMN IF NOT EXISTS. Existing bugs keep a NULL
severity, which the board renders as unset rather than guessing.
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import create_app, db

app = create_app()
with app.app_context():
    conn = db.engine.raw_connection()
    cur = conn.cursor()

    cur.execute("ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS severity VARCHAR(10);")
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS signal_seen_at TIMESTAMP;")

    conn.commit()
    cur.close()
    conn.close()
    print("Done - bug_reports.severity and users.signal_seen_at added.")
