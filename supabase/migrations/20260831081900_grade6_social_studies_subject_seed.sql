begin;

-- Canonical global subject dependency for the Grade 6 Social Studies Term 3 production seed.
-- Keep this dependency explicit so a blank-database migration rebuild does not depend on production data.
insert into public.subjects (id, name)
select '66060000-0000-4000-8000-000000000001'::uuid, 'Social Studies'
where not exists (
  select 1
  from public.subjects
  where school_id is null
    and lower(btrim(name)) = 'social studies'
);

commit;
