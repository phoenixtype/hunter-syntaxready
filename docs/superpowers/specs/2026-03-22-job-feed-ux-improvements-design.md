# Job Feed UX Improvements — Design Spec

**Date:** 2026-03-22
**Status:** Approved
**Scope:** Four targeted improvements to the job feed and app-wide UX

---

## 1. Filter Applied Jobs from the Feed

### Problem
`appliedJobIds` is already fetched from `application_history` in `JobFeed.tsx` but is only used to prevent double-application. Applied jobs remain visible in the feed.

### Solution
Add a single filter predicate to the `filteredJobs` `useMemo` in `JobFeed.tsx`, **and** add `appliedJobIds` to the dependency array so the memo recomputes when the async fetch completes:

```ts
// filter predicate (initial filter line)
let result = jobs.filter(job =>
  !dismissedJobIds.has(job.id) &&
  !appliedJobIds.has(job.id)   // ← new
);

// dependency array (line 155 currently)
}, [jobs, dismissedJobIds, appliedJobIds, filters, showSavedOnly, isSaved]);
//                          ↑ must be added
```

**Why the dep array matters:** `getApplicationHistory` runs asynchronously in a `useEffect` after mount. Without `appliedJobIds` in the array, the memo won't recompute when the set is populated and the feed will briefly display applied jobs on load.

**Edge case:** Jobs applied to via external URLs (no `job_id` stored in `application_history`) cannot be filtered since there is no stable ID to match. Only jobs applied through Hunter have a UUID `job_id`. Null `job_id` values in the set are ignored by `Set.has(uuid)` — no extra guard needed.

---

## 2. Scrollable Centered Modal for Job Descriptions

### Problem
Clicking a job currently toggles an inline expand/collapse (`expandedJob` state). Long descriptions require scrolling the whole page and lose context.

### State change
- Remove `expandedJob: string | null`
- Add `selectedJob: EnrichedJob | null` (null = modal closed)
- Replace `handleExpandJob` with `handleSelectJob(job: EnrichedJob | null)` which sets `selectedJob` **and** triggers stakeholder loading (see below)

### Stakeholder / Intel section
The current inline expand also loads and renders stakeholders via `findStakeholders`. This panel is **retained inside the modal** as a collapsible "Hiring Intel" section at the bottom of the scrollable body. The `stakeholders` record stays in `JobFeed` and is passed to `JobDescriptionModal` as a prop.

```ts
// handleSelectJob replaces handleExpandJob
const handleSelectJob = async (job: EnrichedJob | null) => {
  setSelectedJob(job);
  if (job && !stakeholders[job.id]) {
    const { findStakeholders } = await import("@/lib/recruiter_engine");
    const network = await findStakeholders(job);
    setStakeholders(prev => ({ ...prev, [job.id]: network }));
  }
};
```

### Modal layout (`Dialog`, max-w-2xl, max-h-[85vh])

```
┌─────────────────────────────────────────┐
│ Job Title                    [✕ close]  │
│ Company · Location · Salary badge       │
│ Match score chip · Posted date          │
├─────────────────────────────────────────┤
│                                         │  ← ScrollArea (flex-1)
│  Description (ReactMarkdown)            │
│  Tech stack chips                       │
│  DEI / EEO info (if present)           │
│  ── Hiring Intel (collapsible) ──       │
│    Stakeholder list or loading spinner  │
│                                         │
├─────────────────────────────────────────┤
│ [Apply]  [Tailor Resume]  [Save]  [⋯]  │  ← sticky footer
└─────────────────────────────────────────┘
```

**Trigger:** Clicking the job title or a "View Details" link on the card. Inline card action buttons (Apply, Dismiss, Save) continue working without opening the modal.

**Dismissal:** Escape key, clicking the backdrop, or the ✕ button.

**New file:** `src/components/JobDescriptionModal.tsx`

```ts
interface JobDescriptionModalProps {
  job: EnrichedJob | null;
  stakeholders: Stakeholder[] | undefined;
  appliedJobIds: Set<string>;
  onClose: () => void;
  onApply: (job: EnrichedJob) => void;
  onTailor: (job: EnrichedJob) => void;
  onSave: (job: EnrichedJob) => void;
}
```

---

## 3. Purge Expired Jobs (90 Days)

### Problem
No mechanism removes stale job listings. `job_listings` has no `expires_at` column; age is derived from `posted_at` (stored as `text`).

### FK behaviour note
`application_history.job_id` has `ON DELETE SET NULL` (not CASCADE). When `purge_old_jobs()` deletes a `job_listings` row, the matching `application_history.job_id` is set to `NULL`. This means:
- The Tracker entry for that job persists (good — users keep their application history)
- The `job_id` link is permanently lost (acceptable — the listing no longer exists)
- The applied-jobs filter in Section 1 is unaffected: `new Set(history.map(h => h.job_id))` will contain `null` for those rows, and `Set.has(uuid)` never matches `null`

### Solution — Two layers

**Layer A — Database:**
New migration `20260322000001_purge_expired_jobs.sql`:

```sql
CREATE OR REPLACE FUNCTION public.purge_old_jobs()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE deleted_count integer;
BEGIN
  -- Explicit cast to timestamptz required because posted_at is text.
  -- Without it, PostgreSQL's implicit cast would raise an exception on malformed
  -- date strings, aborting the entire DELETE with zero rows purged.
  DELETE FROM public.job_listings
  WHERE posted_at IS NOT NULL
    AND posted_at::timestamptz < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

SELECT cron.schedule(
  'purge-expired-jobs',
  '0 3 * * *',
  $$SELECT public.purge_old_jobs()$$
);
```

pg_cron is already installed (`20260114191248_remote_schema.sql` enables it).

**Layer B — Frontend guard:**
Add a 90-day age filter in `filteredJobs`, after the dismissed/applied filters, mirroring the `isNaN` guard already used by the existing `datePosted` filter:

```ts
// Purge expired jobs client-side (90 days)
result = result.filter(job => {
  if (!job.posted_at) return true; // keep if date unknown
  const postedTime = new Date(job.posted_at).getTime();
  if (isNaN(postedTime)) return true; // keep if date unparseable
  return Date.now() - postedTime < 90 * 24 * 60 * 60 * 1000;
});
```

---

## 4. Tooltips: Hover + Guided Tour

### Hover Tooltips

Use the existing `Tooltip` / `TooltipTrigger` / `TooltipContent` from `@/components/ui/tooltip` (Radix-based, already installed). No new library needed.

**Target elements:**
- All icon-only buttons (Refresh, Save, Filters, Bookmark, etc.)
- Sidebar nav items in the collapsed state (where text labels are hidden)
- Match score badge
- Pro lock badges
- Page-specific controls (Interview Coach topic selector, Resume Builder section actions, etc.)

### Guided Tour

**Library:** `react-joyride` (`npm i react-joyride`). Handles spotlight, positioning, and overlay. ~35 KB gzipped.

**Target strategy:** Each element targeted by a tour step gets a `data-tour="<key>"` attribute added at the call site. The `PageTour` step uses `target: '[data-tour="<key>"]'`. This keeps selectors stable and independent of CSS class changes. The "Files Changed" table accounts for all files that need `data-tour` attributes.

**`PageTour` component** (`src/components/PageTour.tsx`):
- Props: `steps: Step[]`, `tourKey: string`, `triggerRef: React.RefObject<{ start: () => void }>`
- On mount: checks `localStorage.getItem('hunter_tour_${tourKey}')` — if absent, auto-starts after 1 s delay
- On completion/skip: sets `localStorage.setItem('hunter_tour_${tourKey}', 'done')`
- Exposes `start()` via `triggerRef` so a caller button can re-trigger it

**"Take a tour" button:**
Rather than adding props to `PageHeader` (which would couple a generic component to a specific feature), each page that supports a tour passes a tour trigger button through `PageHeader`'s existing `actions` prop:

```tsx
const tourRef = useRef<{ start: () => void }>(null);
// ...
<PageHeader
  breadcrumbs={[...]}
  actions={
    <Button variant="ghost" size="icon" onClick={() => tourRef.current?.start()}
      title="Take a tour">
      <HelpCircle className="w-4 h-4" />
    </Button>
  }
/>
<PageTour tourKey="resume-builder" steps={resumeBuilderSteps} triggerRef={tourRef} />
```

### Tour steps per page

| Page | `tourKey` | Steps (label → `data-tour` target) |
|------|-----------|--------------------------------------|
| Dashboard › Jobs | `dashboard_jobs` | Search bar → `job-search`, Location → `job-location`, Find Jobs → `find-jobs-btn`, Filters → `job-filters`, Match score → `match-score`, Card actions → `job-card-actions` |
| Dashboard › Tracker | `dashboard_tracker` | Kanban overview → `tracker-board`, Drag cards → `tracker-card`, Add application → `add-application-btn`, Detail sheet → `application-detail` |
| Dashboard › Insights | `dashboard_insights` | Trend chart → `insights-chart`, Stage funnel → `insights-funnel`, Response rate → `insights-response-rate` |
| Resume Builder | `resume_builder` | Upload → `resume-upload`, Edit sections → `resume-sections`, Export → `resume-export` |
| Application Wizard | `application_wizard` | Step 1 → `wizard-step-1`, Step 2 → `wizard-step-2`, Review → `wizard-step-3` |
| Interview Coach | `interview_coach` | Topic picker → `coach-topics`, Start session → `coach-start`, Feedback panel → `coach-feedback` |
| Post-Interview | `post_interview` | Thank You tab → `thankyou-tab`, Negotiation tab → `negotiation-tab`, Leverage points → `leverage-btn` |
| Tailored Resumes | `tailored_resumes` | Resume list → `tailored-list`, Download → `tailored-download`, How it works → `tailored-info` |
| Settings | `settings` | Profile tab → `settings-profile`, Preferences tab → `settings-prefs`, Alerts tab → `settings-alerts` |

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/JobFeed.tsx` | Add applied-jobs filter + dep; replace expandedJob/handleExpandJob with selectedJob/handleSelectJob; open JobDescriptionModal |
| `src/components/JobDescriptionModal.tsx` | **New** — centered Dialog modal for job details + stakeholder panel |
| `src/components/PageTour.tsx` | **New** — reusable guided tour wrapper using react-joyride |
| `supabase/migrations/20260322000001_purge_expired_jobs.sql` | **New** — purge function + pg_cron schedule |
| `src/pages/Dashboard.tsx` | Add `data-tour` attrs to Jobs/Tracker elements; add PageTour instances |
| `src/pages/ResumeBuilder.tsx` | Add hover tooltips; add `data-tour` attrs; add PageTour |
| `src/pages/ApplicationWizard.tsx` | Add hover tooltips; add `data-tour` attrs; add PageTour |
| `src/pages/InterviewCoach.tsx` | Add hover tooltips; add `data-tour` attrs; add PageTour |
| `src/pages/PostInterview.tsx` | Add hover tooltips; add `data-tour` attrs; add PageTour |
| `src/pages/TailoredResumes.tsx` | Add hover tooltips; add `data-tour` attrs; add PageTour |
| `src/pages/Settings.tsx` | Add hover tooltips; add `data-tour` attrs; add PageTour |
| `src/components/AppSidebar.tsx` | Add hover Tooltips to collapsed nav items |
| `src/components/JobCardActions.tsx` | Add hover Tooltips to all icon buttons |
| `src/components/JobFiltersBar.tsx` | Add hover Tooltips to filter controls |
| `package.json` | Add `react-joyride` |

---

## Out of Scope
- `expires_at` column on `job_listings` (age-based purge is sufficient)
- Tour analytics (tracking which steps users skip)
- Tour localization
- Stakeholder panel redesign inside the modal (retain current rendering logic)
