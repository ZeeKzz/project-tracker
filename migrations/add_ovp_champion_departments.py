"""
Migration: one OVP champion per department per week, instead of one per week.
Adds ovp_champions.department, drops the week_start-only unique, and adds a
unique on (week_start, department).
Run via: python migrate.py (NOT directly - see migrate.py at project root)

Safe to re-run: every statement is guarded or drop-then-add. Rows created
before departments existed are placed in Client Servicing.
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import create_app, db

app = create_app()
with app.app_context():
    conn = db.engine.raw_connection()
    cur = conn.cursor()

    cur.execute("ALTER TABLE ovp_champions ADD COLUMN IF NOT EXISTS department VARCHAR(50);")
    cur.execute("UPDATE ovp_champions SET department = 'client_servicing' WHERE department IS NULL;")
    cur.execute("ALTER TABLE ovp_champions ALTER COLUMN department SET NOT NULL;")

    # The old one-per-week rule. Postgres named it automatically when the column
    # was declared UNIQUE; the second name covers a constraint added by name.
    cur.execute("ALTER TABLE ovp_champions DROP CONSTRAINT IF EXISTS ovp_champions_week_start_key;")
    cur.execute("ALTER TABLE ovp_champions DROP CONSTRAINT IF EXISTS uq_ovp_champions_week_start;")

    cur.execute("ALTER TABLE ovp_champions DROP CONSTRAINT IF EXISTS uq_ovp_champions_week_department;")
    cur.execute("""
        ALTER TABLE ovp_champions
            ADD CONSTRAINT uq_ovp_champions_week_department UNIQUE (week_start, department);
    """)

    conn.commit()
    cur.close()
    conn.close()
    print("Done - ovp_champions now holds one champion per department per week.")
