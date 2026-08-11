-- L0 prerequisite reconstruction for the pre-existing teacher_content table.
-- Derived read-only from the production catalog so the following VibeTwin
-- source-adapter migration can resolve public.teacher_content%rowtype during a
-- blank-database replay. This does not copy production data.

create table if not exists public.teacher_content (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references auth.users(id),
  school_id uuid,
  class_id uuid,
  subject_id uuid,
  type text check (type = any(array['notes'::text,'document'::text,'assignment'::text,'revision'::text,'link'::text])),
  title text,
  body text,
  file_url text,
  published boolean default false,
  published_at timestamptz,
  created_at timestamptz default now()
);

alter table public.teacher_content enable row level security;

drop policy if exists teacher_content_locked on public.teacher_content;
create policy teacher_content_locked
on public.teacher_content
for select
to public
using (false);
