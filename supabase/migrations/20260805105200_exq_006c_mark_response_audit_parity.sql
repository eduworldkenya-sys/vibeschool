begin;

create or replace function public.exq_mark_response(
  p_response_id uuid,
  p_teacher_score numeric,
  p_teacher_feedback text default null,
  p_override_reason text default null
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  caller uuid:=auth.uid(); ar public.assessment_responses%rowtype; at public.assessment_attempts%rowtype;
  aa public.assessment_assignments%rowtype; normalized_override text:=nullif(btrim(coalesce(p_override_reason,'')),'');
  event_kind text;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into ar from public.assessment_responses where id=p_response_id for update;
  if not found then raise exception 'response_not_found'; end if;
  select * into at from public.assessment_attempts where id=ar.attempt_id for update;
  if not found then raise exception 'attempt_not_found'; end if;
  select * into aa from public.assessment_assignments where id=at.assignment_id;
  if aa.teacher_id is distinct from caller then raise exception 'response_not_owned'; end if;
  if at.status='released' or at.result_status='released' then raise exception 'released_attempt_locked'; end if;
  if at.status not in ('teacher_review','marked','auto_marked') then raise exception 'attempt_not_markable'; end if;
  if p_teacher_score is null or p_teacher_score<0 or p_teacher_score>ar.max_score then raise exception 'invalid_score'; end if;
  if ar.auto_score is not null and p_teacher_score is distinct from ar.auto_score and normalized_override is null then raise exception 'override_reason_required'; end if;

  event_kind:=case when ar.auto_score is not null and p_teacher_score is distinct from ar.auto_score then 'teacher_override' else 'teacher_mark' end;

  update public.assessment_responses
  set teacher_score=p_teacher_score,final_score=p_teacher_score,
      teacher_feedback=nullif(btrim(coalesce(p_teacher_feedback,'')),''),
      teacher_override_reason=normalized_override,status='marked',marked_by=caller,marked_at=now(),updated_at=now()
  where id=p_response_id;

  insert into public.assessment_score_events(
    school_id,attempt_id,response_id,actor_id,event_type,previous_score,new_score,
    previous_feedback,new_feedback,reason,metadata
  ) values (
    at.school_id,at.id,ar.id,caller,event_kind,ar.final_score,p_teacher_score,
    ar.teacher_feedback,nullif(btrim(coalesce(p_teacher_feedback,'')),''),normalized_override,
    jsonb_build_object('auto_score',ar.auto_score,'max_score',ar.max_score)
  );

  update public.assessment_attempts set status='teacher_review',result_status='partially_marked',updated_at=now()
  where id=at.id and status<>'teacher_review';

  return jsonb_build_object('ok',true,'response_id',p_response_id,'score',p_teacher_score,'event_type',event_kind);
end;
$$;

revoke all on function public.exq_mark_response(uuid,numeric,text,text) from public,anon;
grant execute on function public.exq_mark_response(uuid,numeric,text,text) to authenticated,service_role;

commit;
