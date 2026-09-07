"""
Migration: drop the retired free-text client_servicing.invoice_month.

Run this only after add_client_servicing_invoice_month_date.py has run and
its results have been checked — this deletes the original text.

Run once: python drop_client_servicing_invoice_month_text.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import create_app, db

app = create_app()
with app.app_context():
    conn = db.engine.raw_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT COUNT(*) FROM client_servicing
        WHERE invoice_month IS NOT NULL
          AND invoice_month <> ''
          AND invoice_month_date IS NULL;
    """)
    stranded = cur.fetchone()[0]
    if stranded:
        cur.close()
        conn.close()
        raise SystemExit(
            "Refusing to drop: {} row(s) still have text that never made it "
            "into invoice_month_date. Fix those first.".format(stranded)
        )

    cur.execute("ALTER TABLE client_servicing DROP COLUMN IF EXISTS invoice_month;")
    conn.commit()
    cur.close()
    conn.close()
    print("Dropped client_servicing.invoice_month.")
