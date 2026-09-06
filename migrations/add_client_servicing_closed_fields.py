"""
Migration: add closed-lifecycle fields to client_servicing.
Run once: python add_client_servicing_closed_fields.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import create_app, db

app = create_app()
with app.app_context():
    conn = db.engine.raw_connection()
    cur  = conn.cursor()
    cur.execute("""
        ALTER TABLE client_servicing
        ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS closed_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS invoice_needed BOOLEAN;
    """)
    conn.commit()
    cur.close()
    conn.close()
    print("Done — closed fields added to client_servicing.")
