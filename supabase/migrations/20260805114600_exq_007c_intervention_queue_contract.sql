begin;

create or replace function public.exq_list_intervention_queue(p_class_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); payload jsonb;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  perform public.exq_refresh_intervention_queue(p_class_id);
  select coalesce(jsonb_agg(jsonb_build_object(
    'intervention_id',iv.id,'student_id',iv.student_id,'student_name',s.name,
    'admission_number',s.admission_number,'class_id',iv.class_id,'class_name',c.name,
    'class_stream',c.stream,'subject_id',iv.subject_id,'subject_name',sub.name,
    'outcome_id',iv.outcome_id,'outcome_code',clo.outcome_code,'outcome_text',clo.outcome_text,
    'priority',iv.priority,'recommendation_type',iv.recommendation_type,
    'recommendation',iv.recommendation,'mastery_score',iv.mastery_score,
    'evidence_count',iv.evidence_count,'confidence_score',iv.confidence_score,
    'repeated_weakness_count',iv.repeated_weakness_count,'evidence_snapshot',iv.evidence_snapshot,
    'status',iv.status,'due_at',iv.due_at,'updated_at',iv.updated_at,
    'remedial_assessment_id',iv.remedial_assessment_id,'remedial_assignment_id',iv.remedial_assignment_id,
    'baseline_mastery_score',iv.baseline_mastery_score,'followup_mastery_score',iv.followup_mastery_score,
    'mastery_change',iv.mastery_change,'evaluated_at',iv.evaluated_at
  ) order by case iv.priority when 'urgent' then 0 when 'high' then 1 when 'medium' then 2 else 3 end,
    iv.due_at asc nulls last,iv.updated_at desc),'[]'::jsonb)
  into payload
  from public.assessment_interventions iv
  join public.students s on s.id=iv.student_id
  join public.classes c on c.id=iv.class_id
  left join public.subjects sub on sub.id=iv.subject_id
  join public.curriculum_learning_outcomes clo on clo.id=iv.outcome_id
  where iv.teacher_id=caller and iv.status in ('open','in_progress','escalated')
    and (p_class_id is null or iv.class_id=p_class_id);
  return jsonb_build_object('ok',true,'interventions',payload);
end;
$$;

create or replace function public.exq_update_intervention(
  p_intervention_id uuid,p_status text,p_completion_note text default null,p_due_at timestamptz default null
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); row_data public.assessment_interventions%rowtype;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if p_status not in ('open','in_progress','completed','dismissed','escalated') then raise exception 'invalid_intervention_status'; end if;
  select * into row_data from public.assessment_interventions where id=p_intervention_id for update;
  if not found then raise exception 'intervention_not_found'; end if;
  if row_data.teacher_id is distinct from caller then raise exception 'intervention_not_owned'; end if;
  if p_status='completed' and length(btrim(coalesce(p_completion_note,'')))<3 then raise exception 'completion_note_required'; end if;
  update public.assessment_interventions
  set status=p_status,
      completion_note=case when p_status='completed' then btrim(p_completion_note) else completion_note end,
      completed_at=case when p_status='completed' then now() when p_status in ('open','in_progress','escalated') then null else completed_at end,
      due_at=coalesce(p_due_at,due_at),updated_at=now()
  where id=p_intervention_id;
  return jsonb_build_object('ok',true,'intervention_id',p_intervention_id,'status',p_status);
end;
$$;

revoke all on function public.exq_list_intervention_queue(uuid) from public,anon;
revoke all on function public.exq_update_intervention(uuid,text,text,timestamptz) from public,anon;
grant execute on function public.exq_list_intervention_queue(uuid) to authenticated,service_role;
grant execute on function public.exq_update_intervention(uuid,text,text,timestamptz) to authenticated,service_role;

commit;
