# Admin Delete User — Design Spec

**Date:** 2026-03-22
**Status:** Approved

## Summary

Allow root admins to permanently delete any user from the system via the admin panel. Reuses the existing `delete-account` edge function by adding an optional `target_user_id` parameter with root admin authorization.

## Changes

### 1. Edge Function: `delete-account/index.ts`

**Current behavior:** Authenticates the caller and deletes their own account.

**New behavior:** Accepts an optional `target_user_id` in the JSON request body.

- If `target_user_id` is present and differs from the caller's ID:
  - Use the service role client to query `platform_admins` for the caller's user ID
  - Verify the caller has `role = 'root'` — if not, return 403
  - Query `platform_admins` for the target user — if they are also a root admin, return 403 ("Cannot delete a root admin")
  - Set `uid = target_user_id` for the rest of the deletion flow (nullify, delete rows, delete auth user)
  - Insert audit log into `platform_logs`: `{ actor_id: caller.id, action: 'admin_delete_user', target_id: target_user_id }`
- If `target_user_id` is absent or matches the caller's ID → existing self-deletion behavior, unchanged

### 2. Admin UI: `AdminUsers.tsx`

- Import `useAdmin` hook; only show delete button when `adminRole === 'root'`
- Add a red `Trash2` icon button in each row's Actions column
- Hide/disable the button on the current user's own row
- On click, show a confirmation dialog:
  - Title: "Delete User"
  - Body: "Permanently delete **{name}** ({email})? This removes all their data and cannot be undone."
  - Cancel button + red "Delete" confirmation button
- On confirm:
  - Call `supabase.functions.invoke('delete-account', { body: { target_user_id: userId } })`
  - Show loading state (spinner on the button, disable interactions)
  - On success: toast "User deleted", remove user from local `users` state
  - On error: toast error message
- Use a simple `useState`-based dialog (no new dependencies needed)

### 3. Safety Guardrails

| Guard | Where | Behavior |
|-------|-------|----------|
| Root admin check | Edge function (server) | 403 if caller is not root admin |
| Cannot delete root admin | Edge function (server) | 403 if target is root admin |
| Cannot delete self | Admin UI (client) | Button hidden on own row |
| Audit log | Edge function (server) | `platform_logs` entry on every admin deletion |

### 4. Files Modified

| File | Change |
|------|--------|
| `supabase/functions/delete-account/index.ts` | Add `target_user_id` support, root admin check, audit log |
| `src/pages/admin/AdminUsers.tsx` | Add delete button, confirmation dialog, delete mutation |

### 5. No New Dependencies

- Confirmation dialog uses native HTML `dialog` element or simple conditional rendering with existing shadcn `Button` components
- No new database migrations required
- No new edge functions required
