-- READ-008G: assignment-level per-learner analytics and intervention drill-down.
-- Repository parity fix: this function was applied live to project
-- yauqsxggtuxuykcbrtzf under ledger version 20260731113118 but the
-- migration file was never committed. This file reproduces the live
-- definition exactly (verified via pg_get_functiondef 2026-07-31).

CREATE OR REPLACE FUNCTION public.get_classroom_reading_assignment_learners(assignment_id_input uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_teacher_id  uuid := auth.uid();
  v_assignment  public.vibe_chapter_assignments%rowtype;
  v_items       jsonb;
  v_linked      integer;
  v_unlinked    integer;
begin
  if v_teacher_id is null then
    return jsonb_build_object(
      'ok', false, 'reason', 'auth_required', 'items', '[]'::jsonb
    );
  end if;

  if assignment_id_input is null then
    return jsonb_build_object(
      'ok', false, 'reason', 'invalid_input', 'items', '[]'::jsonb
    );
  end if;

  select *
  into v_assignment
  from public.vibe_chapter_assignments
  where id = assignment_id_input
    and teacher_id = v_teacher_id;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'reason', 'assignment_not_found_or_not_owned',
      'items', '[]'::jsonb
    );
  end if;

  with roster as (
    select distinct on (sc.student_id)
      sc.student_id,
      s.name          as learner_name,
      s.admission_number,
      s.profile_id
    from public.student_classes sc
    join public.students s
      on s.id = sc.student_id
     and s.deleted_at is null
    where sc.class_id = v_assignment.class_id
      and sc.school_id = v_assignment.school_id
      and sc.is_current = true
      and sc.left_at is null
    order by sc.student_id, sc.joined_at desc
  ),
  enriched as (
    select
      r.student_id,
      r.profile_id as learner_profile_id,
      r.learner_name,
      nullif(r.admission_number, '') as admission_number,
      case when r.profile_id is null then 'account_unlinked' else 'linked' end
        as linkage_status,
      rp.progress_percent,
      rp.last_read_at,
      rp.completed_at
    from roster r
    left join public.vibe_reading_progress rp
      on r.profile_id is not null
     and rp.viewer_id = r.profile_id
     and rp.publication_id = v_assignment.publication_id
     and rp.chapter_id = v_assignment.chapter_id
  ),
  classified as (
    select
      e.*,
      case
        when e.linkage_status = 'account_unlinked' then 'account_unlinked'
        when e.completed_at is not null then 'completed'
        when v_assignment.status = 'assigned'
             and v_assignment.due_at is not null
             and v_assignment.due_at < now()
             and coalesce(e.progress_percent, 0) = 0
          then 'overdue_not_started'
        when v_assignment.status = 'assigned'
             and v_assignment.due_at is not null
             and v_assignment.due_at < now()
             and coalesce(e.progress_percent, 0) > 0
          then 'overdue_in_progress'
        when coalesce(e.progress_percent, 0) > 0 then 'in_progress'
        else 'not_started'
      end as reading_status
    from enriched e
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'assignment_id', v_assignment.id,
          'student_id', c.student_id,
          'learner_profile_id', c.learner_profile_id,
          'learner_name', c.learner_name,
          'admission_number', c.admission_number,
          'linkage_status', c.linkage_status,
          'progress_percent',
            case
              when c.linkage_status = 'account_unlinked' then null
              else coalesce(c.progress_percent, 0)
            end,
          'reading_status', c.reading_status,
          'is_overdue',
            c.reading_status in ('overdue_not_started', 'overdue_in_progress'),
          'last_read_at', c.last_read_at,
          'completed_at', c.completed_at,
          'due_at', v_assignment.due_at,
          'intervention_reason',
            case c.reading_status
              when 'account_unlinked'
                then 'Reader account not linked -- reading activity cannot be verified'
              when 'overdue_not_started' then 'Past due and has not started'
              when 'overdue_in_progress' then 'Past due and not yet completed'
              else null
            end
        )
        order by c.learner_name asc nulls last, c.student_id asc
      ),
      '[]'::jsonb
    )
  into v_items
  from classified c;

  select
    count(*) filter (where linkage_status = 'linked'),
    count(*) filter (where linkage_status = 'account_unlinked')
  into v_linked, v_unlinked
  from enriched;

  return jsonb_build_object(
    'ok', true,
    'reason', null,
    'assignment_id', v_assignment.id,
    'status', v_assignment.status,
    'due_at', v_assignment.due_at,
    'linked_learner_count', coalesce(v_linked, 0),
    'unlinked_learner_count', coalesce(v_unlinked, 0),
    'items', v_items
  );
end;
$function$;

REVOKE ALL ON FUNCTION public.get_classroom_reading_assignment_learners(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_classroom_reading_assignment_learners(uuid) TO authenticated, service_role;
