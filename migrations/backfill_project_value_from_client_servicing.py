"""
Backfill: client_servicing.project_value -> projects.value.

The two were separate columns showing the same thing; projects.value is now
the single value the Table, Invoicing and Closed all read. Copies a CS value
up only where the project has none. Where both exist and disagree it changes
nothing and prints the pair, so a human decides those.

Run once: python backfill_project_value_from_client_servicing.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import create_app, db

app = create_app()
with app.app_context():
    conn = db.engine.raw_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT p.id, p.name, p.value, cs.project_value
        FROM client_servicing cs
        JOIN projects p ON p.id = cs.project_id
        WHERE cs.project_value IS NOT NULL
          AND p.value IS NOT NULL
          AND p.value <> cs.project_value;
    """)
    conflicts = cur.fetchall()

    cur.execute("""
        UPDATE projects p
        SET value = cs.project_value
        FROM client_servicing cs
        WHERE cs.project_id = p.id
          AND cs.project_value IS NOT NULL
          AND p.value IS NULL;
    """)
    filled = cur.rowcount
    conn.commit()
    cur.close()
    conn.close()

    print("Filled {} project(s) that had no value.".format(filled))
    if conflicts:
        print("\n{} project(s) have BOTH values and they disagree — left "
              "untouched, decide these by hand:".format(len(conflicts)))
        print("  {:<6} {:<45} {:>14} {:>14}".format("id", "project", "projects.value", "cs.project_value"))
        for pid, name, pvalue, csvalue in conflicts:
            print("  {:<6} {:<45} {:>14} {:>14}".format(pid, (name or '')[:45], str(pvalue), str(csvalue)))
    else:
        print("No conflicting pairs.")
