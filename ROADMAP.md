# Vitamin Helix — Roadmap

---

## v1.01 — Small Fixes
*QoL improvements; no new major features.*

---

### 1. Real-time designer assignment on detail page
Currently, assigning a designer on the project detail page triggers a full page reload. The assignment should update the UI in place — the designer name appears in the field and the form closes, same pattern as how archive/restore works in notifications.

**Scope:** All assignment forms on detail.html — concept designer, KV designer, per-deliverable designer assignment. POST to existing assign routes; on success, update the displayed name in the DOM.

---

### 2. Deliverable reference images for C&CM (hard-coded)
Each C&CM deliverable type should have a reference image so designers and CS know what the output looks like. Images are hard-coded per deliverable type (not user-uploaded in this version).

**Scope:**
- Admin panel: when adding/editing a deliverable type, select a reference image from a predefined set (or upload one — TBD)
- Project detail page: show the reference image thumbnail on each deliverable row in the C&CM section
- "Hard-coded" means a fixed library of images stored in `app/static/img/deliverables/` — filenames are mapped to deliverable type names or IDs

---

### 3. Submission timestamps in GMT+4
Submission times currently display in UTC. They should show in Dubai time (GMT+4, no DST) everywhere they appear — submission cards, activity log, notification panel, history views.

**Scope:** Apply the existing `DUBAI_TZ = timezone(timedelta(hours=4))` conversion pattern to all timestamp displays related to submissions. Audit all `created_at` / `submitted_at` render points.

---

### 4. Approved projects — filters
The Approved Projects tab on all three dashboards (CS, Team Lead, Management) currently shows a flat list. Add combinable filters:

- **CS Lead** — dropdown of CS users
- **Name search** — text search on project name / client name
- **Assigned designer** — dropdown of designer users

Filters should combine (AND logic) and update the list in real time without a page reload. All filter state lives client-side — the full approved list is already passed to the template via `window.approvedProjects`.

---

## v1.02 — Bug Fixes
*Populated from usage feedback after v1.0 goes live. No items locked yet.*

Items will be added here as bugs are reported and triaged during the pilot period.

---

## v1.1 — Overhauls & QoL Updates

---

### 1. Bug Report System

A lightweight internal bug tracking system, accessible to all users but managed exclusively by admin.

**User-facing (all roles):**
- Bug report button/icon in the navbar — visible to all logged-in users
- Form fields: "Description of bug" (free text), "Steps to reproduce" (free text)
- On submit: bug is logged, user sees confirmation toast

**Admin-facing:**
- Dedicated bug report page (nav icon visible only to admin)
- Admin receives an in-app notification when a new bug is submitted
- Each bug card shows: submitter name, role, submitted date, description, steps
- Status flow with action buttons:

| Status | Action to advance |
|--------|------------------|
| Notified | "Begin Fixing" |
| Fix in Progress | "Begin Testing" |
| Testing in Progress | "Ready for Deployment" |
| Ready for Implementation | "Mark as Resolved" |
| Resolved | — (closed) |

- Resolved bugs move to a collapsible "Bug History" section at the bottom of the same page
- Bugs cannot be deleted — only resolved

**Implementation notes:**
- New `BugReport` model: `id`, `submitted_by_id`, `description`, `steps_to_reproduce`, `status`, `created_at`, `resolved_at`
- New blueprint `app/routes/bugs.py`
- Migration: `add_bug_reports.py`
- Notification type: `bug_submitted` → admin only

---

### 2. Feature Request System

Anyone in the app can submit a feature idea. Simpler than bug reports — no status workflow, just a submission log for admin to review.

**User-facing (all roles):**
- "Request a Feature" option — location TBD (possibly same nav area as bug report, or in account menu)
- Form fields: "Feature title" (short), "Description / use case" (free text)
- On submit: confirmation toast

**Admin-facing:**
- Feature requests list on admin panel (or combined with bug report page)
- Admin can mark a request as "Under Consideration", "Planned", or "Declined" with an optional note
- Submitter gets notified when their request status changes

**Implementation notes:**
- New `FeatureRequest` model: `id`, `submitted_by_id`, `title`, `description`, `status`, `admin_note`, `created_at`
- Can share blueprint with bug reports (`app/routes/bugs.py`)
- Migration: added to `add_bug_reports.py` or separate `add_feature_requests.py`

---

### 3. Project Time Tracking

Track how long each project spends in each status stage. Surfaces bottlenecks and gives management visibility into pipeline velocity.

**What gets tracked:**
- Time in each project status (in_queue, in_progress, submitted, awaiting_review, revision_requested, re_submitted, cs_approved, approved)
- Time in "on hold" status is excluded from active working time
- Per-revision cycle breakdown (how long revision round 1 took vs round 2)

**Dashboard (admin / management):**
- Per-project timeline view: horizontal bar or gantt-style showing time in each status
- Aggregate charts:
  - Average time per status across all projects
  - Average total project duration (brief to approval)
  - % of projects that hit revision (and how many rounds on average)
  - Longest vs fastest projects
- Filters: date range, brief type (C&CM vs Standard), CS lead, client

**Implementation notes:**
- New `ProjectStatusLog` model: `id`, `project_id`, `status`, `entered_at`, `exited_at`, `duration_seconds`
- Log entry created on every project status change; `exited_at` filled when status changes again
- "On hold" periods are flagged and excluded from working time calculations
- Dashboard uses Chart.js (already available via CDN) for charts
- Migration: `add_project_status_log.py`

---

## v1.2+ — Candidates (not yet locked)

- **NAS integration** — auto project folder creation on submission, folder naming convention (Client - Project), uploads routed to NAS via SMB mount on Mini-PC. *Physical NAS setup (folders, permissions, file structure) handled separately on 23 June 2026; software integration follows in v1.2.*
- **Live in-app updates via SSE** — replace 30-second notification polling with Server-Sent Events
- **Client portal** — read-only external project view for clients to check progress

---

*Last updated: 22 June 2026*
