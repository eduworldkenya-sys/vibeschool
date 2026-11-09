-- Reconcile only the caller's own exam attempts through the existing
-- submit/mark/release functions. This is not an administrator bypass.
-- Individual failures are reported without losing successful repairs.
create or replace function public.exq_reconcile_my_exam_attempts()
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_caller uuid := auth.uid();
  v_learner uuid;
  v_attempt record;
  v_repaired integer := 0;
  v_failed integer := 0;
  v_errors jsonb := '[]'::jsonb;
begin
  if v_caller is null then raise exception 'not_authenticated'; end if;
  select s.id into v_learner from public.students s
  where s.profile_id = v_caller and s.deleted_at is null limit 1;
  if v_learner is null then raise exception 'learner_identity_not_found'; end if;

  for v_attempt in
    select a.id,a.status,a.result_status
    from public.assessment_attempts a
    join public.assessment_assignments aa on aa.id=a.assignment_id
    join public.assessment_definitions d on d.id=a.assessment_id
    where a.student_id=v_learner and
      (
        ((a.status='in_progress' or
            (a.status='submitted' and a.lock_reason='time_expired'
             and a.result_status='pending' and a.score is null))
         and a.expires_at is not null and a.expires_at<=now())
        or
        (a.status='auto_marked' and a.result_status='marked'
         and a.score is not null and a.max_score>0
         and d.assessment_type='practice' and aa.show_score_policy='immediate'
         and not exists(select 1 from public.assessment_gradebook_entries g
                        where g.attempt_id=a.id))
      )
    order by a.started_at asc
    limit 50
  loop
    begin
      if v_attempt.status='auto_marked' then
        -- Fires the canonical immediate-practice release trigger.
        update public.assessment_attempts a set status=a.status
          where a.id=v_attempt.id and a.student_id=v_learner
            and a.status='auto_marked' and a.result_status='marked';
      else
        perform public.exq_submit_attempt(v_attempt.id);
      end if;
      v_repaired := v_repaired + 1;
    exception when others then
      v_failed := v_failed + 1;
      v_errors := v_errors || jsonb_build_array(
        jsonb_build_object('attempt_id',v_attempt.id,'reason',sqlstate));
    end;
  end loop;
  return jsonb_build_object('ok',true,'processed',v_repaired+v_failed,
    'repaired',v_repaired,'failed',v_failed,'errors',v_errors);
end;
$function$;
revoke all on function public.exq_reconcile_my_exam_attempts() from public, anon;
grant execute on function public.exq_reconcile_my_exam_attempts() to authenticated;
