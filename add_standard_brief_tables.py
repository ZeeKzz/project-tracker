import psycopg2

conn = psycopg2.connect(database='project_tracker', user='postgres', password='testadmin123', host='localhost', port='5432')
cur = conn.cursor()

# Design types (admin-managed list)
cur.execute("""
    CREATE TABLE IF NOT EXISTS design_types (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE
    );
""")

# Design directions (admin-managed list)
cur.execute("""
    CREATE TABLE IF NOT EXISTS design_directions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE
    );
""")

# Add standard brief fields to projects
cur.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS design_type_id INTEGER REFERENCES design_types(id) ON DELETE SET NULL;")
cur.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS design_direction_id INTEGER REFERENCES design_directions(id) ON DELETE SET NULL;")
cur.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_expectation TEXT;")
cur.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS what_to_avoid TEXT;")
cur.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS additional_information TEXT;")

# Add per-deliverable deadline columns (used by standard brief deliverables)
cur.execute("ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS design_deadline DATE;")
cur.execute("ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS installation_deadline DATE;")

# Make project_customer_id nullable so standard brief deliverables don't need a customer
cur.execute("ALTER TABLE deliverables ALTER COLUMN project_customer_id DROP NOT NULL;")

conn.commit()
cur.close()
conn.close()
print("Done — standard brief tables and columns created.")
