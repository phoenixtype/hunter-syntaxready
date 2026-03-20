# Admin Guide Maintenance

**Always keep `docs/ADMIN_GUIDE.md` current.**

When you add, remove, or modify any admin-facing feature, you must:

1. Update the relevant section(s) in `docs/ADMIN_GUIDE.md` to reflect the change.
2. Update the "Last updated" date at the top of the file.
3. Append a row to the Changelog table at the bottom of the file.

Admin-facing features include (but are not limited to):
- Admin pages (`src/pages/admin/*`)
- Admin sidebar navigation (`src/components/admin/AdminSidebar.tsx`)
- Admin routes in `App.tsx`
- `approve-recruiter` edge function and any future admin edge functions
- `platform_admins`, `recruiter_applications`, `platform_logs` tables or their RLS policies
- Any new email notifications triggered by admin actions
- Changes to admin roles or permissions model

Do not defer this update — make it in the same commit as the feature change.