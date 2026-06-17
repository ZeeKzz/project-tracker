import psycopg2

conn = psycopg2.connect(database='project_tracker', user='postgres', password='testadmin123', host='localhost', port='5432')
cur = conn.cursor()

cur.execute("""
    CREATE TABLE IF NOT EXISTS brief_flags (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        deliverable_id INTEGER REFERENCES deliverables(id) ON DELETE CASCADE,
        flag_type VARCHAR(20) NOT NULL,
        created_by_id INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
        resolved_at TIMESTAMP,
        resolved_by_id INTEGER REFERENCES users(id)
    );
""")

cur.execute("""
    CREATE TABLE IF NOT EXISTS brief_flag_messages (
        id SERIAL PRIMARY KEY,
        flag_id INTEGER NOT NULL REFERENCES brief_flags(id) ON DELETE CASCADE,
        author_id INTEGER NOT NULL REFERENCES users(id),
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
    );
""")

conn.commit()
cur.close()
conn.close()
print("Done — brief_flags and brief_flag_messages tables created.")
