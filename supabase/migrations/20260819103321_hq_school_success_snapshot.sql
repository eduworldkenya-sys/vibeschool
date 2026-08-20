-- Explainable school/customer-success intelligence. No opaque health score and no user PII.
create or replace function public.hq_school_success_snapshot(p_limit integer default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare lim integer:=greatest(1,least(coalesce(p_limit,100),250));
begin
  perform public.hq_assert_owner();
  return jsonb_build_object(
    'observed_at',clock_timestamp(),
    'schools',coalesce((
      with sc as (
        select school_id,count(distinct student_id)::int learners
        from public.student_classes where is_current is true group by school_id
      ), tc as (
        select school_id,count(distinct teacher_id)::int teachers
        from public.teacher_classes group by school_id
      ), at7 as (
        select school_id,count(*)::int marks,count(distinct student_id)::int learners_seen
        from public.attendance where date>=current_date-6 group by school_id
      ), hw7 as (
        select school_id,count(*)::int created
        from public.homework where created_at>=clock_timestamp()-interval '7 days' group by school_id
      ), sub7 as (
        select h.school_id,count(*)::int submitted
        from public.homework_submissions hs join public.homework h on h.id=hs.homework_id
        where hs.submitted_at>=clock_timestamp()-interval '7 days' group by h.school_id
      ), pl as (
        select school_id,count(distinct student_id)::int learners_with_parent_link
        from public.parent_student_links group by school_id
      )
      select jsonb_agg(to_jsonb(x) order by x.risk_count desc,x.school_name)
      from (
        select s.id school_id,s.name school_name,s.status::text school_status,
          coalesce(sc.learners,0) current_learners,
          coalesce(tc.teachers,0) teachers,
          coalesce(at7.marks,0) attendance_marks_7d,
          coalesce(at7.learners_seen,0) learners_with_attendance_7d,
          coalesce(hw7.created,0) homework_created_7d,
          coalesce(sub7.submitted,0) homework_submissions_7d,
          coalesce(pl.learners_with_parent_link,0) learners_with_parent_link,
          array_remove(array[
            case when coalesce(sc.learners,0)>0 and coalesce(tc.teachers,0)=0 then 'learners_without_teacher_assignment' end,
            case when coalesce(sc.learners,0)>0 and coalesce(at7.marks,0)=0 then 'no_attendance_evidence_7d' end,
            case when coalesce(sc.learners,0)>0 and coalesce(hw7.created,0)=0 then 'no_homework_created_7d' end,
            case when coalesce(sc.learners,0)>0 and coalesce(pl.learners_with_parent_link,0)=0 then 'no_parent_links' end
          ],null) risk_reasons,
          (case when coalesce(sc.learners,0)>0 and coalesce(tc.teachers,0)=0 then 1 else 0 end+
           case when coalesce(sc.learners,0)>0 and coalesce(at7.marks,0)=0 then 1 else 0 end+
           case when coalesce(sc.learners,0)>0 and coalesce(hw7.created,0)=0 then 1 else 0 end+
           case when coalesce(sc.learners,0)>0 and coalesce(pl.learners_with_parent_link,0)=0 then 1 else 0 end)::int risk_count
        from public.schools s
        left join sc on sc.school_id=s.id left join tc on tc.school_id=s.id left join at7 on at7.school_id=s.id
        left join hw7 on hw7.school_id=s.id left join sub7 on sub7.school_id=s.id left join pl on pl.school_id=s.id
        order by risk_count desc,s.name limit lim
      ) x
    ),'[]'::jsonb)
  );
end $$;
revoke all on function public.hq_school_success_snapshot(integer) from public,anon,service_role;
grant execute on function public.hq_school_success_snapshot(integer) to authenticated;
comment on function public.hq_school_success_snapshot(integer) is 'Owner-only explainable school adoption/activity evidence. Components and risk reasons are visible; no opaque health score.';
