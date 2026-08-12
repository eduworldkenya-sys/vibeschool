-- Correct the attendance projection to match the production attendance_status enum.\n
create or replace function public.parent_get_classroom_learning_brief()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_children jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select coalesce(jsonb_agg(child_item order by child_name), '[]'::jsonb)
  into v_children
  from (
    select s.name child_name,
      jsonb_build_object(
        'student_id', s.id,
        'name', s.name,
        'class_name', concat_ws(' ', c.name, nullif(c.stream, '')),
        'school_name', sch.name,
        'attendance', jsonb_build_object(
          'marked', coalesce(att.marked, 0),
          'present', coalesce(att.present, 0),
          'absent', coalesce(att.absent, 0),
          'excused', coalesce(att.excused, 0),
          'percentage', case when coalesce(att.marked, 0) > 0
            then round((coalesce(att.present, 0)::numeric / att.marked::numeric) * 100)
            else null end
        ),
        'homework', jsonb_build_object(
          'assigned', coalesce(hw.assigned, 0),
          'submitted', coalesce(hw.submitted, 0),
          'marked', coalesce(hw.marked, 0),
          'overdue', coalesce(hw.overdue, 0),
          'feedback_released', coalesce(hw.feedback_released, 0)
        ),
        'latest_summary', summary.payload,
        'recent_messages', coalesce(messages.items, '[]'::jsonb)
      ) child_item
    from public.parent_student_links psl
    join public.students s on s.id = psl.student_id and s.deleted_at is null
    left join public.student_classes sc
      on sc.student_id = s.id and sc.school_id = psl.school_id and sc.is_current
    left join public.classes c on c.id = sc.class_id
    left join public.schools sch on sch.id = psl.school_id
    left join lateral (
      select count(*)::integer marked,
        count(*) filter (where a.status = 'present')::integer present,
        count(*) filter (where a.status = 'absent')::integer absent,
        count(*) filter (where a.status = 'excused')::integer excused
      from public.attendance a
      where a.student_id = s.id and a.school_id = psl.school_id
        and a.date >= current_date - 30
    ) att on true
    left join lateral (
      select count(distinct h.id)::integer assigned,
        count(distinct hs.id) filter (where hs.status in ('submitted','received','under_review','marked'))::integer submitted,
        count(distinct hs.id) filter (where hs.status = 'marked')::integer marked,
        count(distinct h.id) filter (where h.due_date < current_date and coalesce(hs.status,'pending') not in ('submitted','received','under_review','marked'))::integer overdue,
        count(distinct hs.id) filter (where hs.feedback_released_at is not null)::integer feedback_released
      from public.homework h
      left join public.homework_submissions hs
        on hs.homework_id = h.id and hs.student_id = s.id
      where h.class_id = sc.class_id and h.school_id = psl.school_id
        and h.created_at >= clock_timestamp() - interval '30 days'
    ) hw on true
    left join lateral (
      select jsonb_build_object(
        'id', pls.id, 'period_start', pls.period_start,
        'period_end', pls.period_end, 'summary', pls.summary,
        'strengths', pls.strengths, 'focus_areas', pls.focus_areas,
        'teacher_comment', pls.teacher_comment, 'published_at', pls.published_at
      ) payload
      from public.parent_learning_summaries pls
      where pls.student_id = s.id and pls.status = 'published'
      order by pls.published_at desc nulls last limit 1
    ) summary on true
    left join lateral (
      select jsonb_agg(jsonb_build_object(
        'id', pm.id, 'subject', pm.subject, 'body', pm.body,
        'sent_at', pm.sent_at, 'purpose', pm.delivery_purpose
      ) order by pm.sent_at desc) items
      from (
        select * from public.parent_messages pm0
        where pm0.student_id = s.id and pm0.school_id = psl.school_id
        order by pm0.sent_at desc limit 5
      ) pm
    ) messages on true
    where psl.parent_id = v_uid
      and coalesce(psl.access_level, 'full') <> 'none'
  ) q;

  return jsonb_build_object(
    'generated_at', clock_timestamp(),
    'period_days', 30,
    'children', v_children
  );
end;
$function$;

revoke all on function public.parent_get_classroom_learning_brief() from public, anon;
grant execute on function public.parent_get_classroom_learning_brief() to authenticated, service_role;


