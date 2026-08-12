-- HQ operational hardening — production applied 2026-08-09.
-- Canonical record of the hardening applied through Supabase migrations
-- hq_operational_hardening_10of10 and hq_rpc_public_grant_lockdown.

begin;

-- Least privilege: harden legacy HQ functions only when the pretracked
-- production RPC exists in this replay. The repository's enterprise-org
-- migration documents hq_route_department but does not contain its production
-- DDL, so blank-database replay must not fail merely while revoking it.
revoke execute on function public.hq_mark_curriculum_watch_checked(uuid,timestamptz) from public,anon;
grant execute on function public.hq_mark_curriculum_watch_checked(uuid,timestamptz) to authenticated;
do $$
begin
  if to_regprocedure('public.hq_route_department(text,text)') is not null then
    execute 'revoke execute on function public.hq_route_department(text,text) from public,anon';
    execute 'grant execute on function public.hq_route_department(text,text) to authenticated';
  end if;
end $$;

-- Canonical event idempotency.
alter table public.platform_events add column if not exists idempotency_key text;
update public.platform_events
set idempotency_key=event_type||':'||entity_type||':'||entity_id::text
where idempotency_key is null and entity_id is not null;
create unique index if not exists platform_events_idempotency_key_uidx
on public.platform_events(idempotency_key) where idempotency_key is not null;

create or replace function public.hq_emit_event(
 p_event_type text,p_actor_id uuid,p_actor_role text,p_school_id uuid,
 p_entity_type text,p_entity_id uuid,p_metadata jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_event_id uuid;v_title text;v_body text;v_route text;v_category text:='operations';v_severity text:='info';v_notify boolean:=true;v_key text;
begin
 v_key:=case when p_entity_id is null then null else p_event_type||':'||p_entity_type||':'||p_entity_id::text end;
 if v_key is not null then select id into v_event_id from public.platform_events where idempotency_key=v_key;if v_event_id is not null then return v_event_id;end if;end if;
 insert into public.platform_events(event_type,actor_id,actor_role,school_id,entity_type,entity_id,metadata,idempotency_key)
 values(p_event_type,p_actor_id,p_actor_role,p_school_id,p_entity_type,p_entity_id,coalesce(p_metadata,'{}'::jsonb),v_key)
 on conflict(idempotency_key) where idempotency_key is not null do nothing returning id into v_event_id;
 if v_event_id is null and v_key is not null then select id into v_event_id from public.platform_events where idempotency_key=v_key;return v_event_id;end if;
 case p_event_type
  when 'user.signup' then v_category:='growth';v_title:='New signup';v_body:=coalesce(p_metadata->>'role','User')||case when nullif(p_metadata->>'name','') is not null then ' · '||(p_metadata->>'name') else '' end;v_route:='/hq?view=users';
  when 'school.created' then v_category:='growth';v_severity:='success';v_title:='New school registered';v_body:=coalesce(p_metadata->>'name','A school joined VibeSchool');v_route:='/hq?view=schools';
  when 'lesson_plan.created' then v_category:='teaching';v_title:='Lesson plan created';v_body:=coalesce(p_metadata->>'title','New lesson plan');v_route:='/hq?view=lesson-plans';
  when 'lesson_plan.published' then v_category:='teaching';v_severity:='success';v_title:='Lesson plan published';v_body:=coalesce(p_metadata->>'title','Lesson plan published');v_route:='/hq?view=lesson-plans';
  when 'lesson_plan.completed' then v_category:='teaching';v_notify:=false;
  when 'homework.created' then v_category:='teaching';v_title:='Homework assigned';v_body:=coalesce(p_metadata->>'title','New homework');v_route:='/hq?view=homework';
  when 'homework.submitted' then v_category:='learning';v_notify:=false;
  when 'publication.created' then v_category:='content';v_title:='Publication draft created';v_body:=coalesce(p_metadata->>'title','New publication');v_route:='/hq?view=content';
  when 'publication.published' then v_category:='content';v_severity:='success';v_title:='Publication went live';v_body:=coalesce(p_metadata->>'title','Publication published');v_route:='/hq?view=content';
  else v_notify:=false;
 end case;
 if v_notify then insert into public.hq_notifications(event_id,category,severity,title,body,route,metadata) values(v_event_id,v_category,v_severity,v_title,coalesce(v_body,''),v_route,coalesce(p_metadata,'{}'::jsonb));end if;
 return v_event_id;
end $$;
revoke all on function public.hq_emit_event(text,uuid,text,uuid,text,uuid,jsonb) from public,anon,authenticated;

-- Historical backfill is intentionally silent: it restores event truth without
-- generating misleading 'new' notifications for old activity.
insert into public.platform_events(event_type,actor_id,actor_role,school_id,entity_type,entity_id,metadata,occurred_at,idempotency_key)
select 'user.signup',p.id,coalesce(p.role,'user'),p.school_id,'profile',p.id,jsonb_build_object('role',coalesce(p.role,'user'),'name',coalesce(p.full_name,''),'historical',true),p.created_at,'user.signup:profile:'||p.id::text from public.profiles p
on conflict(idempotency_key) where idempotency_key is not null do nothing;
insert into public.platform_events(event_type,actor_id,actor_role,school_id,entity_type,entity_id,metadata,occurred_at,idempotency_key)
select 'school.created',s.created_by,'admin',s.id,'school',s.id,jsonb_build_object('name',coalesce(s.name,''),'historical',true),s.created_at,'school.created:school:'||s.id::text from public.schools s
on conflict(idempotency_key) where idempotency_key is not null do nothing;
insert into public.platform_events(event_type,actor_id,actor_role,school_id,entity_type,entity_id,metadata,occurred_at,idempotency_key)
select 'lesson_plan.created',l.teacher_id,'teacher',l.school_id,'lesson_plan',l.id,jsonb_build_object('title',coalesce(l.title,''),'historical',true),l.created_at,'lesson_plan.created:lesson_plan:'||l.id::text from public.lesson_plans l
on conflict(idempotency_key) where idempotency_key is not null do nothing;
insert into public.platform_events(event_type,actor_id,actor_role,school_id,entity_type,entity_id,metadata,occurred_at,idempotency_key)
select 'homework.created',h.teacher_id,'teacher',h.school_id,'homework',h.id,jsonb_build_object('title',coalesce(h.title,''),'historical',true),h.created_at,'homework.created:homework:'||h.id::text from public.homework h
on conflict(idempotency_key) where idempotency_key is not null do nothing;
insert into public.platform_events(event_type,actor_id,actor_role,school_id,entity_type,entity_id,metadata,occurred_at,idempotency_key)
select 'homework.submitted',hs.student_id,'student',h.school_id,'homework_submission',hs.id,jsonb_build_object('homework_id',hs.homework_id,'historical',true),hs.submitted_at,'homework.submitted:homework_submission:'||hs.id::text from public.homework_submissions hs join public.homework h on h.id=hs.homework_id
on conflict(idempotency_key) where idempotency_key is not null do nothing;
insert into public.platform_events(event_type,actor_id,actor_role,school_id,entity_type,entity_id,metadata,occurred_at,idempotency_key)
select 'publication.created',v.author_id,'author',null,'publication',v.id,jsonb_build_object('title',coalesce(v.title,''),'historical',true),v.created_at,'publication.created:publication:'||v.id::text from public.vibe_publications v
on conflict(idempotency_key) where idempotency_key is not null do nothing;

-- Approval-safe work lifecycle and overdue health.
create or replace function public.hq_update_work_item(p_id uuid,p_status text) returns void language plpgsql security definer set search_path=public as $$
declare v_requires boolean;v_current text;begin
 perform public.hq_assert_owner();if p_status not in('open','in_progress','waiting_approval','resolved','cancelled') then raise exception 'Invalid status';end if;
 select approval_required,status into v_requires,v_current from public.hq_work_items where id=p_id for update;if not found then raise exception 'Work item not found';end if;
 if p_status='resolved' and v_requires and v_current<>'waiting_approval' then raise exception 'Approval-required work must enter waiting_approval before resolution';end if;
 update public.hq_work_items set status=p_status,updated_at=now(),resolved_at=case when p_status='resolved' then coalesce(resolved_at,now()) when p_status in('open','in_progress','waiting_approval') then null else resolved_at end where id=p_id;
end $$;
revoke all on function public.hq_update_work_item(uuid,text) from public,anon;grant execute on function public.hq_update_work_item(uuid,text) to authenticated;

create or replace function public.hq_approve_work_item(p_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin perform public.hq_assert_owner();update public.hq_work_items set status='resolved',resolved_at=now(),updated_at=now() where id=p_id and approval_required=true and status='waiting_approval';if not found then raise exception 'Only approval-required work waiting for approval can be approved';end if;end $$;
revoke all on function public.hq_approve_work_item(uuid) from public,anon;grant execute on function public.hq_approve_work_item(uuid) to authenticated;
create index if not exists hq_work_items_due_open_idx on public.hq_work_items(due_at) where due_at is not null and status in('open','in_progress','waiting_approval');
create or replace function public.hq_get_work_health() returns jsonb language plpgsql security definer set search_path=public as $$
declare v jsonb;begin perform public.hq_assert_owner();select jsonb_build_object('open',count(*) filter(where status in('open','in_progress','waiting_approval')),'overdue',count(*) filter(where status in('open','in_progress','waiting_approval') and due_at<now()),'due_24h',count(*) filter(where status in('open','in_progress','waiting_approval') and due_at>=now() and due_at<now()+interval '24 hours'),'waiting_approval',count(*) filter(where status='waiting_approval'),'critical_open',count(*) filter(where priority='critical' and status in('open','in_progress','waiting_approval'))) into v from public.hq_work_items;return v;end $$;
revoke all on function public.hq_get_work_health() from public,anon;grant execute on function public.hq_get_work_health() to authenticated;

-- Incident fingerprint + reusable deduplicating incident writer.
alter table public.hq_incidents add column if not exists fingerprint text;
update public.hq_incidents set fingerprint=md5(incident_type||':'||coalesce(route,'')||':'||coalesce(evidence::text,'')) where fingerprint is null;
create index if not exists hq_incidents_fingerprint_idx on public.hq_incidents(fingerprint,status);
create or replace function public.hq_open_incident(p_incident_type text,p_severity text,p_title text,p_summary text,p_evidence jsonb default '{}'::jsonb,p_route text default null) returns uuid language plpgsql security definer set search_path=public as $$
declare v_fp text;v_id uuid;begin v_fp:=md5(p_incident_type||':'||coalesce(p_route,'')||':'||coalesce(p_evidence,'{}'::jsonb)::text);select id into v_id from public.hq_incidents where fingerprint=v_fp and status<>'resolved' order by detected_at desc limit 1;if v_id is not null then return v_id;end if;insert into public.hq_incidents(incident_type,severity,status,title,summary,evidence,route,fingerprint) values(p_incident_type,p_severity,'open',p_title,coalesce(p_summary,''),coalesce(p_evidence,'{}'::jsonb),p_route,v_fp)returning id into v_id;return v_id;end $$;
revoke all on function public.hq_open_incident(text,text,text,text,jsonb,text) from public,anon,authenticated;

-- Metric lineage for founder-facing traceability.
create or replace function public.hq_metric_catalog() returns jsonb language plpgsql security definer set search_path=public as $$
begin perform public.hq_assert_owner();return jsonb_build_array(
 jsonb_build_object('key','users.total','source','public.profiles','definition','Non-anonymized profiles'),jsonb_build_object('key','schools.active','source','public.schools','definition','Non-deleted schools with status active'),jsonb_build_object('key','teaching.lesson_plans_today','source','public.lesson_plans','definition','Lesson plans created today'),jsonb_build_object('key','teaching.homework_today','source','public.homework','definition','Homework created today'),jsonb_build_object('key','teaching.submissions_today','source','public.homework_submissions','definition','Submissions received today'),jsonb_build_object('key','content.publications_live','source','public.vibe_publications','definition','Published publications'),jsonb_build_object('key','incidents.open','source','public.hq_incidents','definition','Incidents not resolved'),jsonb_build_object('key','notifications.unread','source','public.hq_notifications','definition','Unread HQ notifications'));end $$;
revoke all on function public.hq_metric_catalog() from public,anon;grant execute on function public.hq_metric_catalog() to authenticated;

-- Machine-verifiable acceptance gate; creates no fake business records.
create or replace function public.hq_system_health() returns jsonb language plpgsql security definer set search_path=public as $$
declare v_anon bigint;v_triggers bigint;v_rls bigint;v_events bigint;v_historical bigint;begin perform public.hq_assert_owner();select count(*) into v_anon from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'hq\_%' escape '\' and has_function_privilege('anon',p.oid,'EXECUTE');select count(*) into v_triggers from pg_trigger where not tgisinternal and tgname in('trg_hq_profile_event','trg_hq_school_event','trg_hq_lesson_plan_event','trg_hq_homework_event','trg_hq_homework_submission_event','trg_hq_publication_event');select count(*) into v_rls from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in('platform_events','hq_notifications','hq_incidents','hq_decisions','hq_decision_versions','hq_product_configs','hq_propagation_targets','hq_decision_audit','hq_departments','hq_work_items','hq_functions') and c.relrowsecurity;select count(*),count(*) filter(where metadata->>'historical'='true') into v_events,v_historical from public.platform_events;return jsonb_build_object('ok',(v_anon=0 and v_triggers=6 and v_rls=11 and v_events>0),'anonymous_hq_rpc_count',v_anon,'event_triggers',v_triggers,'rls_tables',v_rls,'events',v_events,'historical_events',v_historical,'checked_at',now());end $$;
revoke all on function public.hq_system_health() from public,anon;grant execute on function public.hq_system_health() to authenticated;

commit;
