-- Pilot authorization semantic repair.
--
-- This is the single intentional forward production migration in the
-- reconstruction package. Historical/pretracked structures that production
-- already has are created IF NOT EXISTS here only so a blank repository replay
-- can reach the same final schema without inventing migration versions that a
-- later production push would try to apply.
--
-- Production forensics proved mixed student_id identity domains:
--   student_exam_readiness_state.student_id -> auth.users(id)
--   student_mistake_notebook.student_id     -> public.profiles(id)
--   vibelearn_content_views.student_id      -> auth.users(id)
--   vibelearn_searches.student_id           -> public.profiles(id)
-- student_kcse_error_classifications is written in the auth/profile domain by
-- its canonical writer. None of those columns may be resolved through
-- public.students(id).
--
-- The same audit also found two broader pilot-boundary defects:
--   * exam_results_member_read permissively exposed every result in a school to
--     any school member, bypassing narrower teacher/family/learner policies;
--   * legacy blanket anon table grants remained on exam_results and
--     class_join_requests even though all real actors authenticate.
--
-- authorization-test: public.student_exam_readiness_state
-- authorization-test: public.student_mistake_notebook
-- authorization-test: public.student_kcse_error_classifications
-- authorization-test: public.vibelearn_content_views
-- authorization-test: public.vibelearn_searches
-- authorization-test: public.class_join_requests
-- authorization-test: public.exam_results

-- ---------------------------------------------------------------------------
-- Blank-rebuild structural prerequisites for pretracked VibeLearn tables.
-- On production these CREATE statements are no-ops because both tables exist.
-- ---------------------------------------------------------------------------
create table if not exists public.vibelearn_content_views (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.vibelearn_content(id) on delete cascade,
  student_id uuid references auth.users(id) on delete set null,
  viewed_at timestamptz not null default now()
);
create index if not exists idx_vcv_content
  on public.vibelearn_content_views(content_id, viewed_at desc);
alter table public.vibelearn_content_views enable row level security;

create table if not exists public.vibelearn_searches (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.profiles(id) on delete set null,
  query text not null,
  results_count integer default 0,
  searched_at timestamptz default now()
);
alter table public.vibelearn_searches enable row level security;

-- ---------------------------------------------------------------------------
-- Auth/profile-keyed learner tables: direct self ownership.
-- ---------------------------------------------------------------------------
drop policy if exists student_exam_readiness_insert_own on public.student_exam_readiness_state;
drop policy if exists student_exam_readiness_select_own on public.student_exam_readiness_state;
drop policy if exists student_exam_readiness_update_own on public.student_exam_readiness_state;

create policy student_exam_readiness_insert_own
on public.student_exam_readiness_state
for insert to authenticated
with check (student_id=(select auth.uid()));

create policy student_exam_readiness_select_own
on public.student_exam_readiness_state
for select to authenticated
using (student_id=(select auth.uid()));

create policy student_exam_readiness_update_own
on public.student_exam_readiness_state
for update to authenticated
using (student_id=(select auth.uid()))
with check (student_id=(select auth.uid()));

revoke all privileges on table public.student_exam_readiness_state from anon, authenticated;
grant select, insert, update on table public.student_exam_readiness_state to authenticated;
grant all privileges on table public.student_exam_readiness_state to service_role;

drop policy if exists student_mistakes_select_own on public.student_mistake_notebook;
create policy student_mistakes_select_own
on public.student_mistake_notebook
for select to authenticated
using (student_id=(select auth.uid()));

revoke all privileges on table public.student_mistake_notebook from anon, authenticated;
grant select on table public.student_mistake_notebook to authenticated;
grant all privileges on table public.student_mistake_notebook to service_role;

drop policy if exists student_kcse_error_classifications_insert on public.student_kcse_error_classifications;
drop policy if exists student_kcse_error_classifications_select on public.student_kcse_error_classifications;
drop policy if exists student_kcse_error_classifications_update on public.student_kcse_error_classifications;

create policy student_kcse_error_classifications_insert
on public.student_kcse_error_classifications
for insert to authenticated
with check (student_id=(select auth.uid()));
create policy student_kcse_error_classifications_select
on public.student_kcse_error_classifications
for select to authenticated
using (student_id=(select auth.uid()));
create policy student_kcse_error_classifications_update
on public.student_kcse_error_classifications
for update to authenticated
using (student_id=(select auth.uid()))
with check (student_id=(select auth.uid()));

revoke all privileges on table public.student_kcse_error_classifications from anon, authenticated;
grant select, insert, update on table public.student_kcse_error_classifications to authenticated;
grant all privileges on table public.student_kcse_error_classifications to service_role;

-- Content views are auth.users(id)-keyed. Keep a teacher read path only for
-- content submitted by that teacher; learner write/read is direct self scope.
drop policy if exists "teacher reads own content views" on public.vibelearn_content_views;
create policy "teacher reads own content views"
on public.vibelearn_content_views
for select to authenticated
using (
  exists (
    select 1 from public.vibelearn_content c
    where c.id=vibelearn_content_views.content_id
      and c.submitted_by=(select auth.uid())
  )
);

drop policy if exists "students insert views" on public.vibelearn_content_views;
drop policy if exists vibelearn_content_views_student_read on public.vibelearn_content_views;
create policy "students insert views"
on public.vibelearn_content_views
for insert to authenticated
with check (student_id=(select auth.uid()));
create policy vibelearn_content_views_student_read
on public.vibelearn_content_views
for select to authenticated
using (student_id=(select auth.uid()));

revoke all privileges on table public.vibelearn_content_views from anon, authenticated;
grant select, insert on table public.vibelearn_content_views to authenticated;
grant all privileges on table public.vibelearn_content_views to service_role;

-- Search history is profile/auth keyed.
drop policy if exists vibelearn_searches_owner on public.vibelearn_searches;
create policy vibelearn_searches_owner
on public.vibelearn_searches
for all to authenticated
using (student_id=(select auth.uid()))
with check (student_id=(select auth.uid()));

revoke all privileges on table public.vibelearn_searches from anon, authenticated;
grant select, insert, update, delete on table public.vibelearn_searches to authenticated;
grant all privileges on table public.vibelearn_searches to service_role;

-- ---------------------------------------------------------------------------
-- Class join requests: remove anonymous grants and normalize every actor policy
-- to authenticated. This migration originally retained the legacy
-- classes.teacher_id compatibility boundary; because the production-generated
-- canonical reconciliation version sorts before this file, the final policy is
-- reasserted below after all original semantic-repair statements.
-- ---------------------------------------------------------------------------
alter table public.class_join_requests enable row level security;
revoke all privileges on table public.class_join_requests from anon, authenticated;
grant select, insert, update on table public.class_join_requests to authenticated;
grant all privileges on table public.class_join_requests to service_role;

drop policy if exists join_requests_admin on public.class_join_requests;
create policy join_requests_admin
on public.class_join_requests
for all to authenticated
using (
  exists (
    select 1 from public.classes c
    where c.id=class_join_requests.class_id
      and public.is_school_admin(c.school_id)
  )
)
with check (
  exists (
    select 1 from public.classes c
    where c.id=class_join_requests.class_id
      and public.is_school_admin(c.school_id)
  )
);

drop policy if exists join_requests_parent_insert on public.class_join_requests;
create policy join_requests_parent_insert
on public.class_join_requests
for insert to authenticated
with check (parent_id=(select auth.uid()));

drop policy if exists join_requests_parent_read on public.class_join_requests;
create policy join_requests_parent_read
on public.class_join_requests
for select to authenticated
using (parent_id=(select auth.uid()));

drop policy if exists join_requests_teacher on public.class_join_requests;
create policy join_requests_teacher
on public.class_join_requests
for all to authenticated
using (
  exists (
    select 1 from public.classes c
    where c.id=class_join_requests.class_id
      and c.teacher_id=(select auth.uid())
      and exists (
        select 1 from public.school_members sm
        where sm.school_id=c.school_id
          and sm.profile_id=(select auth.uid())
          and sm.role in ('teacher','owner','admin')
      )
  )
)
with check (
  exists (
    select 1 from public.classes c
    where c.id=class_join_requests.class_id
      and c.teacher_id=(select auth.uid())
      and exists (
        select 1 from public.school_members sm
        where sm.school_id=c.school_id
          and sm.profile_id=(select auth.uid())
          and sm.role in ('teacher','owner','admin')
      )
  )
);

-- ---------------------------------------------------------------------------
-- Exam results: remove blanket anonymous access and the permissive
-- school-member read bypass. Explicit admin, assigned-teacher, linked-family and
-- canonical-learner policies are the only end-user read authorities.
-- ---------------------------------------------------------------------------
alter table public.exam_results enable row level security;
revoke all privileges on table public.exam_results from anon, authenticated;
grant select, insert, update, delete on table public.exam_results to authenticated;
grant all privileges on table public.exam_results to service_role;

drop policy if exists exam_results_member_read on public.exam_results;

drop policy if exists exam_results_admin on public.exam_results;
create policy exam_results_admin
on public.exam_results
for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

drop policy if exists exam_results_parent_read on public.exam_results;
create policy exam_results_parent_read
on public.exam_results
for select to authenticated
using (
  exists (
    select 1 from public.parent_student_links psl
    where psl.student_id=exam_results.student_id
      and psl.parent_id=(select auth.uid())
  )
);

drop policy if exists exam_results_student_read on public.exam_results;
create policy exam_results_student_read
on public.exam_results
for select to authenticated
using (
  exists (
    select 1 from public.students s
    where s.id=exam_results.student_id
      and s.profile_id=(select auth.uid())
      and s.deleted_at is null
  )
);

-- ---------------------------------------------------------------------------
-- Fail closed on future identity-domain drift and on reintroduction of the
-- broad exam-results member bypass.
-- ---------------------------------------------------------------------------
do $$
declare
  mismatch text;
begin
  with expected(table_name, ref_schema, ref_table) as (
    values
      ('student_exam_readiness_state','auth','users'),
      ('student_mistake_notebook','public','profiles'),
      ('vibelearn_content_views','auth','users'),
      ('vibelearn_searches','public','profiles'),
      ('class_join_requests','public','students'),
      ('exam_results','public','students')
  ), actual as (
    select c.relname table_name, rn.nspname ref_schema, rc.relname ref_table
    from pg_constraint con
    join pg_class c on c.oid=con.conrelid
    join pg_namespace n on n.oid=c.relnamespace
    join pg_class rc on rc.oid=con.confrelid
    join pg_namespace rn on rn.oid=rc.relnamespace
    join unnest(con.conkey) with ordinality ck(attnum,ord) on true
    join pg_attribute a on a.attrelid=c.oid and a.attnum=ck.attnum
    where con.contype='f'
      and n.nspname='public'
      and a.attname='student_id'
  )
  select string_agg(format('%s expected %s.%s',e.table_name,e.ref_schema,e.ref_table),', ')
  into mismatch
  from expected e
  left join actual a
    on a.table_name=e.table_name
   and a.ref_schema=e.ref_schema
   and a.ref_table=e.ref_table
  where a.table_name is null;

  if mismatch is not null then
    raise exception 'learner identity-domain FK contract drift: %',mismatch;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='exam_results'
      and policyname='exam_results_member_read'
  ) then
    raise exception 'broad exam_results member-read bypass remains';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Replay-order closure for 20260818001345.
--
-- Production applied the generated reconciliation migration after this version
-- even though its generated numeric version sorts earlier. Reassert the final
-- canonical-first teacher policy here so a blank lexical replay and production
-- converge on exactly the same authority semantics.
-- ---------------------------------------------------------------------------
drop policy if exists join_requests_teacher on public.class_join_requests;
create policy join_requests_teacher
on public.class_join_requests
for all to authenticated
using (
  exists (
    select 1
    from public.classes c
    where c.id = class_join_requests.class_id
      and exists (
        select 1
        from public.school_members sm
        where sm.school_id = c.school_id
          and sm.profile_id = (select auth.uid())
          and sm.role = 'teacher'
      )
      and (
        exists (
          select 1
          from public.teacher_classes tc
          where tc.school_id = c.school_id
            and tc.class_id = c.id
            and tc.teacher_id = (select auth.uid())
            and tc.is_class_teacher = true
        )
        or (
          c.teacher_id = (select auth.uid())
          and not exists (
            select 1
            from public.teacher_classes canonical
            where canonical.school_id = c.school_id
              and canonical.class_id = c.id
              and canonical.is_class_teacher = true
          )
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.classes c
    where c.id = class_join_requests.class_id
      and exists (
        select 1
        from public.school_members sm
        where sm.school_id = c.school_id
          and sm.profile_id = (select auth.uid())
          and sm.role = 'teacher'
      )
      and (
        exists (
          select 1
          from public.teacher_classes tc
          where tc.school_id = c.school_id
            and tc.class_id = c.id
            and tc.teacher_id = (select auth.uid())
            and tc.is_class_teacher = true
        )
        or (
          c.teacher_id = (select auth.uid())
          and not exists (
            select 1
            from public.teacher_classes canonical
            where canonical.school_id = c.school_id
              and canonical.class_id = c.id
              and canonical.is_class_teacher = true
          )
        )
      )
  )
);