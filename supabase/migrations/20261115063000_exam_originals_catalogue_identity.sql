-- access: owner-only public.exam_original_assignment_series
-- authorization-test: public.exam_original_assignment_series scripts/test-exam-originals-activation.mjs
-- VibeSchool Exam Originals trusted product assignment metadata.
-- No new attempt engine. No direct authenticated write/read surface.
begin;
create table if not exists public.exam_original_assignment_series (
  assignment_id uuid primary key references public.assessment_assignments(id) on delete cascade,
  series_key text not null check (series_key in ('cat','try','term','papers','mock')),
  edition_year integer not null check (edition_year between 2024 and 2100),
  paper_number integer not null check (paper_number > 0),
  certified_by uuid not null references public.profiles(id),
  certified_at timestamptz not null default now(),
  unique (series_key,edition_year,paper_number,assignment_id)
);
alter table public.exam_original_assignment_series enable row level security;
revoke all on table public.exam_original_assignment_series from public, anon, authenticated;

create or replace function public.hq_certify_exam_original_assignment(
 p_assignment_id uuid, p_series_key text, p_edition_year integer, p_paper_number integer
) returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $fn$
declare
  v_aa public.assessment_assignments%rowtype;
  v_ad public.assessment_definitions%rowtype;
  v_count integer;
  v_bad integer;
begin
  if auth.uid() is null or not public.is_platform_owner() then
    raise exception 'owner_only_original_certification';
  end if;
  if p_series_key not in ('cat','try','term','papers','mock')
    or p_edition_year not between 2024 and 2100 or p_paper_number<=0
  then raise exception 'invalid_original_series'; end if;

  select * into v_aa from public.assessment_assignments where id=p_assignment_id for update;
  if not found or v_aa.status not in ('assigned','open') then raise exception 'assignment_not_open'; end if;
  select * into v_ad from public.assessment_definitions where id=v_aa.assessment_id;
  if not found or v_ad.status not in ('approved','open') then raise exception 'assessment_not_approved'; end if;

  if exists (select 1 from public.assessment_attempts at where at.assignment_id=v_aa.id) then
    raise exception 'cannot_rebrand_attempted_exam';
  end if;

  select count(*) into v_count from public.assessment_items ai
  where ai.assessment_id=v_ad.id and ai.status='approved';
  if (p_series_key='cat' and v_count<>30)
    or (p_series_key='try' and v_count not between 10 and 15)
    or (p_series_key in ('papers','term') and v_count<>50)
    or (p_series_key='mock' and v_count<10) then
    raise exception 'paper_item_count_mismatch';
  end if;

  select count(*) into v_bad
  from public.assessment_items ai
  where ai.assessment_id=v_ad.id and
    (ai.status<>'approved'
      or nullif(btrim(ai.prompt),'') is null
      or not exists (select 1 from public.assessment_item_outcomes aio
        where aio.assessment_item_id=ai.id)
      or (ai.auto_marking_mode<>'none' and ai.correct_answer is null)
      or (ai.auto_marking_mode='none' and not (
        coalesce(jsonb_typeof(ai.marking_guide->'criteria')='array',false)
        and case when jsonb_typeof(ai.marking_guide->'criteria')='array'
          then jsonb_array_length(ai.marking_guide->'criteria') between 1 and 20 else false end
        and not exists (
          select 1 from jsonb_array_elements(
            case when jsonb_typeof(ai.marking_guide->'criteria')='array'
              then ai.marking_guide->'criteria' else '[]'::jsonb end
          ) as guide(point)
          where jsonb_typeof(guide.point)<>'object'
             or jsonb_typeof(guide.point->'id')<>'string'
             or jsonb_typeof(guide.point->'label')<>'string'
             or jsonb_typeof(guide.point->'marks')<>'number'
             or coalesce((guide.point->>'marks')::numeric,0)<=0
        )))
      or (nullif(btrim(coalesce(ai.explanation,'')),'') is null
           and nullif(btrim(coalesce(ai.worked_solution,'')),'') is null));
  if v_bad>0 then raise exception 'paper_quality_gate_failed'; end if;

  insert into public.exam_original_assignment_series
    (assignment_id,series_key,edition_year,paper_number,certified_by,certified_at)
  values (v_aa.id,p_series_key,p_edition_year,p_paper_number,auth.uid(),now())
  on conflict (assignment_id) do update
    set series_key=excluded.series_key, edition_year=excluded.edition_year,
        paper_number=excluded.paper_number, certified_by=excluded.certified_by,
        certified_at=excluded.certified_at;
  return jsonb_build_object('ok',true,'assignment_id',v_aa.id,
    'series_key',p_series_key,'paper_number',p_paper_number);
end;
$fn$;
revoke all on function public.hq_certify_exam_original_assignment(uuid,text,integer,integer) from public, anon;
grant execute on function public.hq_certify_exam_original_assignment(uuid,text,integer,integer) to authenticated;

CREATE OR REPLACE FUNCTION public.exq_list_my_assignments()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  caller uuid:=auth.uid();
  learner public.students%rowtype;
  payload jsonb;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select s.* into learner from public.students s where s.profile_id=caller limit 1;
  if not found then raise exception 'learner_identity_not_found'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'assignment_id',aa.id,
    'assessment_id',ad.id,
    'title',ad.title,
    'original_product_series',eos.series_key,

    'assessment_type',ad.assessment_type,
    'instructions',ad.instructions,
    'assignment_status',aa.status,
    'opens_at',aa.opens_at,
    'closes_at',aa.closes_at,
    'time_limit_minutes',aa.time_limit_minutes,
    'max_attempts',aa.max_attempts,
    'show_score_policy',aa.show_score_policy,
    'attempt_id',at.id,
    'attempt_number',at.attempt_number,
    'attempt_status',at.status,
    'attempt_expires_at',at.expires_at,
    'result_status',at.result_status,
    'score',case when at.result_status='released' or (ad.assessment_type='practice' and aa.show_score_policy='immediate' and at.result_status='marked') then at.score else null end,
    'max_score',case when at.result_status='released' or (ad.assessment_type='practice' and aa.show_score_policy='immediate' and at.result_status='marked') then at.max_score else null end,
    'percentage',case when at.result_status='released' or (ad.assessment_type='practice' and aa.show_score_policy='immediate' and at.result_status='marked') then at.percentage else null end,
    'submitted_at',at.submitted_at,
    'can_start',(
      aa.status in ('assigned','open')
      and (aa.opens_at is null or aa.opens_at<=now())
      and (aa.closes_at is null or aa.closes_at>now())
      and (
        at.id is null
        or (at.status='in_progress' and (at.expires_at is null or at.expires_at>now()))
        or (at.status<>'in_progress' and at.attempt_number<aa.max_attempts)
      )
    ),
    'availability',case
      when aa.opens_at is not null and aa.opens_at>now() then 'upcoming'
      when aa.closes_at is not null and aa.closes_at<=now() then 'closed'
      when aa.status='closed' then 'closed'
      when at.status='in_progress' and at.expires_at is not null and at.expires_at<=now() then 'expired'
      when at.status='in_progress' then 'in_progress'
      when at.id is not null and at.attempt_number>=aa.max_attempts then 'attempts_exhausted'
      else 'available'
    end
  ) order by
    case when aa.closes_at is null then 1 else 0 end,
    aa.closes_at asc nulls last,
    aa.created_at desc),'[]'::jsonb)
  into payload
  from public.assessment_assignments aa
  join public.assessment_definitions ad on ad.id=aa.assessment_id
  left join public.student_classes sc on sc.class_id=aa.class_id and sc.student_id=learner.id and sc.is_current=true and sc.school_id=aa.school_id
  left join public.exam_original_assignment_series eos on eos.assignment_id=aa.id
  left join lateral (
    select a.* from public.assessment_attempts a
    where a.assignment_id=aa.id and a.student_id=learner.id
    order by a.attempt_number desc limit 1
  ) at on true
  where aa.status in ('assigned','open','closed')
    and ((aa.audience='class' and sc.student_id is not null)
      or (aa.audience='public_practice' and ad.assessment_type='practice'
        and ad.published_at is not null and aa.school_id is null and aa.class_id is null
        and public.exq_public_practice_eligible(aa.audience_grade)))
    and (aa.target_group_id is null or exists (
      select 1 from public.class_group_members cgm
      where cgm.group_id=aa.target_group_id and cgm.student_id=learner.id
    ));

  return jsonb_build_object('ok',true,'assignments',payload);
end;
$function$;

revoke all on function public.exq_list_my_assignments() from public, anon;
grant execute on function public.exq_list_my_assignments() to authenticated;
commit;
