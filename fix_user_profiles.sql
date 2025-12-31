-- 1. Ensure the profiles table exists (idempotent)
-- This matches standard Supabase patterns. If your table is named 'users', adjust accordingly.
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  updated_at timestamp with time zone,
  username text unique,
  full_name text,
  avatar_url text,
  website text,

  constraint username_length check (char_length(username) >= 3)
);

-- 2. Create the function to handle new user headers
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

-- 3. Create the trigger (drops existing if needed to avoid conflicts)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. BACKFILL: Insert profiles for existing users who don't have one
insert into public.profiles (id, full_name, avatar_url)
select id, raw_user_meta_data->>'full_name', raw_user_meta_data->>'avatar_url'
from auth.users
where id not in (select id from public.profiles);

-- 5. (Optional) If your error specifically referenced table "users", 
-- it's possible you have a legacy table named 'users'. 
-- This command attempts to backfill that if it exists.
do $$
begin
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'users') then
    execute 'insert into public.users (id) select id from auth.users where id not in (select id from public.users)';
  end if;
end
$$;
