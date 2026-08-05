begin;

alter table public.assessment_definitions
  add column if not exists generation_status text not null default 'not_requested',
  add column if not exists generation_request_key text null,
  add column if not exists generation_attempt integer not null default 0,
  add column if not exists generation_started_at timestamptz null,
  add column if not exists generation_completed_at timestamptz null,
  add column if not exists generation_failed_at timestamptz null,
  add column if not exists generation_error_code text null,
  add column if not exists generation_error_message text null,
  add column if not exists source_lesson_updated_at timestamptz null,
  add column if not exists teacher_reviewed_at timestamptz null;

alter table public.assessment_definitions
  drop constraint if exists assessment_definitions_generation_status_chk,
  add constraint assessment_definitions_generation_status_chk
    check (generation_status in ('not_requested','queued','generating','generated','failed','cancelled')),
  drop constraint if exists assessment_definitions_generation_attempt_chk,
  add constraint assessment_definitions_generation_attempt_chk check (generation_attempt >= 0),
  drop constraint if exists assessment_definitions_generation_timestamps_chk,
  add constraint assessment_definitions_generation_timestamps_chk check (
    (generation_completed_at is null or generation_started_at is not null)
    and (generation_failed_at is null or generation_started_at is not null)
    and not (generation_completed_at is not null and generation_failed_at is not null)
  );

create index if not exists assessment_definitions_lesson_type_status_idx
  on public.assessment_definitions(lesson_plan_id, assessment_type, status, created_at desc)
  where lesson_plan_id is not null;

create unique index if not exists assessment_definitions_one_generated_working_draft_uidx
  on public.assessment_definitions(teacher_id, lesson_plan_id, assessment_type)
  where lesson_plan_id is not null
    and generation_source <> 'teacher_authored'
    and status in ('draft','review');

create unique index if not exists assessment_definitions_generation_request_key_uidx
  on public.assessment_definitions(teacher_id, generation_request_key)
  where generation_request_key is not null;

create policy assessment_sections_teacher_manage
on public.assessment_sections for all to authenticated
using (exists (
  select 1 from public.assessment_definitions ad
  where ad.id = assessment_sections.assessment_id
    and ad.teacher_id = (select auth.uid())
))
with check (exists (
  select 1 from public.assessment_definitions ad
  where ad.id = assessment_sections.assessment_id
    and ad.teacher_id = (select auth.uid())
));

create or replace function public.exq_list_lesson_assessments(p_lesson_plan_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); lp public.lesson_plans%rowtype; result jsonb;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into lp from public.lesson_plans where id=p_lesson_plan_id;
  if not found then raise exception 'lesson_plan_not_found'; end if;
  if lp.teacher_id is distinct from caller then raise exception 'lesson_plan_not_owned'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',ad.id,'assessment_type',ad.assessment_type,'title',ad.title,'status',ad.status,
    'generation_source',ad.generation_source,'generation_status',ad.generation_status,
    'generation_request_key',ad.generation_request_key,'generation_attempt',ad.generation_attempt,
    'generation_error_code',ad.generation_error_code,'total_marks',ad.total_marks,
    'estimated_minutes',ad.estimated_minutes,'created_at',ad.created_at,'updated_at',ad.updated_at
  ) order by ad.created_at desc),'[]'::jsonb) into result
  from public.assessment_definitions ad
  where ad.lesson_plan_id=lp.id and ad.teacher_id=caller and ad.status<>'archived';
  return jsonb_build_object('ok',true,'lesson_plan_id',lp.id,'lesson_status',lp.status,'assessments',result);
end;
$$;

create or replace function public.exq_request_lesson_assessment(
  p_lesson_plan_id uuid,p_assessment_type text,p_request_key text,
  p_title text default null,p_generation_metadata jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  caller uuid:=auth.uid(); lp public.lesson_plans%rowtype; existing public.assessment_definitions%rowtype;
  result_id uuid; normalized_type text:=lower(btrim(coalesce(p_assessment_type,'')));
  normalized_request_key text:=nullif(btrim(coalesce(p_request_key,'')),''); resolved_title text;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if normalized_type not in ('exercise','homework','quiz','test','exam') then raise exception 'unsupported_lesson_assessment_type'; end if;
  if normalized_request_key is null then raise exception 'generation_request_key_required'; end if;
  select * into lp from public.lesson_plans where id=p_lesson_plan_id for update;
  if not found then raise exception 'lesson_plan_not_found'; end if;
  if lp.teacher_id is distinct from caller then raise exception 'lesson_plan_not_owned'; end if;
  if lp.school_id is null then raise exception 'lesson_school_required'; end if;
  if not exists(select 1 from public.teacher_classes tc where tc.teacher_id=caller and tc.school_id=lp.school_id and tc.class_id=lp.class_id and tc.subject_id=lp.subject_id)
    then raise exception 'teacher_not_assigned'; end if;

  select * into existing from public.assessment_definitions ad
  where ad.teacher_id=caller and ad.generation_request_key=normalized_request_key limit 1;
  if found then
    if existing.lesson_plan_id is distinct from lp.id or existing.assessment_type is distinct from normalized_type then raise exception 'generation_request_key_conflict'; end if;
    return jsonb_build_object('ok',true,'created',false,'assessment_id',existing.id,'status',existing.status,'generation_status',existing.generation_status);
  end if;

  select * into existing from public.assessment_definitions ad
  where ad.teacher_id=caller and ad.lesson_plan_id=lp.id and ad.assessment_type=normalized_type
    and ad.generation_source<>'teacher_authored' and ad.status in ('draft','review')
  order by ad.created_at desc limit 1;
  if found then return jsonb_build_object('ok',true,'created',false,'assessment_id',existing.id,'status',existing.status,'generation_status',existing.generation_status); end if;

  resolved_title:=coalesce(nullif(btrim(coalesce(p_title,'')),''),case normalized_type
    when 'exercise' then 'Exercise — '||coalesce(nullif(btrim(lp.title),''),'Lesson')
    when 'quiz' then 'Quiz — '||coalesce(nullif(btrim(lp.title),''),'Lesson')
    when 'homework' then 'Homework — '||coalesce(nullif(btrim(lp.title),''),'Lesson')
    when 'test' then 'CAT — '||coalesce(nullif(btrim(lp.title),''),'Lesson')
    when 'exam' then 'Exam — '||coalesce(nullif(btrim(lp.title),''),'Lesson') end);

  insert into public.assessment_definitions(
    school_id,teacher_id,class_id,subject_id,lesson_plan_id,assessment_type,title,status,
    generation_source,generation_metadata,generation_status,generation_request_key,generation_attempt,source_lesson_updated_at
  ) values(
    lp.school_id,caller,lp.class_id,lp.subject_id,lp.id,normalized_type,resolved_title,'draft','lesson_generator',
    jsonb_build_object('schema_version',1,'generator','lesson_assessment_generator','requested_type',normalized_type,
      'lesson_snapshot',jsonb_build_object('lesson_plan_id',lp.id,'lesson_updated_at',lp.updated_at,'title',lp.title,
      'topic',lp.topic,'objectives',lp.objectives,'competencies',to_jsonb(lp.competencies),'activities',coalesce(lp.activities,'null'::jsonb)))
      ||coalesce(p_generation_metadata,'{}'::jsonb),
    'queued',normalized_request_key,0,lp.updated_at
  ) returning id into result_id;
  return jsonb_build_object('ok',true,'created',true,'assessment_id',result_id,'status','draft','generation_status','queued');
exception when unique_violation then
  select * into existing from public.assessment_definitions ad
  where ad.teacher_id=caller and ad.lesson_plan_id=lp.id and ad.assessment_type=normalized_type
    and ad.generation_source<>'teacher_authored' and ad.status in ('draft','review')
  order by ad.created_at desc limit 1;
  if found then return jsonb_build_object('ok',true,'created',false,'assessment_id',existing.id,'status',existing.status,'generation_status',existing.generation_status); end if;
  raise;
end;
$$;

revoke all on function public.exq_list_lesson_assessments(uuid) from public,anon;
revoke all on function public.exq_request_lesson_assessment(uuid,text,text,text,jsonb) from public,anon;
grant execute on function public.exq_list_lesson_assessments(uuid) to authenticated,service_role;
grant execute on function public.exq_request_lesson_assessment(uuid,text,text,text,jsonb) to authenticated,service_role;

comment on function public.exq_list_lesson_assessments(uuid) is 'Lists the authenticated lesson owner''s non-archived assessments for one lesson plan.';
comment on function public.exq_request_lesson_assessment(uuid,text,text,text,jsonb) is 'Idempotently reserves one generated working draft per teacher, lesson and assessment type.';

commit;
