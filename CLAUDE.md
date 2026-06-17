# Vitamin Helix — Project Reference

## Stack
- Python 3.14.5 · Flask 3.1.3 · PostgreSQL 18.4 (`project_tracker` DB) · Flask-SQLAlchemy · Flask-Login
- No Flask-Migrate — schema changes via one-off ALTER TABLE scripts at project root
- Entry point: `run.py`

## Roles & Teams
**Roles:** Admin, CS, Designer, Team Lead, Management  
**Teams:** 3D, 2D, Technical

## Key Patterns

### Emulation-aware actor
When a route needs to record who performed an action, always resolve the effective user — not blindly `current_user`:
```python
from flask import session
from app.models import User as UserModel

emulating_id = session.get('emulating_user_id')
actor = UserModel.query.get(emulating_id) if (emulating_id and current_user.role == 'admin') else current_user
```

### New DB columns
Write a migration script at root, e.g. `add_example_column.py`, then run it once:
```python
cur.execute("ALTER TABLE table_name ADD COLUMN IF NOT EXISTS col_name VARCHAR(100);")
```

### New DB tables
Use `python create_tables.py` (db.create_all pattern) — do NOT use Flask-Migrate.

### Activity logging
Always import inside the function to avoid circular imports:
```python
def log_activity(action, description, ...):
    from app import db
    from app.models import ActivityLog
    ...
```
Capture `name = obj.name` BEFORE `db.session.delete(obj)` — SQLAlchemy clears attributes post-commit.

### Notifications
`create_notification()` always AFTER `db.session.commit()`. Kwarg is `notification_type=`, not `notif_type=`.

### JS in templates
Always use `{{ variable | tojson }}` when embedding Python data in `<script>` tags.

### Expandable rows
Use `this.nextElementSibling` not `getElementById` — avoids duplicate ID collisions between table sections.

## DB Facts
- `creator=current_user` (object), NOT `created_by_id=current_user.id` (integer)
- `db.session.flush()` when child needs parent's auto-generated ID before commit
- `cascade='all, delete-orphan'` on Project → ProjectCustomer, ProjectRegion, Deliverable
- Bulk delete: `.delete(synchronize_session=False)`
- Dubai timezone: `timezone(timedelta(hours=4))` fixed offset — `ZoneInfo` requires `tzdata` on Windows

## Branding Tokens
```
--tangerine: #F27F55   (primary)
--sandstone: #F5F0E8   (bg)
--pine:      #63775B   (success)
--rose:      #D9A2A8   (error)
--canary:    #E5D259
--ashen:     #94B4BB
--oak:       #A07C5A
```
Fonts (local woff2): Barlow Condensed Bold · DM Mono Medium · Public Sans Bold

## Pill Button CSS Patterns
- **Checkbox-based** (submits with form): `.team-tag-toggle` + `:has(input:checked)` for active state
- **JS-toggled** (no form submit): `.team-tag-btn` + `.active` class toggled in JS
- Unselected state: `background: var(--surface-hover)` so they look interactive

## Standard Brief Deliverables
Stored in `deliverables` table with `project_customer_id = NULL`. Key columns:
- `design_deadline` (Date)
- `teams` (VARCHAR, comma-separated e.g. `"3D,Technical"`)
- `flagged_for_revision` (Boolean)
- `revision_count` (Integer)

`detail()` route computes `standard_designers_by_deliverable` — dict of `{deliverable_id: [User, ...]}` filtered by `d.teams`, falling back to project-level designer pool.

## Infrastructure
See `Vitamin_Helix_Infrastructure.pdf` in this folder for full deployment reference.

**Short version:**
- Dev: Windows laptop → `git push`
- Production: Mini-PC (Linux, server room) — `git pull && sudo systemctl restart helix`
- Backups: daily `pg_dump` → Synology NAS `Admin/Database/daily/`
- Remote access: AnyDesk on Mini-PC, Synology DSM for NAS, VPN for off-site

## Migration Scripts at Root
| Script | Purpose |
|--------|---------|
| `add_ccm_tables.py` | C&CM brief tables |
| `add_notification_archive.py` | `is_archived` on Notification |
| `add_brief_flag_tables.py` | BriefFlag + BriefFlagMessage |
| `add_design_type_team.py` | `team` column on DesignType |
| `add_deliverable_teams.py` | `teams` column on Deliverable |
| `create_tables.py` | db.create_all for new tables |
