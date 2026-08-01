-- Fix auth_rls_initplan warnings: wrap auth.uid() in (select ...) so it's
-- evaluated once per query instead of once per row.

drop policy if exists scheme_link_teacher_own on public.scheme_lesson_resource_links;
create policy scheme_link_teacher_own
  on public.scheme_lesson_resource_links
  for all
  using (
    exists (
      select 1 from public.scheme_of_work sow
      where sow.id = scheme_lesson_resource_links.scheme_lesson_id
        and sow.teacher_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.scheme_of_work sow
      where sow.id = scheme_lesson_resource_links.scheme_lesson_id
        and sow.teacher_id = (select auth.uid())
    )
  );

drop policy if exists scheme_link_member_read on public.scheme_lesson_resource_links;
create policy scheme_link_member_read
  on public.scheme_lesson_resource_links
  for select
  using (
    exists (
      select 1 from public.scheme_of_work sow
      join public.school_members sm on sm.school_id = sow.school_id
      where sow.id = scheme_lesson_resource_links.scheme_lesson_id
        and sm.profile_id = (select auth.uid())
    )
  );
