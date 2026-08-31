begin;

-- Production content migrations historically borrowed an arbitrary existing
-- publication author. A blank database has no human auth principal, so those
-- migrations were not reconstructible. Provide a deterministic, non-login
-- system principal only for platform-owned migration content.
insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at,
  banned_until,
  is_sso_user,
  is_anonymous
)
values (
  '76696265-7363-486f-8f6c-636f6e74656e'::uuid,
  'authenticated',
  'authenticated',
  null,
  null,
  '{"provider":"system","providers":["system"],"vibeschool_system_principal":true}'::jsonb,
  '{"name":"VibeSchool Content Factory"}'::jsonb,
  false,
  now(),
  now(),
  'infinity'::timestamptz,
  false,
  false
)
on conflict (id) do nothing;

-- Publication synchronization also writes vibelearn_content.submitted_by,
-- whose FK targets public.profiles. Keep the system principal complete across
-- both identity layers instead of weakening that referential-integrity check.
insert into public.profiles (
  id,
  full_name,
  account_status,
  role,
  is_anonymized
)
values (
  '76696265-7363-486f-8f6c-636f6e74656e'::uuid,
  'VibeSchool Content Factory',
  'active',
  'teacher',
  false
)
on conflict (id) do update
set full_name = excluded.full_name,
    account_status = excluded.account_status,
    is_anonymized = false,
    updated_at = clock_timestamp();

-- The Grade 6 Social Studies production seed selects an author from an existing
-- publication. Create a temporary unpublished bootstrap row so that selection
-- is deterministic on a blank reconstruction. A follow-up migration removes
-- only this bootstrap row after the real publication has inherited the system
-- author.
insert into public.vibe_publications (
  id,
  author_id,
  format,
  title,
  status,
  chapter_count,
  curriculum_framework,
  created_at,
  updated_at
)
values (
  '76696265-7363-4075-826c-697368657230'::uuid,
  '76696265-7363-486f-8f6c-636f6e74656e'::uuid,
  'vibetextbook',
  '__VibeSchool reconstruction bootstrap__',
  'draft',
  0,
  'CBC',
  '2000-01-01 00:00:00+00'::timestamptz,
  '2000-01-01 00:00:00+00'::timestamptz
)
on conflict (id) do nothing;

commit;
