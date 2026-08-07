create table if not exists public.curriculum_outcome_prerequisites (
  outcome_id uuid not null references public.curriculum_learning_outcomes(id) on delete cascade,
  prerequisite_outcome_id uuid not null references public.curriculum_learning_outcomes(id) on delete cascade,
  minimum_mastery numeric not null default 70,
  created_at timestamptz not null default now(),
  primary key(outcome_id,prerequisite_outcome_id),
  constraint curriculum_outcome_prerequisites_not_self check (outcome_id<>prerequisite_outcome_id),
  constraint curriculum_outcome_prerequisites_mastery_check check (minimum_mastery>=0 and minimum_mastery<=100)
);

alter table public.curriculum_outcome_prerequisites enable row level security;
drop policy if exists curriculum_outcome_prerequisites_read on public.curriculum_outcome_prerequisites;
create policy curriculum_outcome_prerequisites_read on public.curriculum_outcome_prerequisites for select to authenticated using (true);
grant select on public.curriculum_outcome_prerequisites to authenticated;

create or replace function public.student_schedule_forgetting_revision()
returns integer language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  v_uid uuid:=auth.uid(); v_student_id uuid; v_count integer:=0; r record; v_subject text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select id into v_student_id from public.students where profile_id=v_uid and deleted_at is null limit 1;
  if v_student_id is null then raise exception 'learner_identity_not_found'; end if;
  for r in
    select value as item from jsonb_array_elements(coalesce(public.student_get_twin_brain() #> '{mastery,outcomes}','[]'::jsonb)) value
    where coalesce((value->>'forgetting_risk')::numeric,0)>=0.35 or coalesce((value->>'days_since_evidence')::integer,0)>=14
    order by coalesce((value->>'forgetting_risk')::numeric,0) desc, coalesce((value->>'days_since_evidence')::integer,0) desc limit 5
  loop
    select coalesce(c.subject,'General') into v_subject
    from public.curriculum_learning_outcomes o left join public.curriculum c on c.id=o.curriculum_id
    where o.id=nullif(r.item->>'outcome_id','')::uuid;
    if not exists(
      select 1 from public.student_revision_plan_items p
      where p.student_id=v_student_id and p.plan_date between current_date and current_date+7 and p.status='planned' and p.source->>'outcome_id'=r.item->>'outcome_id'
    ) then
      insert into public.student_revision_plan_items(student_id,plan_date,subject,topic,activity_type,target_minutes,priority,reason,action_url,status,source)
      values(v_student_id,current_date+1,coalesce(v_subject,'General'),coalesce(r.item->>'outcome_text','Learning outcome'),'spaced_revision',15,1,
        format('Twin scheduled this because forgetting risk is %s%% and the last evidence is %s day(s) old.',round(coalesce((r.item->>'forgetting_risk')::numeric,0)*100),coalesce(r.item->>'days_since_evidence','unknown')),
        '/student/vibelearn/revision','planned',jsonb_build_object('source','twin_forgetting_engine','outcome_id',r.item->>'outcome_id','forgetting_risk',r.item->>'forgetting_risk','days_since_evidence',r.item->>'days_since_evidence'));
      v_count:=v_count+1;
    end if;
  end loop;
  return v_count;
end;$function$;

revoke execute on function public.student_schedule_forgetting_revision() from public,anon;
grant execute on function public.student_schedule_forgetting_revision() to authenticated;

create or replace function public.student_get_prerequisite_status(p_outcome_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_uid uuid:=auth.uid(); v_student_id uuid; v_rows jsonb; v_ready boolean;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select id into v_student_id from public.students where profile_id=v_uid and deleted_at is null limit 1;
  if v_student_id is null then raise exception 'learner_identity_not_found'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('outcome_id',p.prerequisite_outcome_id,'outcome_text',o.outcome_text,'required_mastery',p.minimum_mastery,'current_mastery',coalesce(m.mastery_score,0),'met',coalesce(m.mastery_score,0)>=p.minimum_mastery)),'[]'::jsonb)
  into v_rows
  from public.curriculum_outcome_prerequisites p
  join public.curriculum_learning_outcomes o on o.id=p.prerequisite_outcome_id
  left join public.student_outcome_mastery m on m.student_id=v_student_id and m.outcome_id=p.prerequisite_outcome_id
  where p.outcome_id=p_outcome_id;
  select not exists(select 1 from jsonb_array_elements(v_rows) x where coalesce((x->>'met')::boolean,false)=false) into v_ready;
  return jsonb_build_object('outcome_id',p_outcome_id,'ready',coalesce(v_ready,true),'prerequisites',v_rows);
end;$function$;

revoke execute on function public.student_get_prerequisite_status(uuid) from public,anon;
grant execute on function public.student_get_prerequisite_status(uuid) to authenticated;
