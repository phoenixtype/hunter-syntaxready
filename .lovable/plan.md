

# Hunter App -- Expert Recruitment & UX Audit

After a thorough review of the landing page, dashboard, job feed, application tracker, profile panel, notifications, tools grid, and interview coach, here are concrete, prioritized improvements grouped by impact.

---

## 1. Landing Page

**Problem**: The hero is clean but generic. There is no social proof with real numbers, no product screenshot/demo, and the stats ("Real-time", "Seconds", "3 modes") feel vague rather than compelling. The testimonials use obviously fake names with no photos or company logos.

**Recommendations**:
- Replace vague stats with concrete numbers: "1,200+ jobs crawled daily", "45s average tailor time", "3 interview modes". Even if early-stage, show database count dynamically.
- Add a product screenshot or short animated GIF/video below the hero showing the dashboard in action. This is the single highest-impact conversion lever missing.
- Add a "How is this different?" comparison section (Hunter vs. manually applying vs. other tools) as a simple 3-column table.
- Testimonials need real headshots (even AI-generated diverse avatars) and company context. Three 5-star reviews with single-initial avatars looks fabricated.

---

## 2. Job Feed (Core Loop)

**Problem**: The job cards are dense and action-heavy. Four buttons per card (Apply, Tailor, Prep, Intel) creates decision paralysis. The "Find Jobs" button placement is not prominent enough for the primary action. No saved/bookmarked jobs feature.

**Recommendations**:
- **Simplify card actions**: Make "Apply Now" the only primary button. Move Tailor, Prep, and Intel into a "More actions" dropdown or reveal them on card expansion/hover.
- **Add a save/bookmark button** (heart or bookmark icon) so users can shortlist jobs without applying. This is a fundamental recruitment UX pattern that is missing entirely.
- **Promote "Find Jobs"**: If the feed is empty or stale, show a prominent empty-state CTA instead of a small outline button in the toolbar.
- **Add salary normalization**: Many cards show no salary. Show "Salary not listed" explicitly rather than just omitting it, so users know it is not a bug.
- **Match score tooltip**: Hovering/tapping the match % badge should show a breakdown (skill: 80%, location: 90%, experience: 70%) so users trust the score.

---

## 3. Application Tracker

**Problem**: The Kanban board has no drag-and-drop, making it feel static. The status dropdown on each card is functional but not intuitive for a "board" metaphor. List view pagination is fine but the two views feel disconnected.

**Recommendations**:
- **Add drag-and-drop** between Kanban columns (react-beautiful-dnd or dnd-kit). This is the expected interaction for any board view. Without it, the board is just a grouped list.
- **Add application detail expansion**: Clicking a card should open a slide-over panel with full details, notes history, timeline of status changes, and a link back to the original job.
- **Add bulk actions**: Select multiple applications to archive, export, or change status.
- **Show a pipeline summary bar** at the top: "2 Applied → 1 Interview → 0 Offers" as a visual funnel.

---

## 4. Profile Panel

**Problem**: The profile strength score is a good concept but the "Edit Profile" button navigates to `/profile` which is a separate page. The profile panel itself is read-only with no inline editing capability.

**Recommendations**:
- Allow inline editing of key fields (name, email, summary) directly in the panel without navigating away.
- Add a "Download Resume" button directly on the profile panel since users frequently need their latest resume.
- The strength score tips are good but should be actionable -- each tip should be a clickable link that navigates to the relevant section of the resume builder.

---

## 5. Navigation & Information Architecture

**Problem**: The sidebar has 6 views (Jobs, Tracker, Tools, Alerts, Profile, Preferences) but "Tools" is a catch-all grid of 7 items. The mobile bottom tab bar only shows 4 items, making Profile and Preferences inaccessible from the tab bar.

**Recommendations**:
- **Mobile**: Add a 5th "More" tab that reveals Profile, Preferences, and Sign Out in a bottom sheet. Currently these are only accessible via the hamburger menu which breaks discoverability.
- **Merge Preferences into Profile** as a tabbed sub-view (Profile | Job Preferences). Two separate sidebar items for closely related settings adds cognitive load.
- **Tools page**: Group tools into categories (e.g., "Apply" tools vs. "Prepare" tools) and add usage counts or "last used" timestamps to help users find what they need.

---

## 6. Visual & Interaction Polish

**Problem**: The app is visually competent but lacks the micro-interactions that make premium tools feel alive.

**Recommendations**:
- **Empty states**: Every empty state should have an illustration or icon + a single clear CTA. The tracker empty state is good; replicate this pattern everywhere.
- **Loading states**: Replace the global skeleton with contextual skeletons per widget so partial content can render while slow sections load.
- **Transitions**: Add `layoutId` animations when switching between board/list view so cards visually morph rather than hard-cut.
- **Dark mode contrast**: Verify that all border-primary/20 and bg-primary/5 tokens are visible in dark mode. Several low-opacity overlays can become invisible on dark backgrounds.

---

## 7. Missing Table-Stakes Features

These are features that any serious job search tool must have:

| Feature | Status | Impact |
|---------|--------|--------|
| Saved/bookmarked jobs | Missing | High |
| Job application deadline tracking | Missing | Medium |
| Email notifications actually sending | UI exists, no backend | High |
| Salary comparison / market data | Missing | Medium |
| Resume version history | Missing | Medium |
| Duplicate job detection | Missing | Low |
| Application analytics (apply rate, response rate) | Missing | High |

---

## 8. Performance & Technical

- **Job feed re-renders**: The `JobFeed` and `ApplicationsView` are always-mounted via `hidden` class. This is good for state preservation but means both run their effects on every dashboard mount. Consider lazy-initializing the data fetch only when the tab is first visited.
- **Command palette**: Already implemented with recent/frequent -- solid. Add fuzzy search matching for better discoverability.

---

## Summary of Top 5 Highest-Impact Changes

1. Add a save/bookmark jobs feature (fundamental UX gap)
2. Add drag-and-drop to the Kanban tracker board
3. Simplify job card actions (single primary CTA + overflow menu)
4. Add a product screenshot/demo to the landing page hero
5. Add match score breakdown tooltip on hover

