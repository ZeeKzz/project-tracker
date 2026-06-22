"""
wipe_projects.py
----------------
Clears all project data from the database for a clean production launch.
Preserves: users, clients, customers, design_types, deliverable_types,
           design_directions, scopes — all system/config data stays.
Wipes:     projects and every table that hangs off them, plus
           notifications and activity_logs (fresh slate).

Run ONCE on production before launch. Cannot be undone.
Usage: python wipe_projects.py
"""

import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

conn = psycopg2.connect(os.environ['DATABASE_URL'])
cur = conn.cursor()

print("⚠️  This will permanently delete all project data.")
confirm = input("Type WIPE to confirm: ").strip()
if confirm != "WIPE":
    print("Aborted.")
    cur.close()
    conn.close()
    exit()

print("Wiping project data...")

# Truncate in dependency order (children before parents).
# CASCADE handles any FK chains we might have missed.
tables = [
    'project_submission_deliverables',
    'project_revision_deliverables',
    'project_revisions',
    'project_submissions',
    'deliverable_assignments',
    'brief_flag_messages',
    'brief_flags',
    'deliverables',
    'project_posm_channels',
    'project_secondary_cs_regions',
    'project_secondary_cs',
    'project_approvals',
    'project_designers',
    'project_reviewers',
    'project_files',
    'project_customers',
    'project_regions',
    'notifications',
    'activity_logs',
    'projects',
]

for table in tables:
    try:
        cur.execute(f'TRUNCATE TABLE "{table}" RESTART IDENTITY CASCADE;')
        print(f"  ✓ {table}")
    except Exception as e:
        print(f"  ✗ {table} — {e} (may not exist, continuing)")
        conn.rollback()
        continue

conn.commit()
print("\n✅ All project data wiped. System tables (users, clients, customers, etc.) untouched.")

cur.close()
conn.close()
