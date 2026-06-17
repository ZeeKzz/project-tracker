import psycopg2

conn = psycopg2.connect(database='project_tracker', user='postgres', password='testadmin123', host='localhost', port='5432')
cur = conn.cursor()

cur.execute("ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS teams VARCHAR(100);")

conn.commit()
cur.close()
conn.close()
print("Done — teams column added to deliverables.")
