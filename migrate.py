import psycopg2

conn = psycopg2.connect('postgresql://postgres:testadmin123@localhost:5432/project_tracker')
cur = conn.cursor()

cur.execute('ALTER TABLE projects ADD COLUMN IF NOT EXISTS has_concept BOOLEAN NOT NULL DEFAULT FALSE')
cur.execute('ALTER TABLE projects ADD COLUMN IF NOT EXISTS concept_options_required INTEGER')

conn.commit()
cur.close()
conn.close()

print('Migration complete.')
