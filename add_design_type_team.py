import psycopg2

conn = psycopg2.connect(database='project_tracker', user='postgres', password='testadmin123', host='localhost', port='5432')
cur = conn.cursor()

cur.execute("ALTER TABLE design_types ADD COLUMN IF NOT EXISTS team VARCHAR(50);")

conn.commit()
cur.close()
conn.close()
print("Done — team column added to design_types.")
