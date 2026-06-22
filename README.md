# Vitamin Helix

Internal operations platform for Vitamin Dubai — replaces Monday.com for managing creative project briefs, deliverables, designer assignments, revision workflows, and project approvals across the 2D, 3D, and Technical design teams.

Built and maintained by Ezekiel Burton — Digital Systems Pilot Lead.

**Current version: v1.0** (shipped 22 June 2026)

---

## What It Does

- **CS** creates project briefs (C&CM or Standard), assigns regions and customers, manages deliverables and deadlines, reviews designer submissions, and approves work
- **Designers** pick up deliverables, submit work individually or in bulk, and raise flags when something needs clarification
- **Team Leads** assign designers, track team progress, and manage revision cycles
- **Admins** manage users, design types, deliverable types, and have full visibility across everything — including the ability to give final approval and lock projects
- **Management** has read-only visibility into project and team status

**Project types:**
- **C&CM** (Concept & Campaign Material) — concept/KV phase followed by POSM channel deliverables across UAE and Gulf regions
- **Standard** — flat list of deliverables without regional breakdown

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
├── migrate_*.py         # Larger migration scripts
├── create_tables.py     # Creates any new tables via db.create_all()
├── run.py               # App entry point
├── CLAUDE.md            # Dev reference (patterns, gotchas, branding tokens)
├── CHANGELOG.txt        # Per-release change log
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

# 6. Run migration scripts in order (see below)

# 7. Run the app
python run.py
```

App runs at `http://localhost:5000`

---

## Database Migrations

There is no migration framework. When a new column or table is needed, a script is written at the project root and run once manually:

```bash
python add_example_column.py
```

### Full migration order (run once on a fresh DB after create_tables.py)

```bash
python add_ccm_tables.py
python add_notification_archive.py
python add_brief_flag_tables.py
python add_design_type_team.py
python add_deliverable_teams.py
python add_hold_status.py
python add_concept_kv_status.py
python add_posm.py
python add_gulf_posm.py
python add_posm_country_counts.py
python add_posm_channels.py
python migrate_approval.py
```

---

## Roles

| Role | Access |
|------|--------|
| Admin | Full access, user management, emulation mode, final project approval |
| CS | Create and manage briefs, review submissions, flag revisions, CS-approve work |
| Designer | View assigned deliverables, submit work, raise flags |
| Team Lead | Assign designers, manage team deliverables, update status |
| Management | Read-only dashboard |

---

## Deployment

Production runs on a Mini-PC (Ubuntu Server 24.04) in the Vitamin Dubai server room. Accessible locally at `http://10.101.20.159:5000` and externally at `https://app.vitamin-e.work` via Cloudflare Tunnel.

See `Vitamin_Helix_Infrastructure.pdf` for the full setup, backup strategy, and deploy workflow.

**Quick deploy from dev machine:**
```bash
git push
ssh ssh.vitamin-e.work
cd project-tracker && git pull && sudo systemctl restart helix
```

---

## Versioning

| Format | Meaning |
|--------|---------|
| `X.YY` (e.g. `1.01`, `1.02`) | Bug fix or QoL patch — no new features |
| `X.Y` (e.g. `1.1`, `1.2`) | Feature update within the current major scope |
| `X.0` (e.g. `2.0`, `3.0`) | New major era / large scope shift |

**1.x era** = project management (briefs, deliverables, submissions, POSM, approval).  
**Planned:** 1.1 = NAS integration; 1.2 = live in-app updates via SSE (candidate); 1.3 = client portal (candidate).

---

## Key Dev Notes

See `CLAUDE.md` for patterns, gotchas, branding tokens, and architectural decisions. Key things to know:

- Always resolve the **effective user** (not `current_user`) in routes that record actions — the app supports admin emulation mode
- `project.project_status == 'approved'` is the global lock sentinel — check it at the top of any mutating route
- JSON data in templates must go in `<script>` block constants, never in HTML `value=""` attributes
- `log_activity()` imports db inside the function to avoid circular imports
- Notifications must be created **after** `db.session.commit()`
- Dubai timezone uses a fixed `+4` offset — `ZoneInfo` is not reliable on Windows without `tzdata`
- `--surface` CSS variable is not defined — use `--white` for solid white backgrounds
