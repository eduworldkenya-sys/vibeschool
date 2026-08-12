begin;

-- Preserve the existing heavy implementation under an internal name and expose
-- a safe API wrapper. Unclaimed learner accounts should receive an actionable
-- claim-required response, not a PostgreSQL ERROR that pollutes production logs.
alter function public.student_get_twin_state() rename to student_get_twin_state_internal;

create or replace function public.student_get_twin_state()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if auth.uid() is null then
    return jsonb_build_object('ok',false,'code','NOT_AUTHENTICATED','action','/login');
  end if;

  begin
    return public.student_get_twin_state_internal();
  exception
    when others then
      if sqlerrm = 'learner_identity_not_found' then
        return jsonb_build_object(
          'ok',false,
          'code','STUDENT_CLAIM_REQUIRED',
          'message','Your student account has not been linked to a learner record yet.',
          'action','/student/claim'
        );
      end if;
      raise;
  end;
end;
$function$;

revoke execute on function public.student_get_twin_state_internal() from public,anon,authenticated;
grant execute on function public.student_get_twin_state() to authenticated,service_role;
alter function public.student_get_twin_state() set search_path = public, pg_temp;

-- The tutor context endpoint is also a client-facing learner entry point, so
-- give it the same deterministic claim-required contract.
alter function public.student_get_twin_tutor_context() rename to student_get_twin_tutor_context_internal;

create or replace function public.student_get_twin_tutor_context()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare v_state jsonb;
begin
  v_state := public.student_get_twin_state();
  if coalesce((v_state->>'ok')::boolean,false) = false then
    return v_state;
  end if;
  return jsonb_build_object(
    'student_id',v_state->'student_id',
    'generated_at',v_state->'generated_at',
    'confidence',v_state->'confidence',
    'curriculum',v_state->'curriculum',
    'mastery',v_state->'mastery',
    'interventions',v_state->'interventions',
    'recommendations',v_state->'recommendations',
    'decision',v_state->'decision',
    'prediction',v_state->'prediction',
    'guardrails',v_state->'tutor'
  );
end;
$function$;

revoke execute on function public.student_get_twin_tutor_context_internal() from public,anon,authenticated;
grant execute on function public.student_get_twin_tutor_context() to authenticated,service_role;
alter function public.student_get_twin_tutor_context() set search_path = public, pg_temp;

commit;
