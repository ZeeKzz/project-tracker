# Vitamin-E — Project Reference

## Stack
- Python 3.14.5 · Flask 3.1.3 · PostgreSQL 18.4 (`project_tracker` DB) · Flask-SQLAlchemy · Flask-Login
- No Flask-Migrate — schema changes via one-off ALTER TABLE scripts at project root
- Entry point: `run.py`

## Roles & Teams
**Roles:** Admin, CS, Designer, Team Lead, Management  
**Teams:** 3D, 2D, Technical

---

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

### JS in templates — JSON data
Always use a `<script>` block constant for Python data embedded in JS. NEVER put JSON in HTML `value=""` attributes — Flask's `tojson` does not escape `"` for HTML attributes, causing silent `JSON.parse` failures.

```html
<!-- CORRECT -->
<script>
  const MY_DATA = {{ my_data | tojson }};
</script>

<!-- WRONG — breaks silently when values contain quotes -->
<input type="hidden" value="{{ my_data | tojson }}">
```

### Expandable rows
Use `this.nextElementSibling` not `getElementById` — avoids duplicate ID collisions between table sections.

### Modal confirm callbacks
Save the callback before calling close — closing the modal nullifies the stored reference:
```javascript
var fn = _approveCallback;  // save first
closeApprovalModal();        // this sets _approveCallback = null
if (fn) fn();               // now safe to call
```

### Approval lock guard
`project.project_status == 'approved'` is the global sentinel. Add this at the top of any mutating route:
```python
if project.project_status == 'approved':
    return jsonify({'success': False, 'error': 'Project is approved and locked'}), 403
```
CS users see read-only status badges (not dropdowns) on approved projects. Admin retains full access.

---

## DB Facts
- `creator=current_user` (object), NOT `created_by_id=current_user.id` (integer)
- `db.session.flush()` when child needs parent's auto-generated ID before commit
- `cascade='all, delete-orphan'` on Project → ProjectCustomer, ProjectRegion, Deliverable
- Bulk delete: `.delete(synchronize_session=False)`
- Dubai timezone: `timezone(timedelta(hours=4))` fixed offset — `ZoneInfo` requires `tzdata` on Windows

---

## CSS Facts
- `--surface` is NOT defined in `:root` — it resolves to transparent. Use `--white` (#FFFFFF) for solid white backgrounds.
- Global `h1–h6 { text-transform: uppercase }` — override with `text-transform: none; letter-spacing: normal; font-family: var(--font-body)` on any heading that should render normally.

---

## Branding Tokens
```
--tangerine: #F27F55   (primary)
--sandstone: #F5F0E8   (bg)
--pine:      #63775B   (success)
--rose:      #D9A2A8   (error)
--canary:    #E5D259
--ashen:     #94B4BB
--oak:       #A07C5A
--white:     #FFFFFF
--black:     #1A1A1A
```
Fonts (local woff2): Barlow Condensed Bold · DM Mono Medium · Public Sans Bold

---

## Pill Button CSS Patterns
- **Checkbox-based** (submits with form): `.team-tag-toggle` + `:has(input:checked)` for active state
- **JS-toggled** (no form submit): `.team-tag-btn` + `.active` class toggled in JS
- Unselected state: `background: var(--surface-hover)` so they look interactive

---

## Standard Brief Deliverables
Stored in `deliverables` table with `project_customer_id = NULL`. Key columns:
- `design_deadline` (Date)
- `teams` (VARCHAR, comma-separated e.g. `"3D,Technical"`)
- `flagged_for_revision` (Boolean)
- `revision_count` (Integer)

`detail()` route computes `standard_designers_by_deliverable` — dict of `{deliverable_id: [User, ...]}` filtered by `d.teams`.

**Upsert pattern on edit** — do NOT delete-and-recreate deliverables on brief edit. Match by name, preserve status, update only deadline/teams. Delete only those whose names are absent from the submitted list.

---

## Concept & KV
Always treated as a single unit. `has_kv` always mirrors `has_concept`. Fields used:
- `concept_deadline`, `concept_options_required`, `concept_requirements` (or legacy `campaign_notes`)
- `kv_requirements` (legacy only — show separately if different from concept_requirements)
- Separate designer assignment: `concept_designer_id`, `kv_designer_id`

Revision picker shows ONE "Concept & KV" row when both flags are true. JS collect handler auto-sets `includesKV = true` when `includesConcept && projectHasKV`.

---

## Submission System
**project_status / deliverable.status state machine:**
`in_queue` → `in_progress` → `submitted` → `internal_revision` → `revision_in_queue` → `revision_in_progress` → `approved`

**POSM channel.status:** same states; cascades to project `approved` when all channels done.

**concept_status / kv_status:** same state strings as above.

- Standard brief: project-level approval via `approve_submission` route
- POSM: per-channel per-customer approval; cascades to project `approved` when all channels done
- `ProjectSubmissionDeliverable` junction table links submissions to specific deliverables
- Activity log entry on every state transition

---

## POSM Channel System
- `ProjectPosmChannel` table: one row per channel per project (UAE, KSA, Kuwait, Bahrain, Oman, Qatar)
- UAE tracks per-customer (`ProjectPosmCustomer`); Gulf tracks per-country (channel-level)
- `posm_started` flag on Project; `posm_started_at` timestamp
- Begin POSM button condition: `(project.has_concept or project.has_kv) and not project.posm_started`

---

## Notification System
Routes in `app/routes/notifications.py`:
- `POST /notifications/<id>/read`
- `POST /notifications/<id>/archive`
- `POST /notifications/archive-all` — bulk archives all inbox notifications
- `POST /notifications/delete-bulk` — permanently deletes by ID list
- `POST /notifications/<id>/restore`
- `POST /notifications/mark-all-read`
- `GET /notifications/poll` — lightweight polling (30s interval)

Real-time DOM updates use `buildArchivedItem()` / `buildInboxItem()` helpers in `main.js`. Archive-all also injects toolbar into archived view if it didn't exist (when archived was previously empty).

---

## Infrastructure
See `Vitamin_Helix_Infrastructure.pdf` in this folder for full deployment reference.

**Quick reference:**
- Dev: Windows laptop → `git push`
- Production: Mini-PC (`vitamine`, `10.101.20.159`, Ubuntu 24.04) — `git pull && sudo systemctl restart helix`
- External access: `https://app.vitamin-e.work` (Cloudflare Tunnel), `ssh ssh.vitamin-e.work` (Cloudflare Zero Trust)
- Backups: daily `pg_dump` → Synology NAS `Admin/Database/daily/`

---

## Versioning Scheme
| Format | Meaning | Examples |
|--------|---------|---------|
| `X.Y` | Major scope / feature update | `1.1`, `1.2`, `1.3` |
| `X.YY` | Bug fix / QoL patch | `1.01`, `1.02`, `1.03` |
| `X.0` | New major era | `2.0`, `3.0` |

**Current:** v1.3 (shipped 28 June 2026)  
**1.x era:** project management (briefs, submissions, deliverables, POSM, approval)  
**2.x era:** infrastructure + NAS integration + dashboard + client portal (starting 29 June 2026)

| Version | Scope |
|---------|-------|
| 1.01 | Real-time assignment DOM updates · C&CM reference images · GMT+4 timestamps · Approved projects filters |
| 1.02 | Bug fixes (populated from pilot feedback) |
| 1.2.1 | Visual loading indicators · Admin panel to sidebar · Form input styling · 2s autosave debounce · Assign designer bug fixes |
| 1.3 | App Updates blog · Feature Requests · Bug Reports (emulation-aware, status notifications, admin email alerts, styled confirm modals, instant card updates) |

**v2.0 roadmap (next era):**
- Gunicorn switch (production server)
- Dashboard — wireframes from team, then build (Admin/Management view)
- NAS integration — file storage for projects, reference files, submissions
- Project progress bar — per-project visual at a glance; shareable client link for live tracking
- In-app file preview — reference files and submission PDFs
- C&CM deliverable reference images — per-deliverable image display in app

See `ROADMAP.md` for full specs.

---

## Blog System
Routes in `app/routes/blog.py` (blueprint: `blog_bp`):
- `GET /blog` — two-panel index (post list left, content right)
- `GET /blog/post/<id>` — AJAX: returns `_post_content.html` partial
- `GET /blog/editor` / `GET /blog/editor/<id>` — admin post editor
- `POST /blog/posts` — create post (JSON body)
- `PUT /blog/posts/<id>` — update post (JSON body)
- `POST /blog/posts/<id>/publish` — toggle published state
- `DELETE /blog/posts/<id>` — delete post (admin only)
- `POST /blog/post/<id>/comments` — add comment (form data)
- `DELETE /blog/comments/<id>` — delete comment (admin only)

**Post data structure** — `sections_json` TEXT column stores JSON array:
```json
[{"anchor":"overview","number":"01","title":"Overview","blocks":[
  {"type":"body","text":"..."},
  {"type":"callout","text":"...","color":"pine"},
  {"type":"h3","text":"Sub heading"},
  {"type":"list","items":["item 1","item 2"]}
]}]
```
Block types: `body`, `callout` (optional `color: "pine"`), `h3`, `list`.

URL hash navigation: `#post-{id}` — blog.js auto-loads post on page load from hash.

Admin-only: create/edit/delete posts, delete comments. All users can comment (no moderation).

---

## Feature Requests & Bug Reports
Routes in `app/routes/feedback.py` (blueprint: `feedback_bp`):

**Feature Requests**
- `GET /feature-requests` — two-panel index; embeds `FEATURES_DATA` JSON for client-side rendering
- `GET /feature-requests/<id>` — AJAX: returns `_feature_content.html` partial
- `POST /feature-requests/submit` — create feature request
- `POST /feature-requests/<id>/upvote` — toggle upvote
- `POST /feature-requests/<id>/status` — update status (admin only)
- `POST /feature-requests/<id>/comments` — add comment/reply
- `DELETE /feature-requests/comments/<id>` — delete comment (admin only)
- `DELETE /feature-requests/<id>` — delete feature (admin or creator)

Statuses: `in_queue → in_progress → implemented`  
Notifications: creator notified on `in_progress` and `implemented`  
Upvotes: stored in `feature_request_upvotes` association table

**Bug Reports**
- `GET /bug-reports` — two-panel index; embeds `BUGS_DATA` JSON
- `GET /bug-reports/<id>` — AJAX: returns `_bug_content.html` partial
- `POST /bug-reports/submit` — create bug report
- `POST /bug-reports/<id>/status` — update status (admin only)
- `POST /bug-reports/<id>/comments` — add comment/reply
- `DELETE /bug-reports/comments/<id>` — delete comment (admin only)
- `DELETE /bug-reports/<id>` — delete bug (admin or creator)

Statuses: `in_queue → fix_in_progress → testing → resolved`  
Notifications: creator notified on `fix_in_progress` and `resolved`  
No upvotes on bug reports.

**Shared patterns:**
- Both pages use IIFE in JS with `window._render*Cards`, `window._remove*`, `window._*Confirm` exposed for cross-function access
- Status cards update instantly client-side (no page refresh) — local array copy drives renders
- Admin email sent to `ezekiel@vitamin.works` on every new submission via `notify_admin_of_new_feedback()` in `app/notifications.py`
- Both are emulation-aware: `{% set is_admin = actor.role == 'admin' %}` / `{% set is_creator = actor.id == item.submitted_by_id %}`
- Styled delete confirm modal (`.del-overlay` / `.del-modal`) in `feedback.css`

---

## Migration Scripts at Root
| Script | Purpose |
|--------|---------|
| `add_ccm_tables.py` | C&CM brief tables |
| `add_notification_archive.py` | `is_archived` on Notification |
| `add_brief_flag_tables.py` | BriefFlag + BriefFlagMessage |
| `add_design_type_team.py` | `team` column on DesignType |
| `add_deliverable_teams.py` | `teams` + `design_deadline` on Deliverable |
| `add_hold_status.py` | hold status on projects |
| `add_concept_kv_status.py` | `concept_status`, `kv_status` on Project |
| `add_posm.py` | POSM fields on Project |
| `add_gulf_posm.py` | Gulf POSM country tracking |
| `add_posm_country_counts.py` | Per-country POSM revision counts |
| `add_posm_channels.py` | ProjectPosmChannel table |
| `migrate_approval.py` | `approved_at`, `approved_by_id` on Project + ProjectSubmission |
| `create_tables.py` | db.create_all for new tables (ActivityLog, BriefFlag, etc.) |
| `add_blog_tables.py` | `blog_posts` + `blog_comments` tables |
| `add_bug_report_tables.py` | `bug_reports` + `bug_report_comments` tables |
