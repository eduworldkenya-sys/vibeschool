begin;

alter table public.report_card_subjects
  add column if not exists achievement_summary text null,
  add column if not exists strengths_summary text null,
  add column if not exists support_summary text null,
  add column if not exists recommended_next_steps text null,
  add column if not exists parent_guidance text null,
  add column if not exists generated_comment text null,
  add column if not exists generated_comment_evidence jsonb not null default '[]'::jsonb,
  add column if not exists generated_at timestamptz null;

create or replace function public.exq_generate_subject_report_intelligence(p_report_card_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller uuid:=auth.uid();
  rc public.report_cards%rowtype;
  row_count integer:=0;
  rcs public.report_card_subjects%rowtype;
  assessment_count integer;
  mastery_count integer;
  homework_assigned integer;
  homework_submitted integer;
  lessons_completed integer;
  intervention_count integer;
  strongest_text text;
  support_text text;
  achievement text;
  strengths text;
  support text;
  next_steps text;
  parent_help text;
  draft_comment text;
  evidence_links jsonb;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into rc from public.report_cards where id=p_report_card_id for update;
  if not found then raise exception 'report_card_not_found'; end if;
  if rc.teacher_id is distinct from caller then raise exception 'report_card_not_owned'; end if;
  if rc.status not in ('draft','returned') then raise exception 'report_card_not_editable'; end if;
  if rc.completeness_status not in ('complete','incomplete') then raise exception 'report_card_evidence_not_generated'; end if;

  for rcs in select * from public.report_card_subjects where report_card_id=rc.id order by subject_id
  loop
    assessment_count:=coalesce((rcs.evidence_snapshot->>'assessment_count')::integer,0);
    mastery_count:=coalesce((rcs.evidence_snapshot->>'mastery_evidence_count')::integer,0);
    homework_assigned:=coalesce((rcs.evidence_snapshot->>'homework_assigned')::integer,0);
    homework_submitted:=coalesce((rcs.evidence_snapshot->>'homework_submitted')::integer,0);
    lessons_completed:=coalesce((rcs.evidence_snapshot->>'lessons_completed')::integer,0);
    intervention_count:=jsonb_array_length(coalesce(rcs.intervention_summary,'[]'::jsonb));

    select string_agg(coalesce(value->>'outcome_text',value->>'outcome_code','outcome'),', ' order by ord)
    into strongest_text
    from jsonb_array_elements(coalesce(rcs.strongest_outcomes,'[]'::jsonb)) with ordinality as x(value,ord)
    where ord<=3;

    select string_agg(coalesce(value->>'outcome_text',value->>'outcome_code','outcome'),', ' order by ord)
    into support_text
    from jsonb_array_elements(coalesce(rcs.support_outcomes,'[]'::jsonb)) with ordinality as x(value,ord)
    where ord<=3;

    achievement:=case
      when rcs.assessment_average is null and rcs.mastery_average is null then 'There is not yet enough released evidence to make a secure achievement judgement.'
      when coalesce(rcs.assessment_average,rcs.mastery_average)>=80 then 'Performance is consistently strong across the available term evidence.'
      when coalesce(rcs.assessment_average,rcs.mastery_average)>=60 then 'Performance is secure overall, with evidence of steady progress.'
      when coalesce(rcs.assessment_average,rcs.mastery_average)>=40 then 'Performance is developing and requires continued guided practice.'
      else 'Performance remains below the expected level and requires focused support.' end;

    strengths:=case
      when nullif(strongest_text,'') is not null then 'Strongest demonstrated outcomes: '||strongest_text||'.'
      when coalesce(rcs.growth_percentage,0)>0 then 'The learner has shown measurable improvement during the term.'
      else 'No stable strength has yet been confirmed by enough evidence.' end;

    support:=case
      when nullif(support_text,'') is not null then 'Priority support outcomes: '||support_text||'.'
      when intervention_count>0 then 'Existing intervention evidence should continue to guide targeted support.'
      when coalesce(rcs.assessment_average,100)<60 or coalesce(rcs.mastery_average,100)<60 then 'Further guided practice is required to secure the core outcomes.'
      else 'No major support gap is currently indicated by the available evidence.' end;

    next_steps:=case
      when intervention_count>0 then 'Continue the active support plan, use guided correction, and collect follow-up evidence before closing the intervention.'
      when coalesce(rcs.assessment_average,100)<50 or coalesce(rcs.mastery_average,100)<50 then 'Reteach the weakest outcomes using a different representation, then assign short targeted practice and reassess.'
      when coalesce(rcs.assessment_average,100)<70 or coalesce(rcs.mastery_average,100)<70 then 'Use guided practice and spaced revision to strengthen accuracy and independence.'
      else 'Provide extension tasks that apply the secure outcomes in unfamiliar contexts.' end;

    parent_help:=case
      when coalesce(rcs.assessment_average,100)<60 or coalesce(rcs.mastery_average,100)<60 then 'At home, practise the named support outcomes in short sessions and ask the learner to explain each step aloud.'
      else 'At home, encourage regular independent practice and discussion of how the learning applies in everyday situations.' end;

    draft_comment:=concat_ws(' ',achievement,strengths,support,next_steps);
    evidence_links:=jsonb_build_array(
      jsonb_build_object('type','assessment_summary','count',assessment_count,'average',rcs.assessment_average),
      jsonb_build_object('type','mastery_summary','count',mastery_count,'average',rcs.mastery_average,'growth',rcs.growth_percentage),
      jsonb_build_object('type','homework_summary','assigned',homework_assigned,'submitted',homework_submitted),
      jsonb_build_object('type','lesson_summary','completed',lessons_completed),
      jsonb_build_object('type','intervention_summary','count',intervention_count),
      jsonb_build_object('type','strongest_outcomes','items',coalesce(rcs.strongest_outcomes,'[]'::jsonb)),
      jsonb_build_object('type','support_outcomes','items',coalesce(rcs.support_outcomes,'[]'::jsonb))
    );

    update public.report_card_subjects
    set achievement_summary=achievement,
        strengths_summary=strengths,
        support_summary=support,
        recommended_next_steps=next_steps,
        parent_guidance=parent_help,
        generated_comment=draft_comment,
        generated_comment_evidence=evidence_links,
        generated_at=now(),
        teacher_comment=coalesce(nullif(btrim(teacher_comment),''),draft_comment),
        updated_at=now()
    where id=rcs.id;
    row_count:=row_count+1;
  end loop;

  return jsonb_build_object('ok',true,'report_card_id',rc.id,'subjects_generated',row_count);
end;
$$;

create or replace function public.exq_update_subject_report(
  p_report_card_subject_id uuid,
  p_teacher_comment text,
  p_parent_guidance text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller uuid:=auth.uid();
  rcs public.report_card_subjects%rowtype;
  rc public.report_cards%rowtype;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into rcs from public.report_card_subjects where id=p_report_card_subject_id for update;
  if not found then raise exception 'report_card_subject_not_found'; end if;
  select * into rc from public.report_cards where id=rcs.report_card_id;
  if rc.teacher_id is distinct from caller or rcs.teacher_id is distinct from caller then raise exception 'report_card_subject_not_owned'; end if;
  if rc.status not in ('draft','returned') then raise exception 'report_card_not_editable'; end if;
  if nullif(btrim(coalesce(p_teacher_comment,'')),'') is null then raise exception 'teacher_comment_required'; end if;

  update public.report_card_subjects
  set teacher_comment=btrim(p_teacher_comment),
      parent_guidance=coalesce(nullif(btrim(coalesce(p_parent_guidance,'')),''),parent_guidance),
      updated_at=now()
  where id=rcs.id;

  return jsonb_build_object('ok',true,'report_card_subject_id',rcs.id);
end;
$$;

create or replace function public.exq_publish_report_card(p_report_card_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller uuid:=auth.uid();
  rc public.report_cards%rowtype;
  allowed boolean;
  latest_snapshot public.report_card_evidence_snapshots%rowtype;
  frozen_payload jsonb;
  subject_payload jsonb;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into rc from public.report_cards where id=p_report_card_id for update;
  if not found then raise exception 'report_card_not_found'; end if;
  select exists(select 1 from public.school_members sm where sm.school_id=rc.school_id and sm.profile_id=caller and sm.role in ('owner','admin')) into allowed;
  if not allowed then raise exception 'publisher_not_authorized'; end if;
  if rc.status<>'approved' then raise exception 'report_card_not_approved'; end if;
  if rc.completeness_status<>'complete' then raise exception 'report_card_evidence_incomplete'; end if;

  select * into latest_snapshot from public.report_card_evidence_snapshots
  where report_card_id=rc.id order by version desc limit 1 for update;
  if not found then raise exception 'report_card_snapshot_missing'; end if;
  if latest_snapshot.completeness_status<>'complete' then raise exception 'report_card_snapshot_incomplete'; end if;
  if exists(select 1 from public.report_card_subjects where report_card_id=rc.id and nullif(btrim(coalesce(teacher_comment,'')),'') is null) then raise exception 'subject_comments_missing'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'report_card_subject_id',rcs.id,'subject_id',rcs.subject_id,'teacher_id',rcs.teacher_id,
    'assessment_average',rcs.assessment_average,'mastery_average',rcs.mastery_average,
    'growth_percentage',rcs.growth_percentage,'strongest_outcomes',rcs.strongest_outcomes,
    'support_outcomes',rcs.support_outcomes,'intervention_summary',rcs.intervention_summary,
    'achievement_summary',rcs.achievement_summary,'strengths_summary',rcs.strengths_summary,
    'support_summary',rcs.support_summary,'recommended_next_steps',rcs.recommended_next_steps,
    'parent_guidance',rcs.parent_guidance,'generated_comment',rcs.generated_comment,
    'generated_comment_evidence',rcs.generated_comment_evidence,'teacher_comment',rcs.teacher_comment,
    'evidence_snapshot',rcs.evidence_snapshot
  ) order by rcs.subject_id),'[]'::jsonb)
  into subject_payload
  from public.report_card_subjects rcs where rcs.report_card_id=rc.id;

  frozen_payload:=jsonb_build_object(
    'report_card',to_jsonb(rc)-'generated_snapshot',
    'evidence',latest_snapshot.snapshot,
    'subject_reports',subject_payload,
    'published_by',caller,
    'published_at',now(),
    'evidence_version',latest_snapshot.version
  );

  update public.report_card_evidence_snapshots set completeness_status='frozen',frozen_at=now() where id=latest_snapshot.id;
  update public.report_cards set status='published',generated_snapshot=frozen_payload,published_at=now(),completeness_status='frozen',updated_at=now() where id=rc.id;

  return jsonb_build_object('ok',true,'report_card_id',rc.id,'status','published','evidence_version',latest_snapshot.version);
end;
$$;

revoke all on function public.exq_generate_subject_report_intelligence(uuid) from public,anon;
revoke all on function public.exq_update_subject_report(uuid,text,text) from public,anon;
revoke all on function public.exq_publish_report_card(uuid) from public,anon;
grant execute on function public.exq_generate_subject_report_intelligence(uuid) to authenticated,service_role;
grant execute on function public.exq_update_subject_report(uuid,text,text) to authenticated,service_role;
grant execute on function public.exq_publish_report_card(uuid) to authenticated,service_role;

commit;
