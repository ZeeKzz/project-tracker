# Vitamin Helix

Internal operations platform for Vitamin Dubai. Replaces Monday.com for managing creative project briefs, deliverables, designer assignments, and revision workflows across the 2D, 3D, and Technical design teams.

Built and maintained by Ezekiel Burton — Digital Systems Pilot Lead.

---

## What It Does

- **CS** creates project briefs (C&CM or Standard), assigns deadlines, and manages deliverables
- **Designers** pick up deliverables, submit work, and raise flags if something is wrong
- **Team Leads** assign designers, track progress, and manage their team's workload
- **Admins** manage users, design types, directions, and have full visibility across everything
- **Management** has read-only visibility into project and team status

---

## Stack

- **Backend:** Python 3.14 · Flask 3.1.3 · Flask-SQLAlchemy · Flask-Login
- **Database:** PostgreSQL 18.4 (database: `project_tracker`)
- **Frontend:** Jinja2 server-rendered templates · Vanilla JS · Custom CSS
- **No ORM migrations** — schema changes are handled via one-off ALTER TABLE scripts at the project root

---

## Project Structure

```
project-tracker/
├── app/
│   ├── models/          # SQLAlchemy models
│   ├── routes/          # Flask blueprints (projects, admin, notifications, etc.)
│   ├── templates/       # Jinja2 HTML templates
│   │   └── projects/    # create, detail, edit views
│   ├── static/
│   │   ├── css/main.css
│   │   └── js/main.js
│   ├── notifications.py # Notification helper functions
│   └── utils.py         # log_activity() and shared utilities
├── add_*.py             # One-off DB migration scripts (run manually, once)
├── create_tables.py     # Creates any new tables via db.create_all()
├── run.py               # App entry point
├── CLAUDE.md            # Dev reference (patterns, gotchas, branding tokens)
├── CHANGELOG.txt        # Per-session change log
└── Vitamin_Helix_Infrastructure.pdf  # Deployment & infrastructure reference
```

---

## Local Setup

**Prerequisites:** Python 3.14+, PostgreSQL 18, pip

```bash
# 1. Clone the repo
git clone https://github.com/ZeeKzz/project-tracker.git
cd project-tracker

# 2. Install dependencies
pip install -r requirements.txt

# 3. Create the database
createdb -U postgres project_tracker

# 4. Set up environment variables
cp .env.example .env
# Edit .env with your DB credentials and mail config

# 5. Create tables
python create_tables.py

# 6. Run the app
python run.py
```

App runs at `http://localhost:5000`

---

## Database Migrations

There is no migration framework. When a new column or table is needed, a script is written at the project root and run once manually:

```bash
python add_example_column.py
```

All migration scripts follow the naming convention `add_*.py`. Run them in order if setting up from scratch — see CHANGELOG.txt for which scripts were added in each session.

---

## Roles

| Role | Access |
|------|--------|
| Admin | Full access, user management, emulation mode |
| CS | Create and manage briefs, flag revisions |
| Designer | View assigned deliverables, submit work, raise flags |
| Team Lead | Assign designers, manage team deliverables, update status |
| Management | Read-only dashboard |

---

## Deployment

Production runs on a Mini-PC (Linux) in the Vitamin Dubai server room on the local network. See `Vitamin_Helix_Infrastructure.pdf` for the full setup, backup strategy, and deploy workflow.

**Quick deploy from dev machine:**
```bash
ssh user@<mini-pc-ip> "cd ~/project-tracker && git pull && sudo systemctl restart helix"
```

---

## Key Dev Notes

See `CLAUDE.md` for patterns, gotchas, branding tokens, and architectural decisions. Key things to know:

- Always resolve the **effective user** (not `current_user`) in routes that record actions — the app supports admin emulation mode
- `log_activity()` imports db inside the function to avoid circular imports
- Notifications must be created **after** `db.session.commit()`
- Dubai timezone uses a fixed `+4` offset — `ZoneInfo` is not reliable on Windows without `tzdata`
