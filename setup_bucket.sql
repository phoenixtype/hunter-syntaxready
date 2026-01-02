-- Create the storage bucket for resumes
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', true)
on conflict (id) do nothing;

-- Set up RLS policies for the resumes bucket
drop policy if exists "Authenticated users can upload resumes" on storage.objects;
create policy "Authenticated users can upload resumes"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'resumes' and auth.uid() = owner );

drop policy if exists "Authenticated users can read their own resumes" on storage.objects;
create policy "Authenticated users can read their own resumes"
on storage.objects for select
to authenticated
using ( bucket_id = 'resumes' and auth.uid() = owner );

drop policy if exists "Authenticated users can update their own resumes" on storage.objects;
create policy "Authenticated users can update their own resumes"
on storage.objects for update
to authenticated
using ( bucket_id = 'resumes' and auth.uid() = owner );

drop policy if exists "Authenticated users can delete their own resumes" on storage.objects;
create policy "Authenticated users can delete their own resumes"
on storage.objects for delete
to authenticated
using ( bucket_id = 'resumes' and auth.uid() = owner );
