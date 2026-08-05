begin;

alter table public.report_cards
  add column if not exists evidence_generated_at timestamptz null,
  add column if not exists evidence_version integer not null default 1,
  add column if not exists completeness_status text not null default 'not_generated',
  add column if not exists completeness_issues jsonb not null default '[]'::jsonb;

alter table public.report_cards
  drop constraint if exists report_cards_completeness_status_chk,
  add constraint report_cards_completeness_status_chk
    check (completeness_status in ('not_generated','incomplete','complete','frozen'));

create table if not exists public.report_card_evidence_snapshots (
  id uuid primary key default gen_random_uuid(),
  report_card_id uuid not null references public.report_cards(id) on delete cascade,
  version integer not null,
  generated_by uuid not null references auth.users(id) on delete restrict,
  generated_at timestamptz not null default now(),
  term_start date not null,
  term_end date not null,
  snapshot jsonb not null,
  completeness_status text not null,
  completeness_issues jsonb not null default '[]'::jsonb,
  frozen_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint report_card_evidence_snapshots_status_chk check (completeness_status in ('incomplete','complete','frozen')),
  constraint report_card_evidence_snapshots_version_chk check (version > 0),
  constraint report_card_evidence_snapshots_dates_chk check (term_end >= term_start),
  unique(report_card_id,version)
);

create index if not exists report_card_evidence_snapshots_report_idx
  on public.report_card_evidence_snapshots(report_card_id,version desc);

alter table public.report_card_evidence_snapshots enable row level security;

drop policy if exists report_card_evidence_snapshots_read on public.report_card_evidence_snapshots;
create policy report_card_evidence_snapshots_read
on public.report_card_evidence_snapshots
for select to authenticated
using (
  exists (
    select 1 from public.report_cards rc
    where rc.id=report_card_evidence_snapshots.report_card_id
      and (
        rc.teacher_id=(select auth.uid())
        or exists (
          select 1 from public.school_members sm
          where sm.school_id=rc.school_id
            and sm.profile_id=(select auth.uid())
            and sm.role in ('owner','admin')
        )
      )
  )
);

create or replace function public.exq_generate_report_card_evidence(p_report_card_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller uuid:=auth.uid();
  rc public.report_cards%rowtype;
  term_row public.academic_terms%rowtype;
  next_version integer;
  subject_row record;
  subject_count integer:=0;
  missing_subjects integer:=0;
  issue_list jsonb:='[]'::jsonb;
  report_snapshot jsonb;
  snapshot_id uuid;
  attendance_payload jsonb;
  lesson_payload jsonb;
  homework_payload jsonb;
  subject_payload jsonb;
  overall_assessment numeric;
  overall_mastery numeric;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into rc from public.report_cards where id=p_report_card_id for update;
  if not found then raise exception 'report_card_not_found'; end if;
  if rc.teacher_id is distinct from caller then raise exception 'report_card_not_owned'; end if;
  if rc.status not in ('draft','returned') then raise exception 'report_card_not_refreshable'; end if;

  select * into term_row from public.academic_terms where id=rc.term_id;
  if not found then raise exception 'term_not_found'; end if;
  if term_row.school_id is distinct from rc.school_id then raise exception 'term_school_mismatch'; end if;

  for subject_row in
    select distinct tc.subject_id,coalesce(s.name,'Subject') subject_name
    from public.teacher_classes tc
    left join public.subjects s on s.id=tc.subject_id
    where tc.teacher_id=caller
      and tc.school_id=rc.school_id
      and tc.class_id=rc.class_id
      and tc.subject_id is not null
      and coalesce(tc.is_active,true)=true
  loop
    subject_count:=subject_count+1;

    insert into public.report_card_subjects(
      report_card_id,subject_id,teacher_id,assessment_average,mastery_average,
      growth_percentage,strongest_outcomes,support_outcomes,intervention_summary,
      evidence_snapshot,updated_at
    )
    select
      rc.id,subject_row.subject_id,caller,
      assessment_stats.assessment_average,
      mastery_stats.mastery_average,
      mastery_stats.growth_percentage,
      coalesce(mastery_stats.strongest_outcomes,'[]'::jsonb),
      coalesce(mastery_stats.support_outcomes,'[]'::jsonb),
      coalesce(intervention_stats.intervention_summary,'[]'::jsonb),
      jsonb_build_object(
        'subject_id',subject_row.subject_id,
        'subject_name',subject_row.subject_name,
        'term_start',term_row.start_date,
        'term_end',term_row.end_date,
        'released_assessments',coalesce(assessment_stats.released_assessments,'[]'::jsonb),
        'assessment_count',coalesce(assessment_stats.assessment_count,0),
        'mastery',coalesce(mastery_stats.mastery_items,'[]'::jsonb),
        'mastery_evidence_count',coalesce(mastery_stats.mastery_evidence_count,0),
        'interventions',coalesce(intervention_stats.intervention_summary,'[]'::jsonb),
        'homework',coalesce(homework_stats.homework_items,'[]'::jsonb),
        'homework_assigned',coalesce(homework_stats.homework_assigned,0),
        'homework_submitted',coalesce(homework_stats.homework_submitted,0),
        'lessons',coalesce(lesson_stats.lesson_items,'[]'::jsonb),
        'lessons_completed',coalesce(lesson_stats.lessons_completed,0)
      ),now()
    from lateral (
      select round(avg(at.percentage),2) assessment_average,
        count(*) assessment_count,
        coalesce(jsonb_agg(jsonb_build_object(
          'attempt_id',at.id,'assessment_id',ad.id,'title',ad.title,
          'assessment_type',ad.assessment_type,'percentage',at.percentage,
          'released_at',at.released_at
        ) order by at.released_at,at.id),'[]'::jsonb) released_assessments
      from public.assessment_attempts at
      join public.assessment_assignments aa on aa.id=at.assignment_id
      join public.assessment_definitions ad on ad.id=at.assessment_id
      where at.student_id=rc.student_id
        and at.class_id=rc.class_id
        and at.school_id=rc.school_id
        and ad.subject_id=subject_row.subject_id
        and at.status='released'
        and at.result_status='released'
        and at.released_at::date between term_row.start_date and term_row.end_date
    ) assessment_stats
    cross join lateral (
      select round(avg(som.mastery_score),2) mastery_average,
        round(avg(case when first_last.first_score is not null and first_last.last_score is not null then first_last.last_score-first_last.first_score end),2) growth_percentage,
        count(*) mastery_evidence_count,
        coalesce(jsonb_agg(jsonb_build_object(
          'outcome_id',clo.id,'outcome_code',clo.outcome_code,'outcome_text',clo.outcome_text,
          'mastery_level',som.mastery_level,'mastery_score',som.mastery_score,
          'evidence_count',som.evidence_count,'last_evidence_at',som.last_evidence_at
        ) order by som.mastery_score desc nulls last),'[]'::jsonb) mastery_items,
        coalesce(jsonb_agg(jsonb_build_object(
          'outcome_id',clo.id,'outcome_code',clo.outcome_code,'outcome_text',clo.outcome_text,
          'mastery_score',som.mastery_score
        ) order by som.mastery_score desc) filter(where som.mastery_score>=80),'[]'::jsonb) strongest_outcomes,
        coalesce(jsonb_agg(jsonb_build_object(
          'outcome_id',clo.id,'outcome_code',clo.outcome_code,'outcome_text',clo.outcome_text,
          'mastery_score',som.mastery_score
        ) order by som.mastery_score asc) filter(where som.mastery_score<60),'[]'::jsonb) support_outcomes
      from public.student_outcome_mastery som
      join public.curriculum_learning_outcomes clo on clo.id=som.outcome_id
      join lateral (
        select
          (array_agg(round((cel.score/nullif(cel.max_score,0))*100,2) order by cel.observed_at asc))[1] first_score,
          (array_agg(round((cel.score/nullif(cel.max_score,0))*100,2) order by cel.observed_at desc))[1] last_score
        from public.competency_evidence_ledger cel
        where cel.student_id=som.student_id
          and cel.outcome_id=som.outcome_id
          and cel.subject_id=subject_row.subject_id
          and cel.observed_at::date between term_row.start_date and term_row.end_date
          and cel.score is not null and cel.max_score>0
      ) first_last on true
      where som.student_id=rc.student_id
        and exists (
          select 1 from public.competency_evidence_ledger cel
          where cel.student_id=som.student_id
            and cel.outcome_id=som.outcome_id
            and cel.subject_id=subject_row.subject_id
            and cel.observed_at::date between term_row.start_date and term_row.end_date
        )
    ) mastery_stats
    cross join lateral (
      select coalesce(jsonb_agg(jsonb_build_object(
        'intervention_id',ai.id,'priority',ai.priority,
        'recommendation_type',ai.recommendation_type,'status',ai.status,
        'baseline_mastery_score',ai.baseline_mastery_score,
        'followup_mastery_score',ai.followup_mastery_score,
        'mastery_change',ai.mastery_change,'completed_at',ai.completed_at
      ) order by ai.created_at),'[]'::jsonb) intervention_summary
      from public.assessment_interventions ai
      where ai.student_id=rc.student_id
        and ai.class_id=rc.class_id
        and ai.subject_id=subject_row.subject_id
        and ai.created_at::date between term_row.start_date and term_row.end_date
    ) intervention_stats
    cross join lateral (
      select count(distinct h.id) homework_assigned,
        count(distinct hs.id) filter(where hs.id is not null) homework_submitted,
        coalesce(jsonb_agg(distinct jsonb_build_object(
          'homework_id',h.id,'title',h.title,'due_date',h.due_date,
          'submission_status',hs.status,'mark',hs.mark,'submitted_at',hs.submitted_at
        )) filter(where h.id is not null),'[]'::jsonb) homework_items
      from public.homework h
      left join public.homework_submissions hs on hs.homework_id=h.id and hs.student_id=rc.student_id
      where h.class_id=rc.class_id
        and h.school_id=rc.school_id
        and lower(coalesce(h.subject,''))=lower(subject_row.subject_name)
        and coalesce(h.due_date,h.created_at::date) between term_row.start_date and term_row.end_date
    ) homework_stats
    cross join lateral (
      select count(*) filter(where coalesce(tocc.lifecycle,lp.status) in ('completed','taught','done')) lessons_completed,
        coalesce(jsonb_agg(jsonb_build_object(
          'lesson_plan_id',lp.id,'title',lp.title,'topic',lp.topic,
          'taught_date',lp.taught_date,'status',coalesce(tocc.lifecycle,lp.status),
          'reflection',lp.reflection,'participation_score',lp.participation_score
        ) order by lp.taught_date,lp.id),'[]'::jsonb) lesson_items
      from public.lesson_plans lp
      left join public.teaching_occurrences tocc on tocc.id=lp.teaching_occurrence_id
      where lp.class_id=rc.class_id
        and lp.subject_id=subject_row.subject_id
        and lp.taught_date between term_row.start_date and term_row.end_date
    ) lesson_stats
    on conflict (report_card_id,subject_id)
    do update set
      teacher_id=excluded.teacher_id,
      assessment_average=excluded.assessment_average,
      mastery_average=excluded.mastery_average,
      growth_percentage=excluded.growth_percentage,
      strongest_outcomes=excluded.strongest_outcomes,
      support_outcomes=excluded.support_outcomes,
      intervention_summary=excluded.intervention_summary,
      evidence_snapshot=excluded.evidence_snapshot,
      updated_at=now();
  end loop;

  if subject_count=0 then
    issue_list:=issue_list||jsonb_build_array(jsonb_build_object(
      'code','no_teacher_subjects',
      'message','No active teacher subject assignments were found for this class.'
    ));
  end if;

  select count(*) into missing_subjects
  from public.report_card_subjects rcs
  where rcs.report_card_id=rc.id
    and coalesce((rcs.evidence_snapshot->>'assessment_count')::integer,0)=0
    and coalesce((rcs.evidence_snapshot->>'mastery_evidence_count')::integer,0)=0
    and coalesce((rcs.evidence_snapshot->>'homework_assigned')::integer,0)=0
    and coalesce((rcs.evidence_snapshot->>'lessons_completed')::integer,0)=0;

  if missing_subjects>0 then
    issue_list:=issue_list||jsonb_build_array(jsonb_build_object(
      'code','subjects_without_evidence',
      'message',missing_subjects||' subject(s) have no term evidence.',
      'count',missing_subjects
    ));
  end if;

  select jsonb_build_object(
    'present',count(*) filter(where a.status='present'),
    'absent',count(*) filter(where a.status='absent'),
    'late',count(*) filter(where a.is_late=true),
    'total_marked',count(*),
    'attendance_rate',case when count(*)>0 then round((count(*) filter(where a.status='present'))::numeric/count(*)*100,2) else null end
  ) into attendance_payload
  from public.attendance a
  where a.student_id=rc.student_id and a.class_id=rc.class_id
    and a.date between term_row.start_date and term_row.end_date;

  select jsonb_build_object(
    'completed_lessons',count(*) filter(where lifecycle='completed'),
    'planned_lessons',count(*) filter(where lifecycle='planned'),
    'cancelled_lessons',count(*) filter(where lifecycle='cancelled')
  ) into lesson_payload
  from public.teaching_occurrences
  where class_id=rc.class_id and occurrence_date between term_row.start_date and term_row.end_date;

  select jsonb_build_object(
    'assigned',count(distinct h.id),
    'submitted',count(distinct hs.id),
    'marked',count(distinct hs.id) filter(where hs.mark is not null)
  ) into homework_payload
  from public.homework h
  left join public.homework_submissions hs on hs.homework_id=h.id and hs.student_id=rc.student_id
  where h.class_id=rc.class_id and h.school_id=rc.school_id
    and coalesce(h.due_date,h.created_at::date) between term_row.start_date and term_row.end_date;

  select coalesce(jsonb_agg(jsonb_build_object(
    'report_card_subject_id',rcs.id,'subject_id',rcs.subject_id,
    'subject_name',coalesce(s.name,'Subject'),
    'assessment_average',rcs.assessment_average,
    'mastery_average',rcs.mastery_average,
    'growth_percentage',rcs.growth_percentage,
    'strongest_outcomes',rcs.strongest_outcomes,
    'support_outcomes',rcs.support_outcomes,
    'intervention_summary',rcs.intervention_summary,
    'teacher_comment',rcs.teacher_comment,
    'evidence_snapshot',rcs.evidence_snapshot
  ) order by coalesce(s.name,''),rcs.subject_id),'[]'::jsonb),
  round(avg(rcs.assessment_average),2),round(avg(rcs.mastery_average),2)
  into subject_payload,overall_assessment,overall_mastery
  from public.report_card_subjects rcs
  left join public.subjects s on s.id=rcs.subject_id
  where rcs.report_card_id=rc.id;

  report_snapshot:=jsonb_build_object(
    'schema_version',1,
    'report_card_id',rc.id,
    'student_id',rc.student_id,
    'class_id',rc.class_id,
    'term',jsonb_build_object(
      'id',term_row.id,'name',term_row.name,'academic_year',term_row.academic_year,
      'start_date',term_row.start_date,'end_date',term_row.end_date
    ),
    'generated_by',caller,
    'generated_at',now(),
    'summary',jsonb_build_object(
      'overall_assessment_average',overall_assessment,
      'overall_mastery_average',overall_mastery,
      'subject_count',subject_count
    ),
    'attendance',coalesce(attendance_payload,'{}'::jsonb),
    'lesson_delivery',coalesce(lesson_payload,'{}'::jsonb),
    'homework',coalesce(homework_payload,'{}'::jsonb),
    'subjects',coalesce(subject_payload,'[]'::jsonb)
  );

  select coalesce(max(version),0)+1 into next_version
  from public.report_card_evidence_snapshots
  where report_card_id=rc.id;

  insert into public.report_card_evidence_snapshots(
    report_card_id,version,generated_by,term_start,term_end,snapshot,
    completeness_status,completeness_issues
  ) values (
    rc.id,next_version,caller,term_row.start_date,term_row.end_date,report_snapshot,
    case when jsonb_array_length(issue_list)=0 then 'complete' else 'incomplete' end,
    issue_list
  ) returning id into snapshot_id;

  update public.report_cards
  set generated_snapshot=report_snapshot,
      evidence_generated_at=now(),
      evidence_version=next_version,
      completeness_status=case when jsonb_array_length(issue_list)=0 then 'complete' else 'incomplete' end,
      completeness_issues=issue_list,
      updated_at=now()
  where id=rc.id;

  return jsonb_build_object(
    'ok',true,'report_card_id',rc.id,'snapshot_id',snapshot_id,
    'evidence_version',next_version,
    'completeness_status',case when jsonb_array_length(issue_list)=0 then 'complete' else 'incomplete' end,
    'issues',issue_list,'subject_count',subject_count
  );
end;
$$;

create or replace function public.exq_get_report_card_evidence(p_report_card_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller uuid:=auth.uid();
  rc public.report_cards%rowtype;
  snapshot_row public.report_card_evidence_snapshots%rowtype;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into rc from public.report_cards where id=p_report_card_id;
  if not found then raise exception 'report_card_not_found'; end if;
  if rc.teacher_id is distinct from caller and not exists (
    select 1 from public.school_members sm
    where sm.school_id=rc.school_id and sm.profile_id=caller and sm.role in ('owner','admin')
  ) then raise exception 'report_card_not_authorized'; end if;

  select * into snapshot_row
  from public.report_card_evidence_snapshots
  where report_card_id=rc.id
  order by version desc
  limit 1;

  return jsonb_build_object(
    'ok',true,'report_card_id',rc.id,'status',rc.status,
    'completeness_status',rc.completeness_status,
    'completeness_issues',rc.completeness_issues,
    'evidence_version',rc.evidence_version,
    'evidence_generated_at',rc.evidence_generated_at,
    'snapshot',coalesce(snapshot_row.snapshot,rc.generated_snapshot,'{}'::jsonb)
  );
end;
$$;

create or replace function public.exq_submit_report_card(
  p_report_card_id uuid,
  p_overall_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller uuid:=auth.uid();
  rc public.report_cards%rowtype;
  missing_comments integer;
  subject_rows integer;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into rc from public.report_cards where id=p_report_card_id for update;
  if not found then raise exception 'report_card_not_found'; end if;
  if rc.teacher_id is distinct from caller then raise exception 'report_card_not_owned'; end if;
  if rc.status not in ('draft','returned') then raise exception 'report_card_not_submittable'; end if;
  if rc.completeness_status<>'complete' then raise exception 'report_card_evidence_incomplete'; end if;

  select count(*),count(*) filter(where nullif(btrim(coalesce(teacher_comment,'')),'') is null)
  into subject_rows,missing_comments
  from public.report_card_subjects where report_card_id=rc.id;
  if subject_rows=0 then raise exception 'report_card_subjects_missing'; end if;
  if missing_comments>0 then raise exception 'subject_comments_missing'; end if;

  update public.report_cards
  set status='review',overall_comment=nullif(btrim(coalesce(p_overall_comment,'')),''),
      submitted_at=now(),updated_at=now()
  where id=rc.id;

  return jsonb_build_object('ok',true,'report_card_id',rc.id,'status','review');
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
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into rc from public.report_cards where id=p_report_card_id for update;
  if not found then raise exception 'report_card_not_found'; end if;
  select exists(
    select 1 from public.school_members sm
    where sm.school_id=rc.school_id and sm.profile_id=caller and sm.role in ('owner','admin')
  ) into allowed;
  if not allowed then raise exception 'publisher_not_authorized'; end if;
  if rc.status<>'approved' then raise exception 'report_card_not_approved'; end if;
  if rc.completeness_status<>'complete' then raise exception 'report_card_evidence_incomplete'; end if;

  select * into latest_snapshot
  from public.report_card_evidence_snapshots
  where report_card_id=rc.id order by version desc limit 1 for update;
  if not found then raise exception 'report_card_snapshot_missing'; end if;
  if latest_snapshot.completeness_status<>'complete' then raise exception 'report_card_snapshot_incomplete'; end if;

  frozen_payload:=jsonb_build_object(
    'report_card',to_jsonb(rc)-'generated_snapshot',
    'evidence',latest_snapshot.snapshot,
    'published_by',caller,
    'published_at',now(),
    'evidence_version',latest_snapshot.version
  );

  update public.report_card_evidence_snapshots
  set completeness_status='frozen',frozen_at=now()
  where id=latest_snapshot.id;

  update public.report_cards
  set status='published',generated_snapshot=frozen_payload,published_at=now(),
      completeness_status='frozen',updated_at=now()
  where id=rc.id;

  return jsonb_build_object(
    'ok',true,'report_card_id',rc.id,'status','published',
    'evidence_version',latest_snapshot.version
  );
end;
$$;

revoke all on function public.exq_generate_report_card_evidence(uuid) from public,anon;
revoke all on function public.exq_get_report_card_evidence(uuid) from public,anon;
revoke all on function public.exq_submit_report_card(uuid,text) from public,anon;
revoke all on function public.exq_publish_report_card(uuid) from public,anon;
grant execute on function public.exq_generate_report_card_evidence(uuid) to authenticated,service_role;
grant execute on function public.exq_get_report_card_evidence(uuid) to authenticated,service_role;
grant execute on function public.exq_submit_report_card(uuid,text) to authenticated,service_role;
grant execute on function public.exq_publish_report_card(uuid) to authenticated,service_role;

commit;
