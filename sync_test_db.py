"""One-off tool: rebuild the test database's schema from the models.

Run from the repo root:
    python sync_test_db.py            # dry run — reports what it would do
    python sync_test_db.py --confirm  # drops and recreates the test database

Why this exists: the pytest `app` fixture calls db.create_all(), which creates
missing TABLES but never adds a missing COLUMN to a table that already exists.
So a migration that alters an existing table never reaches the test database and
the suite fails with "column ... does not exist". Dropping the database and
letting create_all() rebuild it gives a schema that matches the models exactly.

Nothing is lost: every test runs inside a transaction that is rolled back, so
the test database only ever holds schema.

Only ever touches TEST_DATABASE_URL, guarded the same way reset_test_db.py and
the pytest fixture guard it — the name must contain 'test', and it must differ
from the dev/prod DATABASE_URL.
"""
import sys

import psycopg2
from sqlalchemy.engine.url import make_url

from config import Config, TestingConfig
from app import create_app, db


def _assert_safe_to_touch(uri):
    dbname = uri.rsplit('/', 1)[-1].split('?')[0]
    assert 'test' in dbname.lower(), (
        f"Refusing to run: test database name {dbname!r} does not contain 'test'."
    )
    assert uri != Config.SQLALCHEMY_DATABASE_URI, (
        "Refusing to run: TEST_DATABASE_URL equals the dev/prod DATABASE_URL."
    )
    return dbname


def _maintenance_connection(url):
    """A connection to the server's own 'postgres' database — you cannot drop a
    database while connected to it."""
    conn = psycopg2.connect(
        dbname='postgres',
        user=url.username,
        password=url.password,
        host=url.host,
        port=url.port or 5432,
    )
    conn.autocommit = True  # CREATE/DROP DATABASE cannot run inside a transaction
    return conn


def main():
    confirm = '--confirm' in sys.argv

    uri = TestingConfig.SQLALCHEMY_DATABASE_URI
    assert uri, "TEST_DATABASE_URL is not set."
    dbname = _assert_safe_to_touch(uri)
    url = make_url(uri)

    print(f"Test database: {dbname} on {url.host or 'localhost'}")
    if not confirm:
        print("\nDry run only — re-run with --confirm to drop and rebuild it.")
        return

    conn = _maintenance_connection(url)
    with conn.cursor() as cur:
        # A leftover session (an editor's SQL console, a stopped pytest run)
        # would block the drop, so close them first.
        cur.execute("""
            SELECT pg_terminate_backend(pid)
              FROM pg_stat_activity
             WHERE datname = %s AND pid <> pg_backend_pid();
        """, (dbname,))
        cur.execute(f'DROP DATABASE IF EXISTS "{dbname}";')
        cur.execute(f'CREATE DATABASE "{dbname}";')
    conn.close()
    print("Dropped and recreated.")

    app = create_app(TestingConfig)
    with app.app_context():
        db.create_all()
        built = sorted(db.metadata.tables)
    print(f"Rebuilt {len(built)} tables from the models.")
    print("Done. Run: python -m pytest")


if __name__ == '__main__':
    main()
