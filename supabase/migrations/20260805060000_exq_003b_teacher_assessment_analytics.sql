begin;

create or replace function public.exq_list_teacher_assessment_analytics()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare caller uuid := auth.uid(); payload jsonb;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'assignment_id',aa.id,'assessment_id',ad.id,'title',ad.title,
    'assessment_type',ad.assessment_type,'class_id',aa.class_id,
    'class_name',c.name,'class_stream',c.stream,'assigned_at',aa.assigned_at,
    'closes_at',aa.closes_at,
    'eligible_learners',(select count(*) from public.student_classes sc
      where sc.class_id=aa.class_id and sc.school_id=aa.school_id and sc.is_current=true
      and (aa.target_group_id is null or exists (select 1 from public.class_group_members cgm
        where cgm.group_id=aa.target_group_id and cgm.student_id=sc.student_id))),
    'submitted_count',(select count(distinct at.student_id) from public.assessment_attempts at
      where at.assignment_id=aa.id and at.status in ('submitted','auto_marked','teacher_review','marked','released')),
    'review_pending_count',(select count(*) from public.assessment_attempts at
      where at.assignment_id=aa.id and at.status='teacher_review'),
    'released_count',(select count(*) from public.assessment_attempts at
      where at.assignment_id=aa.id and at.status='released'),
    'average_percentage',(select round(avg(at.percentage),2) from public.assessment_attempts at
      where at.assignment_id=aa.id and at.percentage is not null
      and at.status in ('auto_marked','teacher_review','marked','released')),
    'highest_percentage',(select max(at.percentage) from public.assessment_attempts at
      where at.assignment_id=aa.id and at.percentage is not null),
    'lowest_percentage',(select min(at.percentage) from public.assessment_attempts at
      where at.assignment_id=aa.id and at.percentage is not null)
  ) order by aa.created_at desc),'[]'::jsonb) into payload
  from public.assessment_assignments aa
  join public.assessment_definitions ad on ad.id=aa.assessment_id
  join public.classes c on c.id=aa.class_id
  where aa.teacher_id=caller;
  return jsonb_build_object('ok',true,'assessments',payload);
end;
$$;

create or replace function public.exq_get_assignment_analytics(p_assignment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid(); aa public.assessment_assignments%rowtype;
  ad public.assessment_definitions%rowtype; class_row public.classes%rowtype;
  learners jsonb; questions jsonb; eligible_count integer; submitted_count integer;
  avg_pct numeric; high_pct numeric; low_pct numeric;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into aa from public.assessment_assignments where id=p_assignment_id;
  if not found then raise exception 'assignment_not_found'; end if;
  if aa.teacher_id is distinct from caller then raise exception 'assignment_not_owned'; end if;
  select * into ad from public.assessment_definitions where id=aa.assessment_id;
  select * into class_row from public.classes where id=aa.class_id;
  select count(*) into eligible_count from public.student_classes sc
    where sc.class_id=aa.class_id and sc.school_id=aa.school_id and sc.is_current=true
    and (aa.target_group_id is null or exists (select 1 from public.class_group_members cgm
      where cgm.group_id=aa.target_group_id and cgm.student_id=sc.student_id));
  select count(distinct at.student_id),round(avg(at.percentage),2),max(at.percentage),min(at.percentage)
    into submitted_count,avg_pct,high_pct,low_pct from public.assessment_attempts at
    where at.assignment_id=aa.id and at.status in ('submitted','auto_marked','teacher_review','marked','released');
  select coalesce(jsonb_agg(jsonb_build_object(
    'student_id',s.id,'student_name',s.name,'admission_number',s.admission_number,
    'attempt_id',at.id,'attempt_status',at.status,'score',at.score,
    'max_score',at.max_score,'percentage',at.percentage,'submitted_at',at.submitted_at
  ) order by s.name),'[]'::jsonb) into learners
  from public.student_classes sc join public.students s on s.id=sc.student_id
  left join lateral (select latest.* from public.assessment_attempts latest
    where latest.assignment_id=aa.id and latest.student_id=s.id
    order by latest.attempt_number desc limit 1) at on true
  where sc.class_id=aa.class_id and sc.school_id=aa.school_id and sc.is_current=true
    and (aa.target_group_id is null or exists (select 1 from public.class_group_members cgm
      where cgm.group_id=aa.target_group_id and cgm.student_id=sc.student_id));
  select coalesce(jsonb_agg(jsonb_build_object(
    'assessment_item_id',ai.id,'order_num',ai.order_num,'prompt',ai.prompt,
    'question_type',ai.question_type,'max_score',ai.marks,
    'response_count',stats.response_count,'average_score',stats.average_score,
    'average_percentage',stats.average_percentage,'zero_score_count',stats.zero_score_count
  ) order by ai.order_num),'[]'::jsonb) into questions
  from public.assessment_items ai
  left join lateral (select count(ar.id) response_count,round(avg(ar.final_score),2) average_score,
    round(avg(case when ar.max_score>0 then (ar.final_score/ar.max_score)*100 end),2) average_percentage,
    count(*) filter (where ar.final_score=0) zero_score_count
    from public.assessment_responses ar join public.assessment_attempts at on at.id=ar.attempt_id
    where at.assignment_id=aa.id and ar.assessment_item_id=ai.id and ar.final_score is not null) stats on true
  where ai.assessment_id=aa.assessment_id and ai.status='approved';
  return jsonb_build_object('ok',true,'assignment_id',aa.id,'assessment_id',ad.id,
    'title',ad.title,'assessment_type',ad.assessment_type,'class_name',class_row.name,
    'class_stream',class_row.stream,'eligible_learners',eligible_count,
    'submitted_count',submitted_count,
    'submission_rate',case when eligible_count>0 then round((submitted_count::numeric/eligible_count)*100,2) else 0 end,
    'average_percentage',avg_pct,'highest_percentage',high_pct,'lowest_percentage',low_pct,
    'learners',learners,'questions',questions);
end;
$$;

revoke all on function public.exq_list_teacher_assessment_analytics() from public,anon;
revoke all on function public.exq_get_assignment_analytics(uuid) from public,anon;
grant execute on function public.exq_list_teacher_assessment_analytics() to authenticated,service_role;
grant execute on function public.exq_get_assignment_analytics(uuid) to authenticated,service_role;

commit;
