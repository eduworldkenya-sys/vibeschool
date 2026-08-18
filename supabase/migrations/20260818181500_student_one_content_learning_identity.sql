-- Student = 1: separate account identity from durable learner identity in reading evidence.
-- viewer_id/account_user_id remain account provenance; student_id is public.students.id only.
-- authorization-test: public.content_learning_events
-- authorization-test: public.vibe_reading_sessions

-- Reading sessions are account-scoped but may also belong to a canonical learner.
alter table public.vibe_reading_sessions add column if not exists student_id uuid;
update public.vibe_reading_sessions r
set student_id=s.id
from public.students s
where r.student_id is null and s.profile_id=r.viewer_id and s.deleted_at is null;
alter table public.vibe_reading_sessions drop constraint if exists vibe_reading_sessions_student_id_fkey;
alter table public.vibe_reading_sessions add constraint vibe_reading_sessions_student_id_fkey
  foreign key(student_id) references public.students(id) on delete set null;
create index if not exists vibe_reading_sessions_student_time_idx
  on public.vibe_reading_sessions(student_id,started_at desc) where student_id is not null;

-- Preserve every historical account UUID before changing event student_id semantics.
alter table public.content_learning_events add column if not exists account_user_id uuid;
update public.content_learning_events set account_user_id=student_id where account_user_id is null;
alter table public.content_learning_events drop constraint if exists content_learning_events_student_id_fkey;
alter table public.content_learning_events alter column student_id drop not null;

-- Promote only deterministic active mappings; never guess learner identity.
update public.content_learning_events e
set student_id=s.id
from public.students s
where s.profile_id=e.account_user_id and s.deleted_at is null;
update public.content_learning_events e
set student_id=null
where not exists(select 1 from public.students s where s.id=e.student_id and s.deleted_at is null);

alter table public.content_learning_events add constraint content_learning_events_student_id_fkey
  foreign key(student_id) references public.students(id) on delete set null;
alter table public.content_learning_events drop constraint if exists content_learning_events_account_user_id_fkey;
alter table public.content_learning_events add constraint content_learning_events_account_user_id_fkey
  foreign key(account_user_id) references auth.users(id) on delete set null;
create index if not exists content_learning_events_account_time_idx
  on public.content_learning_events(account_user_id,occurred_at desc) where account_user_id is not null;

-- Direct clients cannot mint learning evidence.
revoke insert on public.content_learning_events from authenticated;
drop policy if exists content_learning_events_student_insert on public.content_learning_events;
drop policy if exists content_learning_events_student_read on public.content_learning_events;
drop policy if exists content_learning_events_account_read on public.content_learning_events;
create policy content_learning_events_account_read on public.content_learning_events
for select to authenticated using(account_user_id=(select auth.uid()));

create or replace function public.record_content_learning_event(
  p_publication_id uuid,p_chapter_id uuid,p_content_block_id uuid,p_outcome_id uuid,
  p_event_type text,p_duration_ms integer default null,p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  v_id uuid;
  v_account_user_id uuid:=auth.uid();
  v_student_id uuid:=public.current_student_id();
begin
  if v_account_user_id is null then raise exception 'authentication required'; end if;
  if v_student_id is null then raise exception 'canonical learner identity required'; end if;
  if p_event_type not in ('view','complete','reread','struggle','hint','question_attempt','question_correct','question_incorrect','remediation_started','remediation_completed') then
    raise exception 'invalid event type';
  end if;
  if p_content_block_id is not null and not exists(
    select 1 from public.content_blocks b
    where b.id=p_content_block_id and b.publication_id=p_publication_id
      and (p_chapter_id is null or b.chapter_id=p_chapter_id)
  ) then raise exception 'content lineage mismatch'; end if;

  insert into public.content_learning_events(
    student_id,account_user_id,publication_id,chapter_id,content_block_id,outcome_id,
    event_type,duration_ms,metadata
  ) values(
    v_student_id,v_account_user_id,p_publication_id,p_chapter_id,p_content_block_id,p_outcome_id,
    p_event_type,p_duration_ms,coalesce(p_metadata,'{}'::jsonb)
  ) returning id into v_id;
  return v_id;
end
$$;
revoke all on function public.record_content_learning_event(uuid,uuid,uuid,uuid,text,integer,jsonb) from public,anon;
grant execute on function public.record_content_learning_event(uuid,uuid,uuid,uuid,text,integer,jsonb) to authenticated;

create or replace function public.record_reading_activity(
  p_chapter_id uuid,p_client_session_id uuid,p_event text,
  p_active_seconds integer default 0,p_progress_percent integer default 0
) returns jsonb
language plpgsql security definer set search_path=public,auth,pg_temp
as $$
declare
  v_viewer uuid:=auth.uid();
  v_student_id uuid:=public.current_student_id();
  v_publication_id uuid;
  v_session public.vibe_reading_sessions%rowtype;
  v_seconds integer:=greatest(0,least(coalesce(p_active_seconds,0),300));
  v_progress integer:=greatest(0,least(coalesce(p_progress_percent,0),100));
begin
  if v_viewer is null then return jsonb_build_object('ok',false,'reason','auth_required'); end if;
  if p_client_session_id is null then return jsonb_build_object('ok',false,'reason','invalid_session'); end if;
  if p_event not in ('start','heartbeat','completed','chapter_change','page_hide','reader_close') then
    return jsonb_build_object('ok',false,'reason','invalid_event');
  end if;
  select publication_id into v_publication_id from public.vibe_chapters where id=p_chapter_id;
  if v_publication_id is null then return jsonb_build_object('ok',false,'reason','chapter_not_found'); end if;
  if not public.can_viewer_read_chapter(p_chapter_id,v_viewer) then
    return jsonb_build_object('ok',false,'reason','not_entitled');
  end if;

  insert into public.vibe_reading_sessions(
    viewer_id,student_id,publication_id,chapter_id,client_session_id,
    active_seconds,max_progress_percent,completed_at,ended_at,end_reason
  ) values(
    v_viewer,v_student_id,v_publication_id,p_chapter_id,p_client_session_id,v_seconds,v_progress,
    case when p_event='completed' or v_progress>=90 then now() end,
    case when p_event in ('completed','chapter_change','page_hide','reader_close') then now() end,
    case when p_event in ('completed','chapter_change','page_hide','reader_close') then p_event end
  )
  on conflict(viewer_id,client_session_id) do update set
    student_id=coalesce(public.vibe_reading_sessions.student_id,excluded.student_id),
    last_active_at=now(),
    active_seconds=public.vibe_reading_sessions.active_seconds+v_seconds,
    max_progress_percent=greatest(public.vibe_reading_sessions.max_progress_percent,v_progress),
    completed_at=coalesce(public.vibe_reading_sessions.completed_at,
      case when p_event='completed' or v_progress>=90 then now() end),
    ended_at=case when p_event in ('completed','chapter_change','page_hide','reader_close') then now() else public.vibe_reading_sessions.ended_at end,
    end_reason=case when p_event in ('completed','chapter_change','page_hide','reader_close') then p_event else public.vibe_reading_sessions.end_reason end,
    updated_at=now()
  returning * into v_session;
  return jsonb_build_object('ok',true,'session_id',v_session.id,'active_seconds',v_session.active_seconds,
    'max_progress_percent',v_session.max_progress_percent,'completed',v_session.completed_at is not null);
end
$$;

-- Only proven learners project into learner evidence.
create or replace function public.project_reading_session_learning_events()
returns trigger language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_outcome uuid; v_event text; v_duration int;
begin
  if new.viewer_id is null or new.student_id is null or new.publication_id is null or new.chapter_id is null then return new; end if;
  select outcome_id into v_outcome from public.chapter_learning_outcome_links
  where chapter_id=new.chapter_id order by sequence nulls last,created_at limit 1;
  if tg_op='INSERT' then
    insert into public.content_learning_events(student_id,account_user_id,publication_id,chapter_id,outcome_id,event_type,duration_ms,metadata,occurred_at)
    values(new.student_id,new.viewer_id,new.publication_id,new.chapter_id,v_outcome,'view',0,
      jsonb_build_object('reading_session_id',new.id,'client_session_id',new.client_session_id,'source','vibe_reading_sessions'),new.started_at)
    on conflict do nothing;
  end if;
  if new.ended_at is not null and (tg_op='INSERT' or old.ended_at is distinct from new.ended_at) then
    v_event:=case when new.max_progress_percent>=90 or new.completed_at is not null then 'complete'
      when new.max_progress_percent<=35 and new.active_seconds>=120 then 'struggle' else 'view' end;
    v_duration:=greatest(0,new.active_seconds*1000);
    insert into public.content_learning_events(student_id,account_user_id,publication_id,chapter_id,outcome_id,event_type,duration_ms,metadata,occurred_at)
    values(new.student_id,new.viewer_id,new.publication_id,new.chapter_id,v_outcome,v_event,v_duration,
      jsonb_build_object('reading_session_id',new.id,'client_session_id',new.client_session_id,'progress_percent',new.max_progress_percent,'end_reason',new.end_reason,'source','vibe_reading_sessions'),coalesce(new.ended_at,new.last_active_at))
    on conflict do nothing;
  end if;
  return new;
end
$$;

-- Replace only the event-health part of ENGINE-001 with learner-domain evidence.
create or replace function public.run_content_intelligence_cycle(p_trigger text default 'scheduled')
returns uuid language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_run uuid; v_signals integer:=0; v_proposals integer:=0;
begin
 insert into curriculum_intelligence_runs(status,trigger_type,started_at,model,metadata)
 values('running',p_trigger,now(),'deterministic-health-v1',jsonb_build_object('engine','ENGINE-001')) returning id into v_run;
 with assessment_health as (
  select b.publication_id,b.chapter_id,b.id block_id,count(r.id)::int evidence_count,
    avg(case when coalesce(r.max_score,0)>0 then coalesce(r.final_score,r.teacher_score,r.auto_score,0)/r.max_score end) avg_ratio
  from content_blocks b join assessment_items i on i.source_block_id=b.id
  join assessment_responses r on r.assessment_item_id=i.id and r.submitted_at is not null
  where r.created_at>=now()-interval '90 days' group by b.publication_id,b.chapter_id,b.id having count(r.id)>=5
 ), event_health as (
  select e.publication_id,e.chapter_id,e.content_block_id block_id,
    count(*) filter(where event_type in ('struggle','question_incorrect','reread','hint'))::int weak_events,count(*)::int total_events
  from content_learning_events e
  where e.student_id is not null and e.content_block_id is not null and e.occurred_at>=now()-interval '90 days'
  group by e.publication_id,e.chapter_id,e.content_block_id having count(*)>=5
 ), candidates as (
  select coalesce(a.publication_id,e.publication_id) publication_id,coalesce(a.chapter_id,e.chapter_id) chapter_id,
    coalesce(a.block_id,e.block_id) block_id,coalesce(a.evidence_count,0)+coalesce(e.total_events,0) evidence_count,a.avg_ratio,
    case when coalesce(e.total_events,0)>0 then e.weak_events::numeric/e.total_events end weak_ratio
  from assessment_health a full join event_health e on e.block_id=a.block_id
 ), upserted as (
  insert into curriculum_content_health_signals(publication_id,chapter_id,content_block_id,signal_type,severity,score,evidence_count,evidence,status,first_detected_at,last_detected_at)
  select publication_id,chapter_id,block_id,'assessment_failure',
    case when coalesce(avg_ratio,1)<0.4 or coalesce(weak_ratio,0)>=0.6 then 'high' else 'medium' end,
    greatest(coalesce(1-avg_ratio,0),coalesce(weak_ratio,0)),evidence_count,
    jsonb_build_object('assessment_success_ratio',avg_ratio,'weak_event_ratio',weak_ratio,'window_days',90),'open',now(),now()
  from candidates where coalesce(avg_ratio,1)<0.65 or coalesce(weak_ratio,0)>=0.35 on conflict do nothing returning id
 ) select count(*) into v_signals from upserted;
 insert into curriculum_intelligence_proposals(publication_id,chapter_id,outcome_id,proposal_type,title,claim,current_content,proposed_content,rationale,curriculum_relevance,confidence,verification_status,volatility,status,generated_by,generated_at,engine_run_id,editorial_status)
 select s.publication_id,s.chapter_id,s.outcome_id,'review_candidate','Investigate weak learning effectiveness',
   'Evidence indicates this content may not be producing sufficient learner understanding.',coalesce(b.plain_text,''),'Research required before editorial patch.',
   concat('Health signal ',s.signal_type,' score=',coalesce(s.score,0),' evidence=',s.evidence_count,'. Research and editorial review required before any publication change.'),
   case when s.outcome_id is null then 'C1' else 'C4' end,least(0.95,0.5+least(coalesce(s.evidence_count,0),45)::numeric/100),
   'insufficient_evidence','medium','pending_review','content-intelligence-engine',now(),v_run,'needs_review'
 from curriculum_content_health_signals s left join content_blocks b on b.id=s.content_block_id
 where s.status='open' and s.severity in ('medium','high','critical')
 and not exists(select 1 from curriculum_intelligence_proposals p where p.publication_id=s.publication_id and p.chapter_id is not distinct from s.chapter_id and p.status in ('pending_review','approved','applied'));
 get diagnostics v_proposals=row_count;
 insert into content_engine_cycle_metrics(run_id,metric_key,metric_value) values(v_run,'health_signals_created',v_signals),(v_run,'proposals_created',v_proposals);
 update curriculum_intelligence_runs set status='completed',completed_at=now(),proposals_created=v_proposals,
   summary=concat('ENGINE-001 completed: ',v_signals,' health signals, ',v_proposals,' proposals.') where id=v_run;
 return v_run;
exception when others then
 if v_run is not null then update curriculum_intelligence_runs set status='failed',completed_at=now(),error=sqlerrm where id=v_run; end if;
 raise;
end
$$;
revoke all on function public.run_content_intelligence_cycle(text) from public,anon,authenticated;
grant execute on function public.run_content_intelligence_cycle(text) to service_role;

-- Fail closed if identity domains regress.
do $$
begin
 if not exists(
  select 1 from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
  where n.nspname='public' and t.relname='content_learning_events' and c.conname='content_learning_events_student_id_fkey'
    and pg_get_constraintdef(c.oid) like '%REFERENCES students(id)%'
 ) then raise exception 'content_learning_events_student_fk_not_canonical'; end if;
 if exists(select 1 from public.content_learning_events e where e.student_id is not null and not exists(select 1 from public.students s where s.id=e.student_id)) then
  raise exception 'content_learning_events_noncanonical_student_remaining'; end if;
 if exists(select 1 from public.vibe_reading_sessions r where r.student_id is not null and not exists(select 1 from public.students s where s.id=r.student_id)) then
  raise exception 'reading_sessions_noncanonical_student_remaining'; end if;
 if has_table_privilege('authenticated','public.content_learning_events','INSERT') then
  raise exception 'content_learning_events_direct_insert_still_granted'; end if;
end
$$;
