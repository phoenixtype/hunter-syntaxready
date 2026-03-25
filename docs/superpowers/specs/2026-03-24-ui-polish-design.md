# UI Polish — Design Spec
**Date:** 2026-03-24
**Approach:** C — Full Consistency Pass (Typography + Depth + Motion)
**Constraint:** Keep existing blue (#1a73e8) primary colour. No layout changes. Subtle changes only.
**Scope:** All three portals — candidate, recruiter, admin.

---

## 1. Cards

**Problem:** Cards today have no shadow, flat border only. Numerals lack visual weight. Delta indicators (% changes) are plain text with no visual treatment.

**Changes:**
- Add one consistent shadow to all `<Card>` components: `shadow-card` (defined in section 6)
- Increase border-radius from `rounded-md` (10px) to `rounded-xl` (16px) on stat/data cards
- Stat numbers: bump to `font-weight: 800`, add `letter-spacing: -0.03em` for tight premium numerals
- Eyebrow labels (e.g. "Applications sent"): add `letter-spacing: 0.08em`, `font-weight: 600`
- Delta indicators (↑ 12%): wrap in a coloured `<span>` using `text-primary` (blue) for positive, `text-destructive` for negative
- Card hover: add `hover:shadow-md hover:-translate-y-px transition-all duration-150` — 1px lift, 150ms

**Scope:** All stat cards on candidate dashboard, recruiter dashboard, admin overview.

---

## 2. Sidebar Navigation

**Problem:** The three sidebars use inconsistent active state styles. `AppSidebar` and `RecruiterSidebar` use `bg-muted text-foreground`, while `AdminSidebar` uses `bg-primary/10 text-primary` — they are not aligned. Additionally `index.css` contains a dead `.nav-active::before` CSS rule that is not used by any sidebar (housekeeping removal).

**Changes:**
- Align all three sidebars to the same active state: `bg-primary/10 text-primary font-semibold rounded-lg`
- Update `AppSidebar.tsx` and `RecruiterSidebar.tsx`: `bg-muted text-foreground font-medium` → `bg-primary/10 text-primary font-semibold`
- Update `AdminSidebar.tsx`: `font-medium` → `font-semibold` (minor bump for consistency)
- Standardise all nav item padding to `px-3 py-2` across all three sidebars
- Inactive item hover: `hover:bg-muted hover:text-foreground transition-colors duration-150`
- Icon colour on active: `text-primary`. On inactive: `text-muted-foreground`
- Remove dead `.nav-active` and `.nav-active::before` rules from `index.css` (housekeeping — they are not applied anywhere)

---

## 3. Typography Hierarchy

**Problem:** No unified heading scale. Card titles hard-coded `text-2xl`, page titles vary between `text-lg` and `text-2xl`. `letter-spacing` rarely used.

**Risk note:** Global bare `h1/h2/h3` rules affect Radix UI component internals (DialogTitle, AlertDialogTitle, etc.). To avoid regressions, scope rules to a layout wrapper class.

**Changes — `src/index.css`:**
```css
/* Scoped to app content — does not affect Radix portals */
.app-content h1, .page-content h1 {
  font-size: 1.75rem; font-weight: 800; letter-spacing: -0.03em; line-height: 1.2;
}
.app-content h2, .page-content h2 {
  font-size: 1.375rem; font-weight: 700; letter-spacing: -0.02em; line-height: 1.25;
}
.app-content h3, .page-content h3 {
  font-size: 1.125rem; font-weight: 600; letter-spacing: -0.01em; line-height: 1.3;
}
```
- Add `app-content` class to the main content wrapper in `AppLayout.tsx`, `AdminLayout.tsx`, `RecruiterLayout.tsx`
- Page titles: add `tracking-tight` class where missing (survey on first implementation pass)
- Breadcrumb separators: change `/` to `›` (U+203A), style as `text-muted-foreground/50`
- Muted body text: standardise to `text-sm text-muted-foreground` everywhere

---

## 4. Loading States

**Problem:** Some pages still use bare full-page spinners or show no loading indicator at all.

**Existing work to preserve:**
- `Dashboard.tsx` already imports `<DashboardSkeleton />` from `src/components/DashboardSkeleton.tsx` — do not replace
- `src/components/ContextualSkeletons.tsx` already provides `JobFeedSkeleton`, `TrackerSkeleton` — reuse these
- `RecruiterDashboard.tsx` already uses inline `"—"` placeholder values during load — do not replace with skeleton (acceptable pattern)

**Remaining gaps to fix:**
- `AdminOverview.tsx`: uses inline `?? '—'` dash placeholders during load (similar to RecruiterDashboard). Unlike RecruiterDashboard, the admin portal is a key investor screen and deserves a proper skeleton to avoid the jarring flash of dashes → add a three-card `SkeletonCard` grid that matches the stat layout
- `AdminReferrals.tsx` line 148: uses `<Loader2>` centred full-page → replace with a two-column skeleton matching the referral stats layout

**New component — `src/components/ui/skeleton-card.tsx`:**
A single reusable card skeleton (one stat card shape) for use in admin pages:
```tsx
// Props: none. Renders one stat card placeholder.
// Uses: existing <Skeleton> from src/components/ui/skeleton.tsx (already exists)
```

**Shimmer animation:**
Add to `tailwind.config.ts` `keyframes` block:
```js
shimmer: {
  '0%': { backgroundPosition: '200% 0' },
  '100%': { backgroundPosition: '-200% 0' },
}
```
And to `animation` block:
```js
shimmer: 'shimmer 1.4s ease-in-out infinite',
```
The `<Skeleton>` base component from shadcn/ui already uses `animate-pulse`. Only use `animate-shimmer` in the new `SkeletonCard` — do not change the base `<Skeleton>` component.

---

## 5. Page Header Refinement

**Problem:** Breadcrumb separator is `/` (low contrast). Page title weight varies. Some pages have no subtitle.

**Changes:**
- Breadcrumb separator: `text-muted-foreground/40` `›` instead of `/`
- Page title: always `text-2xl font-bold tracking-tight`
- Subtitle: always `text-sm text-muted-foreground` directly below title (add where missing)
- `PageHeader` backdrop-blur already good — keep it

---

## 6. Shadow System Unification

**Problem:** App mixes `shadow-sm`, `shadow-lg`, and MD3 `shadow-md-1` tokens arbitrarily.

**New tokens — add to `tailwind.config.ts` `boxShadow` block:**
```js
'card':     '0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)',
'dropdown': '0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px -1px rgba(0,0,0,0.04)',
'modal':    '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.04)',
```
- Replace `shadow-sm` → `shadow-card` on cards and panels throughout all three portals
- Replace `shadow-lg` → `shadow-modal` on dialogs and sheets
- Keep MD3 `shadow-md-1` on the top navbar only (already correct)

---

## 7. Focus Ring Consistency

**Problem:** `[cmdk-input]` override in `index.css` disables focus rings for the command palette input.

**Changes:**
- Remove `outline: none !important` and `box-shadow: none !important` from the `[cmdk-input]` block in `index.css`
- Replace with `focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2` on the CommandPalette input element directly
- All other interactive elements already use the correct Tailwind ring pattern — no change needed

---

## 8. Micro-interactions

**Problem:** Most interactive elements have `transition-colors` only. No press feedback on buttons.

**Changes:**
- Primary `<Button>` in `src/components/ui/button.tsx`: add `active:scale-[0.98] transition-transform duration-75`
- Cards with `onClick` prop: add `cursor-pointer` + hover lift from section 1
- Table rows with actions: add `hover:bg-muted/50 transition-colors duration-100`

---

## 9. Empty States

**Problem:** Empty tables and lists show bare "No data" text strings.

**Existing component:** `src/components/EmptyState.tsx` already exists with `{ icon, title, description, action }` props. The icon container is currently `w-16 h-16` (64px) — reduce to `w-10 h-10` (40px) for a more minimal look.

**Changes:**
- Update `EmptyState.tsx`: reduce icon container to `w-10 h-10`, icon itself to `w-5 h-5`
- Apply `<EmptyState>` to: recruiter applicant list, admin user table, tailored resumes list, auto-applier job list (currently show nothing or bare text)
- Do NOT move the file — keep at `src/components/EmptyState.tsx`

---

## 10. Role Fit Spacing Fix (already done ✅)

`InsightsView.tsx` — added `gap-2` and `shrink-0` to prevent role name and % colliding.

---

## What is NOT changing
- Primary blue `#1a73e8` — untouched
- All layouts, grids, page structures
- Dark mode (all changes use CSS variables — dark mode compatible automatically)
- Any component logic, data fetching, or business behaviour
- Landing page (Index.tsx) — out of scope
- `DashboardSkeleton.tsx` and `ContextualSkeletons.tsx` — keep as-is, only extend

---

## Files Touched

| File | Change |
|------|--------|
| `src/index.css` | Scoped h1/h2/h3 scale, remove dead `.nav-active` CSS, remove cmdk focus override |
| `tailwind.config.ts` | Add `shadow-card`, `shadow-dropdown`, `shadow-modal`, add `shimmer` keyframe + animation |
| `src/components/ui/skeleton-card.tsx` | New — single stat card skeleton using existing `<Skeleton>` |
| `src/components/EmptyState.tsx` | Reduce icon size only |
| `src/layouts/AppLayout.tsx` | Add `app-content` class to main wrapper |
| `src/layouts/AdminLayout.tsx` | Add `app-content` class to main wrapper |
| `src/layouts/RecruiterLayout.tsx` | Add `app-content` class to main wrapper |
| `src/components/AppSidebar.tsx` | Align active state to `bg-primary/10 text-primary`, standardise padding |
| `src/components/recruiter/RecruiterSidebar.tsx` | Align active state, standardise padding |
| `src/components/ui/card.tsx` | Add `shadow-card` default, hover lift variant |
| `src/components/ui/button.tsx` | Add `active:scale-[0.98]` |
| `src/components/DashboardWelcome.tsx` | Stat card polish (bold numerals, letter-spacing, delta badges) |
| `src/pages/Dashboard.tsx` | Stat card polish (existing skeleton already in place) |
| `src/pages/admin/AdminOverview.tsx` | Add loading skeleton (currently uses `?? '—'` dash placeholders) |
| `src/pages/admin/AdminReferrals.tsx` | Replace full-page spinner with skeleton |
| `src/pages/TailoredResumes.tsx` | Add `<EmptyState>` for empty list |
| `src/pages/recruiter/JobApplicants.tsx` | Add `<EmptyState>` for empty applicant list |
| `src/pages/admin/AdminUsers.tsx` | Add `<EmptyState>` for empty user table |
| `src/components/InsightsView.tsx` | Role fit spacing ✅ done |
