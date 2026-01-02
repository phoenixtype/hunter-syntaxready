-- 1. Create public.users if it doesn't exist
-- This table is often used as a mirror of auth.users
create table if not exists public.users (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  created_at timestamp with time zone default now()
);

-- 2. Setup RLS (Optional but recommended)
alter table public.users enable row level security;

create policy "Users can view their own data" 
on public.users for select 
using ( auth.uid() = id );

create policy "Users can update their own data" 
on public.users for update 
using ( auth.uid() = id );

-- 3. Trigger to sync new auth.users to public.users
create or replace function public.handle_new_user_mirror()
returns trigger as $$
begin
  insert into public.users (id, email, created_at)
  values (new.id, new.email, new.created_at)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if validation fails to avoid double firing
drop trigger if exists on_auth_user_created_mirror on auth.users;

create trigger on_auth_user_created_mirror
  after insert on auth.users
  for each row execute procedure public.handle_new_user_mirror();

-- 4. CRITICAL: Backfill existing users
insert into public.users (id, email, created_at)
select id, email, created_at
from auth.users
where id not in (select id from public.users);

-- 5. Force backfill for your specific user (just to be safe)
-- This ensures that even if you are logged in, your record exists.
insert into public.users (id, email, created_at)
select id, email, created_at
from auth.users
on conflict (id) do nothing;
