-- 1. Create public.users if it doesn't exist
create table if not exists public.users (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  created_at timestamp with time zone default now()
);

-- 2. Setup RLS (Idempotent)
alter table public.users enable row level security;

drop policy if exists "Users can view their own data" on public.users;
create policy "Users can view their own data" 
on public.users for select 
using ( auth.uid() = id );

drop policy if exists "Users can update their own data" on public.users;
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

drop trigger if exists on_auth_user_created_mirror on auth.users;
create trigger on_auth_user_created_mirror
  after insert on auth.users
  for each row execute procedure public.handle_new_user_mirror();

-- 4. CRITICAL: Backfill existing users
insert into public.users (id, email, created_at)
select id, email, created_at
from auth.users
on conflict (id) do nothing;
