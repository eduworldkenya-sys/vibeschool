begin;

-- Clean-rebuild prerequisite for the Grade 6 Social Studies Term 3 production seed.
-- Production already uses this canonical global subject identity. Reconstruct it
-- deterministically before 20260831082000 rather than allowing that later seed
-- to depend on production-only historical state.
insert into public.subjects (
  id,
  school_id,
  name,
  global_subject_id
)
values (
  '09715a10-3f91-4351-b6bc-fa252666a20b'::uuid,
  null,
  'Social Studies',
  null
)
on conflict (id) do update
set school_id = excluded.school_id,
    name = excluded.name,
    global_subject_id = excluded.global_subject_id,
    updated_at = clock_timestamp();

-- Fail closed if another global row with the same canonical name exists under a
-- different identity; silently selecting between duplicate authorities would
-- make curriculum foreign keys nondeterministic.
do $$
begin
  if exists (
    select 1
    from public.subjects
    where school_id is null
      and lower(btrim(name)) = 'social studies'
      and id <> '09715a10-3f91-4351-b6bc-fa252666a20b'::uuid
  ) then
    raise exception 'GLOBAL_SOCIAL_STUDIES_IDENTITY_CONFLICT';
  end if;
end $$;

commit;
