-- COMPLETE SETUP SCRIPT
-- Run this to fix "Bucket not found" and "Foreign Key" errors.

BEGIN;

-- 1. SETUP STORAGE BUCKET ('resumes')
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', true)
on conflict (id) do nothing;

-- Storage Policies (Idempotent: drop first to ensure clean state)
drop policy if exists "Authenticated users can upload resumes" on storage.objects;
drop policy if exists "Authenticated users can read their own resumes" on storage.objects;
drop policy if exists "Authenticated users can update their own resumes" on storage.objects;
drop policy if exists "Authenticated users can delete their own resumes" on storage.objects;

create policy "Authenticated users can upload resumes"
on storage.objects for insert to authenticated
with check ( bucket_id = 'resumes' and auth.uid() = owner );

create policy "Authenticated users can read their own resumes"
on storage.objects for select to authenticated
using ( bucket_id = 'resumes' and auth.uid() = owner );

-- 2. ENSURE PUBLIC.USERS EXISTS (Fixes FK errors)
create table if not exists public.users (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  created_at timestamp with time zone default now()
);

-- 3. BACKFILL PUBLIC.USERS
insert into public.users (id, email, created_at)
select id, email, created_at from auth.users
on conflict (id) do nothing;

-- 4. FIX FOREIGN KEY CONSTRAINT (Make user_preferences robust)
ALTER TABLE public.user_preferences 
DROP CONSTRAINT IF EXISTS user_preferences_user_id_fkey;

ALTER TABLE public.user_preferences
ADD CONSTRAINT user_preferences_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- 5. SETUP TRIGGER FOR FUTURE USERS
create or replace function public.handle_new_user_mirror()
returns trigger as $$
begin
  insert into public.users (id, email, created_at)
  values (new.id, new.email, new.created_at)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created_mirror on auth.users;
create trigger on_auth_user_created_mirror
  after insert on auth.users
  for each row execute procedure public.handle_new_user_mirror();

COMMIT;

-- CONFIRMATION
DO $$
BEGIN
  RAISE NOTICE 'Database setup completed successfully. Resumes bucket created. Users backfilled. FK fixed.';
END $$;
