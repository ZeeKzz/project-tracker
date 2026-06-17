import psycopg2

conn = psycopg2.connect('postgresql://postgres:testadmin123@localhost:5432/project_tracker')
cur = conn.cursor()

cur.execute("""
    ALTER TABLE project_customers
    ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'briefed'
""")

conn.commit()
cur.close()
conn.close()
print('Migration complete.')