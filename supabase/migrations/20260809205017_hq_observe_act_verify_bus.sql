create table if not exists public.hq_product_event_contract (
  event_type text primary key,
  product_key text not null,
  category text not null default 'operations',
  department_key text not null,
  severity text not null default 'info',
  creates_work boolean not null default false,
  creates_incident boolean not null default false,
  decision_required boolean not null default false,
  verification_event_type text,
  max_unverified_minutes integer not null default 60,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.hq_product_event_contract enable row level security;
revoke all on table public.hq_product_event_contract from public, anon, authenticated;
grant select,insert,update,delete on table public.hq_product_event_contract to service_role;

insert into public.hq_product_event_contract(event_type,product_key,category,department_key,severity,creates_work,creates_incident,decision_required,verification_event_type,max_unverified_minutes)
values
 ('product.runtime_seen','platform','system','engineering','info',false,false,false,null,15),
 ('lesson.plan_created','teacher','teaching','customer','info',false,false,false,null,120),
 ('homework.created','teacher','teaching','customer','info',false,false,false,'homework.submitted',1440),
 ('homework.submitted','student','learning','learning','info',false,false,false,null,1440),
 ('attendance.recorded','teacher','teaching','customer','info',false,false,false,null,120),
 ('assessment.started','student','learning','learning','info',false,false,false,'assessment.graded',1440),
 ('assessment.graded','teacher','learning','learning','info',false,false,false,null,1440),
 ('lesson.evidence_added','teacher','teaching','learning','info',false,false,false,null,240),
 ('lesson.reflected','teacher','teaching','learning','info',false,false,false,null,240),
 ('twin.adapted','twin','learning','learning','info',false,false,false,null,240),
 ('student.task_executed','student','learning','learning','info',false,false,false,null,240),
 ('communication.parent_message','parent','customer','customer','info',false,false,false,null,240),
 ('vibelab.session_started','vibelabs','content','content','info',false,false,false,'vibelab.session_status_changed',240),
 ('vibelab.session_status_changed','vibelabs','content','content','info',false,false,false,null,240),
 ('vibelearn.reading_started','vibelearn','learning','learning','info',false,false,false,null,240),
 ('learning.exercise_submitted','student','learning','learning','info',false,false,false,null,240),
 ('learning.project_submitted','student','learning','learning','info',false,false,false,null,1440),
 ('publication.published','vibebooks','publishing','content','info',false,false,false,null,1440),
 ('policy.failure','platform','system','engineering','high',true,true,false,'product.runtime_seen',30),
 ('runtime.error','platform','system','engineering','high',true,true,false,'product.runtime_seen',30),
 ('security.signal','platform','security','trust_safety','critical',true,true,true,null,15),
 ('billing.failure','billing','billing','finance','high',true,true,false,null,60)
on conflict (event_type) do update set product_key=excluded.product_key,category=excluded.category,department_key=excluded.department_key,severity=excluded.severity,creates_work=excluded.creates_work,creates_incident=excluded.creates_incident,decision_required=excluded.decision_required,verification_event_type=excluded.verification_event_type,max_unverified_minutes=excluded.max_unverified_minutes,active=excluded.active,updated_at=now();

create table if not exists public.hq_product_event_trace (
  event_id uuid primary key references public.platform_events(id) on delete cascade,
  correlation_id uuid not null default gen_random_uuid(),
  product_key text,
  event_type text not null,
  department_key text,
  work_item_id uuid references public.hq_work_items(id) on delete set null,
  incident_id uuid references public.hq_incidents(id) on delete set null,
  state text not null default 'observed' check (state in ('observed','routed','actioned','awaiting_verification','verified','failed','escalated','ignored')),
  verification_event_id uuid references public.platform_events(id) on delete set null,
  verified_at timestamptz,
  escalated_at timestamptz,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.hq_product_event_trace enable row level security;
revoke all on table public.hq_product_event_trace from public,anon,authenticated;
grant select,insert,update,delete on table public.hq_product_event_trace to service_role;
create index if not exists idx_hq_event_trace_state on public.hq_product_event_trace(state,created_at);
create index if not exists idx_hq_event_trace_corr on public.hq_product_event_trace(correlation_id);

create or replace function public.hq_trace_product_event(p_event_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare e public.platform_events%rowtype; c public.hq_product_event_contract%rowtype; v_trace public.hq_product_event_trace%rowtype; v_work uuid; v_incident uuid; v_title text; v_route text; v_priority text;
begin
 select * into e from public.platform_events where id=p_event_id;
 if not found then raise exception 'Platform event not found'; end if;
 select * into c from public.hq_product_event_contract where event_type=e.event_type and active=true;
 if not found then
   insert into public.hq_product_event_trace(event_id,product_key,event_type,department_key,state,evidence)
   values(e.id,coalesce(e.metadata->>'product_key',split_part(e.event_type,'.',1)),e.event_type,public.hq_route_department(null,e.event_type),'ignored',jsonb_build_object('reason','unregistered_event_contract'))
   on conflict(event_id) do update set updated_at=now()
   returning * into v_trace;
   return v_trace.correlation_id;
 end if;
 insert into public.hq_product_event_trace(event_id,product_key,event_type,department_key,state,evidence)
 values(e.id,c.product_key,e.event_type,c.department_key,'observed',jsonb_build_object('source_metadata',e.metadata,'school_id',e.school_id,'actor_role',e.actor_role))
 on conflict(event_id) do update set updated_at=now()
 returning * into v_trace;
 if c.creates_work and v_trace.work_item_id is null then
   v_title:=format('%s event requires action',replace(e.event_type,'.',' '));
   v_priority:=case c.severity when 'critical' then 'urgent' when 'high' then 'high' else 'normal' end;
   insert into public.hq_work_items(department_key,work_type,priority,status,title,summary,source_type,source_id,route,approval_required,due_at,evidence)
   values(c.department_key,'product_event',v_priority,'open',v_title,'Automatically routed from product telemetry','platform_event',e.id,'/hq',c.decision_required,now()+make_interval(mins=>greatest(5,c.max_unverified_minutes)),jsonb_build_object('correlation_id',v_trace.correlation_id,'event_id',e.id,'event_type',e.event_type,'product_key',c.product_key,'metadata',e.metadata)) returning id into v_work;
 end if;
 if c.creates_incident and v_trace.incident_id is null then
   v_route:=coalesce(e.metadata->>'route','/hq');
   v_incident:=public.hq_open_incident('product_event',c.severity,format('%s: %s',upper(c.product_key),replace(e.event_type,'.',' ')),'Automatically opened from product telemetry',jsonb_build_object('correlation_id',v_trace.correlation_id,'event_id',e.id,'event_type',e.event_type,'product_key',c.product_key,'metadata',e.metadata),v_route);
 end if;
 update public.hq_product_event_trace set work_item_id=coalesce(work_item_id,v_work),incident_id=coalesce(incident_id,v_incident),state=case when coalesce(work_item_id,v_work) is not null or coalesce(incident_id,v_incident) is not null then 'routed' else case when c.verification_event_type is not null then 'awaiting_verification' else 'verified' end end,verified_at=case when coalesce(work_item_id,v_work) is null and coalesce(incident_id,v_incident) is null and c.verification_event_type is null then now() else verified_at end,updated_at=now() where event_id=e.id;
 return v_trace.correlation_id;
end $$;
revoke all on function public.hq_trace_product_event(uuid) from public,anon,authenticated;
grant execute on function public.hq_trace_product_event(uuid) to service_role;

create or replace function public.hq_product_event_after_insert()
returns trigger language plpgsql security definer set search_path=public as $$ begin perform public.hq_trace_product_event(new.id); return new; exception when others then return new; end $$;
revoke all on function public.hq_product_event_after_insert() from public,anon,authenticated;
drop trigger if exists trg_hq_trace_product_event on public.platform_events;
create trigger trg_hq_trace_product_event after insert on public.platform_events for each row execute function public.hq_product_event_after_insert();

create or replace function public.hq_reconcile_product_event_verifications()
returns jsonb language plpgsql security definer set search_path=public as $$
declare r record; n_verified int:=0; n_escalated int:=0; v_match uuid;
begin
 for r in select t.*,c.verification_event_type,c.max_unverified_minutes from public.hq_product_event_trace t join public.hq_product_event_contract c on c.event_type=t.event_type where t.state in ('awaiting_verification','routed','actioned') and c.verification_event_type is not null loop
   select e.id into v_match from public.platform_events e where e.event_type=r.verification_event_type and e.occurred_at>=r.created_at and (r.evidence->>'school_id' is null or e.school_id::text=r.evidence->>'school_id') order by e.occurred_at asc limit 1;
   if v_match is not null then update public.hq_product_event_trace set state='verified',verification_event_id=v_match,verified_at=now(),updated_at=now(),evidence=evidence||jsonb_build_object('verification_event_id',v_match) where event_id=r.event_id; n_verified:=n_verified+1;
   elsif r.created_at < now()-make_interval(mins=>greatest(5,r.max_unverified_minutes)) and r.state<>'escalated' then
     update public.hq_product_event_trace set state='escalated',escalated_at=now(),updated_at=now(),evidence=evidence||jsonb_build_object('escalation_reason','verification_timeout') where event_id=r.event_id;
     insert into public.hq_notifications(event_id,category,severity,title,body,route,status,metadata) values(r.event_id,'operations','warning','Product outcome verification overdue',format('%s has not produced expected verification event %s',r.event_type,r.verification_event_type),'/hq','unread',jsonb_build_object('correlation_id',r.correlation_id,'event_id',r.event_id,'expected_event_type',r.verification_event_type)) on conflict do nothing;
     n_escalated:=n_escalated+1;
   end if;
 end loop;
 return jsonb_build_object('verified',n_verified,'escalated',n_escalated);
end $$;
revoke all on function public.hq_reconcile_product_event_verifications() from public,anon,authenticated;
grant execute on function public.hq_reconcile_product_event_verifications() to service_role;

create or replace function public.hq_get_operating_loop_status(p_hours integer default 24)
returns jsonb language plpgsql security definer set search_path=public as $$
declare h int:=greatest(1,least(coalesce(p_hours,24),168)); begin perform public.hq_assert_owner(); return jsonb_build_object('window_hours',h,'traces',coalesce((select jsonb_object_agg(state,n) from (select state,count(*) n from public.hq_product_event_trace where created_at>=now()-make_interval(hours=>h) group by state)s),'{}'::jsonb),'products',coalesce((select jsonb_agg(x order by x->>'product') from (select jsonb_build_object('product',product_key,'events',count(*),'verified',count(*) filter(where state='verified'),'open',count(*) filter(where state not in ('verified','ignored')),'last_event',max(created_at)) x from public.hq_product_event_trace where created_at>=now()-make_interval(hours=>h) group by product_key)q),'[]'::jsonb),'unverified',coalesce((select jsonb_agg(jsonb_build_object('correlation_id',correlation_id,'event_type',event_type,'product_key',product_key,'department',department_key,'state',state,'work_item_id',work_item_id,'incident_id',incident_id,'created_at',created_at) order by created_at desc) from (select * from public.hq_product_event_trace where state not in ('verified','ignored') order by created_at desc limit 50)u),'[]'::jsonb),'generated_at',now()); end $$;
revoke all on function public.hq_get_operating_loop_status(integer) from public,anon;
grant execute on function public.hq_get_operating_loop_status(integer) to authenticated;

create or replace function public.hq_run_operating_cycle()
returns jsonb language plpgsql security definer set search_path=public as $$
declare intel jsonb; rec jsonb; pf uuid; sec jsonb; verify jsonb; routed int; safe int;
begin
 perform public.hq_assert_owner();
 intel:=public.hq_run_company_intelligence_v2();
 pf:=public.hq_detect_policy_failure_burst();
 sec:=public.hq_detect_security_signals();
 rec:=public.hq_reconcile_findings();
 routed:=public.hq_route_work_items();
 safe:=public.hq_workforce_execute_safe_queue();
 verify:=public.hq_reconcile_product_event_verifications();
 return jsonb_build_object('intelligence',intel,'policyFailureFinding',pf,'security',sec,'reconciliation',rec,'routedWorkItems',routed,'safeWorkforceRuns',safe,'productVerification',verify,'completed_at',now());
end $$;
revoke all on function public.hq_run_operating_cycle() from public,anon;
grant execute on function public.hq_run_operating_cycle() to authenticated;

do $$ declare r record; begin for r in select id from public.platform_events where occurred_at>=now()-interval '7 days' order by occurred_at loop perform public.hq_trace_product_event(r.id); end loop; end $$;
