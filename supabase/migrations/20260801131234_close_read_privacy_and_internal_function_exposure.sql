begin;

drop policy if exists "authenticated read homework_answers" on public.homework_answers;
create policy "authorized read homework_answers" on public.homework_answers for select to authenticated
using (
  submission_id is not null
  and exists (
    select 1 from public.homework_submissions hs
    left join public.students st on st.id = hs.student_id
    left join public.homework h on h.id = hs.homework_id
    where hs.id = homework_answers.submission_id
      and (
        st.profile_id = (select auth.uid())
        or h.teacher_id = (select auth.uid())
        or exists (select 1 from public.parent_student_links psl where psl.student_id = hs.student_id and psl.parent_id = (select auth.uid()))
      )
  )
);

drop policy if exists exam_sessions_select on public.exam_sessions;
create policy exam_sessions_select on public.exam_sessions for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Teachers read own transactions" on public.vibe_credit_transactions;
create policy "Teachers read own transactions" on public.vibe_credit_transactions for select to authenticated
using (teacher_id = (select auth.uid()));

do $block$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure::text as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    left join pg_depend d
      on d.classid = 'pg_proc'::regclass
     and d.objid = p.oid
     and d.deptype = 'e'
    where n.nspname = 'public'
      and d.objid is null
      and pg_get_userbyid(p.proowner) = current_user
      and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.signature);
    execute format('grant execute on function %s to service_role', r.signature);
  end loop;
end
$block$;

alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

commit;
