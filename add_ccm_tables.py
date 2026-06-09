from app import create_app, db
from sqlalchemy import text

app = create_app()

with app.app_context():
    db.create_all()
    print("All new tables created")
    print("Tables SQLAlchemy knows about:", list(db.metadata.tables.keys()))

    db.session.execute(text('''
        ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id),
        ADD COLUMN IF NOT EXISTS brief_type VARCHAR(50),
        ADD COLUMN IF NOT EXISTS project_status VARCHAR(50) DEFAULT 'draft',
        ADD COLUMN IF NOT EXISTS campaign_notes TEXT,
        ADD COLUMN IF NOT EXISTS urgency VARCHAR(50),
        ADD COLUMN IF NOT EXISTS required_output VARCHAR(100),
        ADD COLUMN IF NOT EXISTS briefing_date DATE,
        ADD COLUMN IF NOT EXISTS first_output_deadline DATE,
        ADD COLUMN IF NOT EXISTS installation_date DATE,
        ADD COLUMN IF NOT EXISTS last_autosaved_at TIMESTAMP
    '''))
    db.session.commit()
    print("Projects table updated")

    try:
        db.session.execute(text('''
            ALTER TABLE customers
            ADD CONSTRAINT unique_customer_region
            UNIQUE (name, region)
        '''))
        db.session.commit()
        print("Customer unique constraint added")
    except Exception:
        db.session.rollback()
        print("Customer unique constraint already exists, skipping")

    print("Migration complete")