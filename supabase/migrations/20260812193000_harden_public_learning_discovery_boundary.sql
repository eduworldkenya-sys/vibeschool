-- Public learning discovery boundary
--
-- Public discovery must expose only intentionally published learning.
-- Course/module metadata is not independently public merely because the tables
-- are used by the interactive learner application. The public knowledge layer
-- is the indexable authority; database read policies must enforce the same
-- publication boundary for direct Data API access.

begin;

-- Courses are public only after explicit publication.
drop policy if exists "public read courses" on public.courses;
create policy "public read live courses"
on public.courses
for select
to anon, authenticated
using (status = 'live');

-- Modules are public only when their parent course is live.
drop policy if exists "public read modules" on public.modules;
create policy "public read modules of live courses"
on public.modules
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.courses c
    where c.id = modules.course_id
      and c.status = 'live'
  )
);

-- Topic bodies are already restricted to published topics. Keep that
-- publication boundary explicit and ensure the parent course is live as well.
drop policy if exists "public read published topics" on public.topics;
create policy "public read published topics of live courses"
on public.topics
for select
to anon, authenticated
using (
  content_status = 'published'
  and exists (
    select 1
    from public.modules m
    join public.courses c on c.id = m.course_id
    where m.id = topics.module_id
      and c.status = 'live'
  )
);

-- quiz_questions contains assessment material and answer-bearing fields.
-- It must never be a generic anonymous/authenticated table-read surface.
drop policy if exists "public read quiz questions" on public.quiz_questions;

commit;
