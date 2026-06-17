import psycopg2

conn = psycopg2.connect(database='project_tracker', user='postgres', password='testadmin123', host='localhost', port='5432')
cur = conn.cursor()

cur.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS revision_count INTEGER NOT NULL DEFAULT 0;")
cur.execute("ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS revision_count INTEGER NOT NULL DEFAULT 0;")
cur.execute("ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS flagged_for_revision BOOLEAN NOT NULL DEFAULT FALSE;")

conn.commit()
cur.close()
conn.close()
print("Done — revision_count on projects, revision_count + flagged_for_revision on deliverables.")
