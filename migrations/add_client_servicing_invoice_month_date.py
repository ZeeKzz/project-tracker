"""
Migration: invoice month becomes a real month.

Adds client_servicing.invoice_month_date (the 1st of the month) and carries
the old free-text invoice_month across. Anything that can't be read is left
alone and printed, so nothing is lost silently. The text column stays until
you've checked the result — drop_client_servicing_invoice_month_text.py
removes it afterwards.

Run once: python add_client_servicing_invoice_month_date.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import create_app, db
from app.modules.client_servicing.lib.months import parse_month

app = create_app()
with app.app_context():
    conn = db.engine.raw_connection()
    cur = conn.cursor()
    cur.execute("""
        ALTER TABLE client_servicing
        ADD COLUMN IF NOT EXISTS invoice_month_date DATE;
    """)
    conn.commit()

    # The text column may already be gone (this script re-run after the drop),
    # in which case there is nothing left to carry across.
    cur.execute("""
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'client_servicing' AND column_name = 'invoice_month';
    """)
    if cur.fetchone() is None:
        conn.commit()
        cur.close()
        conn.close()
        print("invoice_month_date is in place; the old text column is already gone.")
        raise SystemExit(0)

    cur.execute("""
        SELECT id, invoice_month FROM client_servicing
        WHERE invoice_month IS NOT NULL
          AND invoice_month <> ''
          AND invoice_month_date IS NULL;
    """)
    rows = cur.fetchall()

    carried, unreadable = 0, []
    for row_id, text in rows:
        parsed = parse_month(text)
        if parsed is None:
            unreadable.append((row_id, text))
            continue
        cur.execute(
            "UPDATE client_servicing SET invoice_month_date = %s WHERE id = %s;",
            (parsed, row_id),
        )
        carried += 1
    conn.commit()
    cur.close()
    conn.close()

    print("Carried {} of {} invoice month(s) across.".format(carried, len(rows)))
    if unreadable:
        print("\n{} could not be read — left unset, fix these by hand:".format(len(unreadable)))
        for row_id, text in unreadable:
            print("  client_servicing.id={:<6} {!r}".format(row_id, text))
    else:
        print("Nothing unreadable.")
