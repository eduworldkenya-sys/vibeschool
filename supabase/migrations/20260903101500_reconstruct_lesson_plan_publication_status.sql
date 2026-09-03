begin;

-- lesson_plans.status exists in production and is consumed by historical UI
-- and publication flows, but its original creation was live schema drift rather
-- than replayable repository migration truth. The Lesson Plan spine privacy
-- migration intentionally depends on this column, so reconstruct it explicitly
-- before those policies are installed.
--
-- This is idempotent on production and deterministic on a blank rebuild.
alter table public.lesson_plans
  add column if not exists status text;

update public.lesson_plans
set status = 'draft'
where status is null;

alter table public.lesson_plans
  alter column status set default 'draft',
  alter column status set not null;

commit;
