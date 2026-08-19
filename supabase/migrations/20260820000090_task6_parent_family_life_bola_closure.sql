begin;

-- Task 6: family-owned Life & Learning records are support artifacts, but they
-- are still child-scoped personal data. These relations are production-only
-- legacy objects whose creation migrations are not preserved in the repository.
-- Apply the BOLA closure when each relation exists; clean reconstruction must
-- remain valid when the legacy relation is absent.
do $migration$
begin
  if to_regclass('public.child_goals') is not null then
    execute 'drop policy if exists "parent owns child goals" on public.child_goals';
    execute $policy$
      create policy "parent owns child goals"
      on public.child_goals
      for all
      to authenticated
      using (
        child_goals.parent_id = (select auth.uid())
        and (select public.is_parent_of_student(child_goals.student_id))
      )
      with check (
        child_goals.parent_id = (select auth.uid())
        and (select public.is_parent_of_student(child_goals.student_id))
      )
    $policy$;
  end if;

  if to_regclass('public.child_skills') is not null then
    execute 'drop policy if exists "parent owns child skills" on public.child_skills';
    execute $policy$
      create policy "parent owns child skills"
      on public.child_skills
      for all
      to authenticated
      using (
        child_skills.parent_id = (select auth.uid())
        and (select public.is_parent_of_student(child_skills.student_id))
      )
      with check (
        child_skills.parent_id = (select auth.uid())
        and (select public.is_parent_of_student(child_skills.student_id))
      )
    $policy$;
  end if;

  if to_regclass('public.child_books') is not null then
    execute 'drop policy if exists "parent owns child books" on public.child_books';
    execute $policy$
      create policy "parent owns child books"
      on public.child_books
      for all
      to authenticated
      using (
        child_books.parent_id = (select auth.uid())
        and (select public.is_parent_of_student(child_books.student_id))
      )
      with check (
        child_books.parent_id = (select auth.uid())
        and (select public.is_parent_of_student(child_books.student_id))
      )
    $policy$;
  end if;

  if to_regclass('public.child_events') is not null then
    execute 'drop policy if exists "parent owns child events" on public.child_events';
    execute $policy$
      create policy "parent owns child events"
      on public.child_events
      for all
      to authenticated
      using (
        child_events.parent_id = (select auth.uid())
        and (select public.is_parent_of_student(child_events.student_id))
      )
      with check (
        child_events.parent_id = (select auth.uid())
        and (select public.is_parent_of_student(child_events.student_id))
      )
    $policy$;
  end if;

  -- Milestones inherit authority from the parent-owned goal, but only when
  -- both legacy relations exist in this schema state.
  if to_regclass('public.child_goal_milestones') is not null
     and to_regclass('public.child_goals') is not null then
    execute 'drop policy if exists "parent owns milestones" on public.child_goal_milestones';
    execute $policy$
      create policy "parent owns milestones"
      on public.child_goal_milestones
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.child_goals g
          where g.id = child_goal_milestones.goal_id
            and g.student_id = child_goal_milestones.student_id
            and g.parent_id = (select auth.uid())
            and (select public.is_parent_of_student(g.student_id))
        )
      )
      with check (
        exists (
          select 1
          from public.child_goals g
          where g.id = child_goal_milestones.goal_id
            and g.student_id = child_goal_milestones.student_id
            and g.parent_id = (select auth.uid())
            and (select public.is_parent_of_student(g.student_id))
        )
      )
    $policy$;
  end if;
end
$migration$;

-- Pathway Passport projection is learner-owned evidence. A historical/revoked
-- link must not keep returning it from this SECURITY DEFINER function.
create or replace function public.parent_get_linked_pathway_passports()
returns table(
  student_id uuid,
  student_name text,
  pathway_slug text,
  pathway_name text,
  adopted_at timestamptz,
  reviewed_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select s.id,
         s.name,
         p.slug,
         p.name,
         pp.adopted_at,
         pp.reviewed_at
  from public.parent_student_links l
  join public.students s
    on s.id = l.student_id
   and s.deleted_at is null
  left join public.student_pathway_passports pp
    on pp.student_id = s.id
  left join public.pathways p
    on p.id = pp.pathway_id
  where l.parent_id = (select auth.uid())
    and coalesce(l.access_level, 'full') <> 'none';
$function$;

revoke all on function public.parent_get_linked_pathway_passports()
  from public, anon, service_role;
grant execute on function public.parent_get_linked_pathway_passports()
  to authenticated;

commit;
