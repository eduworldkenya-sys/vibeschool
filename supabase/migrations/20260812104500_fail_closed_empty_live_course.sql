begin;

-- A course advertised as live must have reader modules. The current
-- Community Health Nursing row was marked live while containing zero
-- modules, which creates a dead learning route. Fail closed until content
-- is actually published.
update public.courses
set status = 'coming_soon',
    modules_count = 0
where slug = 'community-health-nursing'
  and status = 'live'
  and not exists (
    select 1
    from public.modules m
    where m.course_id = courses.id
  );

commit;
