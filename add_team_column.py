from app import create_app, db
from sqlalchemy import text

app = create_app()

with app.app_context():
    db.session.execute(text('ALTER TABLE users ADD COLUMN team VARCHAR(20)'))
    db.session.commit()
    print('Added team column to users table.')