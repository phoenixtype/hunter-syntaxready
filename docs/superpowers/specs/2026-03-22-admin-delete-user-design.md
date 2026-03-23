# Admin Delete User — Design Spec

**Date:** 2026-03-22
**Status:** Approved

## Summary

Allow root admins to permanently delete any user from the system via the admin panel. Reuses the existing `delete-account` edge function by adding an optional `target_user_id` parameter with root admin authorization.

## Changes

### 1. Edge Function: `delete-account/index.ts`

**Current behavior:** Authenticates the caller and deletes their own account.

**New behavior:** Accepts an optional `target_user_id` in the JSON request body.

- Parse JSON body to extract optional `target_user_id`
- Validate `target_user_id` is a valid UUID format if present (return 400 if malformed)
- If `target_user_id` is present and differs from the caller's ID:
  1. Use the service role client to query `platform_admins` for the caller's user ID
  2. Verify the caller has `role = 'root'` — if not, return 403
  3. Query `platform_admins` for the target user — if they are also a root admin, return 403 ("Cannot delete a root admin")
  4. Verify the target user exists via `admin.auth.admin.getUserById(target_user_id)` — if not found, return 404
  5. If the target user has an active Stripe subscription (check `subscriptions` table for `stripe_subscription_id`), cancel it via the Stripe API before deletion
  6. Insert audit log into `platform_logs` using the service role client: `{ actor_id: caller.id, action: 'admin_delete_user', entity_type: 'user', entity_id: target_user_id }`
  7. Set `uid = target_user_id` for the rest of the deletion flow (nullify, delete rows, delete auth user)
- If `target_user_id` is absent or matches the caller's ID → existing self-deletion behavior, unchanged

**Execution order:** Audit log insert and Stripe cancellation happen *before* user data deletion, while the target's `platform_admins` row still exists for verification.

### 2. Admin UI: `AdminUsers.tsx`

- Import `useAdmin` hook to check `adminRole === 'root'`; only show delete buttons for root admins
- Import `useAuth` hook to get the current user's ID for the "hide on own row" check
- Add a red `Trash2` icon button in each row's Actions column
- Hide the button on the current user's own row (compare `user.id` to row `u.id`)
- On click, show a confirmation dialog (simple `useState`-driven overlay with existing shadcn `Button` components):
  - Title: "Delete User"
  - Body: "Permanently delete **{name}** ({email})? This removes all their data and cannot be undone."
  - Cancel button + red "Delete" confirmation button
- On confirm:
  - Call `supabase.functions.invoke('delete-account', { body: { target_user_id: userId } })`
  - Show loading state (spinner on the button, disable interactions)
  - On success: toast "User deleted", remove user from local `users` state
  - On error: toast error message

### 3. Safety Guardrails

| Guard | Where | Behavior |
|-------|-------|----------|
| Root admin check | Edge function (server) | 403 if caller is not root admin |
| Cannot delete root admin | Edge function (server) | 403 if target is root admin |
| Cannot delete self | Admin UI (client) + Edge function (server) | Button hidden on own row; server falls through to self-deletion if `target_user_id === caller.id` |
| Target must exist | Edge function (server) | 404 if target user not found |
| UUID validation | Edge function (server) | 400 if `target_user_id` is not a valid UUID |
| Stripe cleanup | Edge function (server) | Cancel active Stripe subscription before deletion |
| Audit log | Edge function (server) | `platform_logs` entry on every admin deletion (uses `entity_type`/`entity_id` columns) |

### 4. Files Modified

| File | Change |
|------|--------|
| `supabase/functions/delete-account/index.ts` | Add `target_user_id` support, root admin check, UUID validation, Stripe cancel, audit log |
| `src/pages/admin/AdminUsers.tsx` | Add delete button, confirmation dialog, delete mutation |
| `docs/ADMIN_GUIDE.md` | Document the new user deletion capability |

### 5. No New Dependencies

- Confirmation dialog uses simple conditional rendering with existing shadcn `Button` components
- Stripe API called via `fetch` using existing `STRIPE_SECRET_KEY` env var (already available in edge functions)
- No new database migrations required
- No new edge functions required
