begin;

-- lesson_plans.status and lesson_plans.published_at both exist in production and
-- are consumed by historical UI, HQ events, and publication flows, but their
-- original creation was live schema drift rather than replayable repository
-- migration truth. Reconstruct both before any trigger or RLS policy depends on
-- them so production and a blank rebuild expose the same publication contract.
--
-- This migration is idempotent on production and deterministic on a blank
-- rebuild. published_at remains nullable: NULL means the plan has never been
-- published to learners (or has been returned to draft); a timestamp records
-- the durable learner-publication event.
alter table public.lesson_plans
  add column if not exists status text,
  add column if not exists published_at timestamptz;

update public.lesson_plans
set status = 'draft'
where status is null;

alter table public.lesson_plans
  alter column status set default 'draft',
  alter column status set not null;

commit;
