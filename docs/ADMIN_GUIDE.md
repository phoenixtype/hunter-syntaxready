# Hunter — Platform Admin Guide

> **Audience:** Platform administrators with a `root` or `admin` role in the `platform_admins` table.
> **Last updated:** 2026-03-19
> **Update policy:** Update this document whenever an admin-facing feature is added, removed, or changed. Keep the changelog at the bottom current.

---

## Table of Contents

1. [Access & Authentication](#1-access--authentication)
2. [Admin Interface Overview](#2-admin-interface-overview)
3. [Dashboard — Overview](#3-dashboard--overview)
4. [Recruiter Applications](#4-recruiter-applications)
5. [User Management](#5-user-management)
6. [Audit Logs](#6-audit-logs)
7. [Analytics](#7-analytics)
8. [Admin Roles & Permissions](#8-admin-roles--permissions)
9. [Database Tables Reference](#9-database-tables-reference)
10. [Edge Functions Reference](#10-edge-functions-reference)
11. [Email Notifications](#11-email-notifications)
12. [Seeding & Managing Admins](#12-seeding--managing-admins)
13. [Security Model](#13-security-model)
14. [Troubleshooting](#14-troubleshooting)
15. [Changelog](#15-changelog)

---

## 1. Access & Authentication

### How to access the admin panel

Navigate to `/admin` while logged in with an admin account. If your account is not registered in the `platform_admins` table you will be silently redirected to `/dashboard`.

### Admin account setup

Admin accounts are not self-serve. They must be seeded directly in the database:

```sql
-- Run in Supabase SQL Editor or via migration
INSERT INTO public.platform_admins (user_id, role)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'your-email@example.com'),
  'admin' -- or 'root'
);
```

The initial root admin (`samuelakuma130@gmail.com`) was seeded via migration `20260317100000_admin_and_recruiter_applications.sql`.

### Auth flow

1. Log in at `/login` with your admin email and password.
2. Navigate to `/admin` — `RequireAdmin` checks the `platform_admins` table.
3. If your `user_id` is found: admin panel loads.
4. If not found or query fails: you are redirected to `/dashboard` (no error shown — this is intentional to avoid disclosing the admin panel's existence).

### Session security

- Admin status is re-checked on every admin-page mount via `useAdmin()`.
- Edge function actions (approve, reject) independently verify admin role server-side — the client check is UI-only.
- Admin privileges **do not** bypass Supabase Auth. You must have a valid session JWT.

---

## 2. Admin Interface Overview

The admin panel uses a dedicated layout (`AdminLayout`) with a persistent left sidebar (`AdminSidebar`). The footer is hidden in admin views.

### Sidebar navigation

| Label | Route | Description |
|---|---|---|
| Overview | `/admin` | Platform stats dashboard |
| Recruiter Applications | `/admin/recruiter-applications` | Approve or reject recruiter sign-up requests |
| Users | `/admin/users` | Browse all registered platform users |
| Audit Logs | `/admin/logs` | Immutable log of all admin actions |

**Sign out** is in the sidebar footer. Clicking it calls `supabase.auth.signOut()` and redirects to `/`.

### Analytics

Platform analytics are at `/admin/analytics` and are fully protected by `RequireAdmin` — the same guard as all other admin routes. The page renders inside the admin sidebar layout.

---

## 3. Dashboard — Overview

**Route:** `/admin`

Displays four live stat cards pulled from the database on mount:

| Card | Source |
|---|---|
| Total Users | `COUNT(*) FROM profiles` |
| Pending Applications | `COUNT(*) FROM recruiter_applications WHERE status = 'pending'` |
| Approved Recruiters | `COUNT(*) FROM recruiter_applications WHERE status = 'approved'` |
| Total Applications | `COUNT(*) FROM recruiter_applications` |

Stats do not auto-refresh. Reload the page to see updated numbers.

If any database call fails, an error state is rendered instead of false "0" counts.

---

## 4. Recruiter Applications

**Route:** `/admin/recruiter-applications`

This is the primary admin workflow. Companies apply to become recruiters on Hunter through the public `/recruiter-portal` form. Those applications land here for review.

### What an application contains

| Field | Description |
|---|---|
| Full Name | Contact person's name |
| Email | Where approval/rejection emails will be sent |
| Company | Company legal name |
| Company Website | Optional |
| Job Title | Applicant's role at the company |
| Company Size | One of: 1–10, 11–50, 51–200, 201–500, 501–1000, 1000+ |
| Use Case | Optional free-text field (how they plan to use Hunter) |
| Applied At | Timestamp |

### Filter tabs

- **All** — every application regardless of status
- **Pending** — awaiting review (default starting view)
- **Approved** — already approved
- **Rejected** — already rejected (may include rejection reason)

### Approving a recruiter

1. Find the application under the **Pending** tab.
2. Click **Approve**.
3. The button disables and shows a spinner while the `approve-recruiter` edge function runs.
4. On success:
   - Application status → `approved`
   - If the applicant already has a Hunter account, their profile `role` → `recruiter`
   - A **magic link email** is sent to the applicant's email with a link to `/recruiter-setup` to set their password and activate their account
   - The action is logged to `platform_logs`
5. The application card updates in-place with an **Approved** badge.

> **Note:** The magic link expires after 72 hours. If the recruiter misses it, you will need to manually trigger a new magic link via the Supabase Dashboard → Authentication → Users.

### Rejecting a recruiter

1. Find the application under the **Pending** tab.
2. Click **Reject**.
3. A modal opens with an optional **Rejection Reason** textarea.
4. Click **Confirm Rejection**.
5. On success:
   - Application status → `rejected`
   - The rejection reason (if provided) is stored and displayed on the card
   - A **rejection email** is sent to the applicant explaining the decision (reason is included if provided)
   - The action is logged to `platform_logs`

### Re-reviewing

Once an application is approved or rejected it **cannot be reversed via the UI**. To undo an action, update the `recruiter_applications` row directly in the Supabase database:

```sql
UPDATE public.recruiter_applications
SET status = 'pending', reviewed_by = NULL, reviewed_at = NULL, rejection_reason = NULL
WHERE id = '<application-uuid>';
```

---

## 5. User Management

**Route:** `/admin/users`

Displays the 100 most recently registered users on the platform.

### Columns shown

| Column | Source |
|---|---|
| Name | `profiles.full_name` |
| Email | `auth.users.email` (joined via `profiles`) |
| Role | `profiles.role` (candidate / recruiter / admin) |
| Joined | `profiles.created_at` formatted as locale date |

### What you can do here

Currently **read-only**. This page is for lookup and verification (e.g. confirm a recruiter's role was set correctly after approval).

### Changing a user's role manually

To change a user's role (e.g. if the auto-role-update on approval failed):

```sql
UPDATE public.profiles
SET role = 'recruiter'
WHERE id = '<user-uuid>';
```

Or via Supabase Dashboard → Table Editor → `profiles`.

### Deleting a user

User deletion is not available via the admin UI. To remove a user:

1. Supabase Dashboard → Authentication → Users → find user → Delete.
2. The `profiles` row will cascade-delete automatically (foreign key with `ON DELETE CASCADE`).

---

## 6. Audit Logs

**Route:** `/admin/logs`

Displays the most recent **200** entries from the `platform_logs` table — an append-only audit trail of significant platform events.

### Columns shown

| Column | Description |
|---|---|
| Action | What happened (`recruiter_approved`, `recruiter_rejected`, etc.) |
| Entity Type | What kind of record was affected (`recruiter_application`) |
| Metadata | Dynamic key-value pairs (email, company, reason, etc.) |
| Timestamp | ISO timestamp converted to local date/time |

### Currently logged events

| Action | Triggered by | Metadata keys |
|---|---|---|
| `recruiter_approved` | Admin approving recruiter application | `email`, `company` |
| `recruiter_rejected` | Admin rejecting recruiter application | `email`, `company`, `reason` (if provided) |

### Searching and filtering

There is no search or filter UI on this page currently. For advanced querying, use the Supabase SQL Editor:

```sql
-- All actions by a specific admin
SELECT * FROM platform_logs
WHERE actor_id = '<admin-user-uuid>'
ORDER BY created_at DESC;

-- All rejections with reasons
SELECT metadata->>'email', metadata->>'reason', created_at
FROM platform_logs
WHERE action = 'recruiter_rejected'
ORDER BY created_at DESC;

-- Actions in the last 7 days
SELECT * FROM platform_logs
WHERE created_at > now() - interval '7 days'
ORDER BY created_at DESC;
```

Logs are **insert-only** — admins cannot modify or delete them via the UI or normal RLS policies.

---

## 7. Analytics

**Route:** `/admin/analytics`

Accessible from the admin sidebar. Protected by `RequireAdmin`; non-admin users who navigate here are redirected to `/dashboard`.

### KPI Cards

| Metric | Source |
|---|---|
| Total Users | `get_platform_analytics()` RPC → `total_users` |
| Total Applications | `get_platform_analytics()` RPC → `total_applications` |
| Total Resumes | `get_platform_analytics()` RPC → `total_resumes` |
| Total Jobs Indexed | `get_platform_analytics()` RPC → `total_jobs` |

### Chart tabs

**Growth** — Line chart of platform activity over time (sourced from `agent_activity_logs`).

**Applications** — Bar chart showing application volume by status (applied, screening, interview, offer, accepted, rejected, withdrawn).

**Features** — Pie chart of feature usage broken down by `agent` field in `agent_activity_logs` (e.g. resume-builder, interview-coach, auto-applier).

### Business Metrics section

Currently displays placeholder values for business KPIs:

- **Acquisition:** MAU, DAU, DAU/MAU ratio, session duration, 30-day retention
- **Revenue:** MRR, ARR, ARPU, CAC, LTV

These will be wired to real data in a future update.

---

## 8. Admin Roles & Permissions

There are two admin roles, both stored in the `platform_admins.role` column.

### `root`

The highest privilege level. Root admins can:

- Access all admin pages
- Approve and reject recruiter applications
- View all users, audit logs, analytics
- Insert new rows into `platform_admins` (promote other users to admin)
- Delete rows from `platform_admins` (revoke admin access)

### `admin`

Standard admin. Admins can:

- Access all admin pages
- Approve and reject recruiter applications
- View all users, audit logs, analytics
- **Cannot** manage `platform_admins` table (insert/delete blocked by RLS)

### Non-admin users

Cannot access `/admin/*` routes. Attempting to do so redirects to `/dashboard`. RLS policies on all admin tables block non-admin reads.

---

## 9. Database Tables Reference

### `public.platform_admins`

```
id          uuid  PRIMARY KEY
user_id     uuid  UNIQUE  REFERENCES auth.users(id)
role        text  CHECK (role IN ('root', 'admin'))
notes       text
created_at  timestamptz  DEFAULT now()
created_by  uuid  REFERENCES auth.users(id)
```

**RLS:** SELECT/INSERT/DELETE: only root admins. Regular admins can SELECT only.

---

### `public.recruiter_applications`

```
id                uuid  PRIMARY KEY
full_name         text  NOT NULL
email             text  NOT NULL
company_name      text  NOT NULL
company_website   text
job_title         text  NOT NULL
company_size      text  CHECK (1-10|11-50|51-200|201-500|501-1000|1000+)
use_case          text
status            text  DEFAULT 'pending'  CHECK (pending|approved|rejected)
reviewed_by       uuid  REFERENCES auth.users(id)
reviewed_at       timestamptz
rejection_reason  text
user_id           uuid  REFERENCES auth.users(id)  -- set if applicant already has account
created_at        timestamptz  DEFAULT now()
updated_at        timestamptz  DEFAULT now()  -- auto-updated via trigger
```

**RLS:** INSERT: public. SELECT: own record OR platform admin. UPDATE: platform admin only.

---

### `public.platform_logs`

```
id           uuid  PRIMARY KEY
actor_id     uuid  REFERENCES auth.users(id)
action       text
entity_type  text
entity_id    uuid
metadata     jsonb  DEFAULT '{}'
created_at   timestamptz  DEFAULT now()
```

**RLS:** SELECT: platform admins only. INSERT: platform admins OR service role (edge functions).

---

### `public.profiles` (admin-relevant columns)

```
id          uuid  PRIMARY KEY  REFERENCES auth.users(id)
full_name   text
avatar_url  text
role        text  DEFAULT 'candidate'  CHECK (candidate|recruiter|admin)
created_at  timestamptz
```

**Admin policy:** Platform admins can SELECT all profiles (not just their own).

---

### `public.recruiter_jobs`

```
id              uuid
recruiter_id    uuid
title           text
company         text
status          text  (draft|active|paused|closed)
max_applicants  integer  -- optional cap; NULL = no cap
...
```

Admins can view all recruiter jobs via the service role. No dedicated admin UI yet — use Supabase Table Editor for direct inspection.

---

### Helper SQL Functions

| Function | Returns | Description |
|---|---|---|
| `is_platform_admin()` | `boolean` | True if current user is in `platform_admins` |
| `is_root_admin()` | `boolean` | True if current user is in `platform_admins` with role='root' |
| `get_platform_analytics()` | `jsonb` | Aggregated platform stats (user count, applications, resumes, jobs) |

---

## 10. Edge Functions Reference

### `approve-recruiter`

**Purpose:** Approve or reject a recruiter application. Handles email dispatch, magic link generation, role update, and audit logging.

**Auth:** Requires Bearer JWT. Must belong to a platform admin.

**Endpoint:** `POST /functions/v1/approve-recruiter`

**Request body:**

```json
{
  "applicationId": "uuid",
  "action": "approve" | "reject",
  "rejectionReason": "optional string (reject only)"
}
```

**Response (success):**

```json
{ "success": true, "action": "approved" | "rejected" }
```

**Error responses:**

| Status | Reason |
|---|---|
| 401 | Missing or invalid JWT |
| 403 | Authenticated but not a platform admin |
| 404 | Application not found |
| 409 | Application already reviewed (not pending) |
| 500 | Internal error (Resend, Supabase, etc.) |

**Approve flow:**
1. Fetch application by `applicationId`, verify `status = 'pending'`
2. Generate Supabase magic link (`auth.admin.generateLink`) pointing to `/recruiter-setup`
3. Send `recruiterApprovedEmail` via Resend
4. Update application: `status='approved'`, `reviewed_by`, `reviewed_at`
5. If user already has a profile, update `profiles.role = 'recruiter'`
6. Insert into `platform_logs`

**Reject flow:**
1. Fetch application, verify `status = 'pending'`
2. Send `recruiterRejectedEmail` via Resend (with optional reason)
3. Update application: `status='rejected'`, `reviewed_by`, `reviewed_at`, `rejection_reason`
4. Insert into `platform_logs`

---

### `match-and-apply`

Not directly an admin function, but admins should know what it does: when a recruiter publishes a job, this function fires, scores all opted-in candidates against the job, and auto-inserts the top N applications (respecting `max_applicants` cap). Admins can inspect results in `recruiter_job_applications`.

---

### `search-candidates`

Allows approved recruiters to search opted-in candidate profiles. Candidates must have `user_preferences.auto_apply_enabled = true` to appear. Candidate emails are never returned — only used server-side during outreach.

---

### `recruiter-outreach`

Sends recruiter emails to specific candidates. Validates candidate opt-in, fetches email via `auth.admin.getUserById` (service role), sends via Resend, and records the outreach in `recruiter_outreach`.

---

## 11. Email Notifications

All emails are sent via **Resend** using the shared client in `supabase/functions/_shared/resend.ts`. The sender is configured in the `RESEND_API_KEY` environment secret.

### Emails triggered by admin actions

| Trigger | Template | Recipient |
|---|---|---|
| Recruiter approved | `recruiterApprovedEmail` | Applicant's email with magic link |
| Recruiter rejected | `recruiterRejectedEmail` | Applicant's email with optional reason |

### Email templates

**Approved email:**
- Green checkmark header
- Body: "Your application has been approved"
- CTA button: "Set up your recruiter account" → links to `/recruiter-setup` magic link
- 72-hour link expiry notice

**Rejected email:**
- Neutral tone header
- Body: "We've reviewed your application"
- If rejection reason provided: red-bordered block with the reason
- Encouragement to reapply in the future

### If an email fails to send

The edge function logs a warning but **still updates the application status**. The recruiter will not receive their email but the admin UI will show the updated status. To re-send:

1. Note the recruiter's email from the application card.
2. In Supabase Dashboard → Authentication → Users, use "Send magic link" for that email.
3. Or reset their status to `pending` and re-approve via the UI.

---

## 12. Seeding & Managing Admins

### Add a new admin

```sql
-- Add as regular admin
INSERT INTO public.platform_admins (user_id, role, created_by)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'newadmin@example.com'),
  'admin',
  (SELECT id FROM auth.users WHERE email = 'yourroot@example.com')
);
```

Run this in **Supabase Dashboard → SQL Editor**. Only root admins can insert into `platform_admins` via RLS.

### Promote existing admin to root

```sql
UPDATE public.platform_admins
SET role = 'root'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'admin@example.com');
```

### Revoke admin access

```sql
DELETE FROM public.platform_admins
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'former-admin@example.com');
```

After deletion, the next page load for that user will redirect them to `/dashboard`.

### View all current admins

```sql
SELECT pa.role, pa.notes, pa.created_at, u.email
FROM public.platform_admins pa
JOIN auth.users u ON u.id = pa.user_id
ORDER BY pa.created_at;
```

---

## 13. Security Model

### Defence-in-depth layers

1. **Frontend route guard** (`RequireAdmin`) — queries `platform_admins` on mount, redirects if not found. UI-only, can be bypassed.
2. **Row Level Security** — Supabase RLS policies block direct table access for non-admins even with valid JWTs.
3. **Edge function auth** — every admin action (approve, reject) re-verifies admin role server-side using the service role key. The client's role claim is not trusted.
4. **SECURITY DEFINER functions** — `is_platform_admin()` and `is_root_admin()` run with elevated permissions to check admin status, preventing privilege escalation via RLS bypass.

### What a compromised non-admin JWT cannot do

- Read `platform_admins`, `platform_logs` (blocked by RLS)
- Call `approve-recruiter` successfully (blocked by edge function server-side check)
- Update `recruiter_applications` (blocked by RLS)

### What to do if an admin account is compromised

1. Supabase Dashboard → Authentication → Users → find the account → Revoke tokens (or delete the user).
2. `DELETE FROM public.platform_admins WHERE user_id = '<compromised-uuid>';`
3. Review `platform_logs` for any actions taken by that account.

---

## 14. Troubleshooting

### "Redirected to /dashboard when accessing /admin"

- Confirm your account email is in `platform_admins` (check via Supabase SQL Editor).
- Confirm your Supabase session is valid — sign out and back in.
- Check browser console for auth errors.

### "Application stuck in Pending after clicking Approve/Reject"

- Open browser DevTools → Network tab → look for the edge function call.
- A 409 means the application was already reviewed (refresh the page).
- A 403 means your session lost admin privileges (sign out and back in).
- A 500 means an internal error — check Supabase Function logs in the Dashboard.

### "Recruiter didn't receive the approval email"

- Check Resend dashboard for the email send attempt.
- Check that the `RESEND_API_KEY` secret is set on the Supabase project.
- The application will still show `approved` status even if email failed.
- Manually generate a new magic link: Supabase Dashboard → Auth → Users → find user → "Send magic link".

### "Magic link expired before recruiter clicked it"

Magic links generated by `auth.admin.generateLink` expire after the OTP lifetime configured in your Supabase project (default: 1 hour for magic links, 72 hours shown in the email is an estimate — check your Auth settings). To re-issue:

1. Reset the application to `pending` via SQL.
2. Re-approve via the admin UI.

### "Audit logs page is empty"

- Confirm you are logged in as an admin — RLS blocks non-admin reads.
- Check `platform_logs` directly in Supabase Table Editor.
- Logs are only written by the `approve-recruiter` edge function currently. If no approvals/rejections have occurred, the table will be empty.

---

## 15. Changelog

Track significant changes to admin functionality here.

| Date | Version | Change | Author |
|---|---|---|---|
| 2026-03-17 | 1.0 | Initial admin panel: Overview, Recruiter Applications (approve/reject), Users, Audit Logs | System |
| 2026-03-17 | 1.1 | Added Platform Analytics page at `/admin/analytics` with KPI cards and charts | System |
| 2026-03-17 | 1.2 | Recruiter portal: applicant cap (`max_applicants`), ranked shortlist UI in JobApplicants | System |
| 2026-03-17 | 1.3 | Interview coach: web research mode (Reddit/Glassdoor crawl for likely questions) | System |
| 2026-03-18 | 1.4 | Fixed `/admin/analytics` route to use `AdminPage` wrapper (was `AppPage` — non-admins could access). Page now renders inside admin sidebar layout. | System |
| 2026-03-19 | 1.5 | **CRITICAL:** Fixed database integration issues for subscription feature usage functions. Updated `record_feature_usage` and `check_feature_usage_limit` function signatures to match frontend expectations exactly (parameter names: `p_usage_count` vs `p_count`, added `p_metadata` parameter). | System |

---

> **Maintainer note:** When you add or modify admin features, update the relevant section above and append a row to the Changelog. Keep the "Last updated" date at the top current. The goal is that any new admin can read this document and operate the platform without needing to read source code.
