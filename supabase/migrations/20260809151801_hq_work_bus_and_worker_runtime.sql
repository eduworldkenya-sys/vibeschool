-- Recovered verbatim from the production Supabase migration ledger for L0 replay parity.
create table if not exists public.hq_workforce_runs(
 id uuid primary key default gen_random_uuid(), work_item_id uuid references public.hq_work_items(id) on delete set null, lane_key text not null references public.hq_workforce_lanes(lane_key), worker_id uuid not null references public.hq_workforce_workers(id), skill_id uuid references public.hq_workforce_skills(id), trigger_type text not null check(trigger_type in ('event','schedule','manual','retry')), status text not null default 'queued' check(status in ('queued','running','decision_required','blocked','completed','failed','verified')), authority_result text not null default 'allow' check(authority_result in ('allow','approval_required','deny')), execution_evidence jsonb not null default '{}'::jsonb, started_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now(), unique(work_item_id,lane_key)
);
alter table public.hq_workforce_runs enable row level security; revoke all on public.hq_workforce_runs from anon,authenticated;
create or replace function public.hq_workforce_lane_for_work(p_department text,p_work_type text,p_source_type text) returns text language sql immutable as $$
 select case
  when p_department in ('security','auth') or coalesce(p_work_type,'') ilike '%security%' then 'security'
  when p_department in ('content','curriculum','publishing') or coalesce(p_work_type,'') ilike any(array['%curriculum%','%content%','%publication%']) then 'curriculum-intelligence'
  when p_department in ('growth','marketing','sales') or coalesce(p_work_type,'') ilike any(array['%growth%','%conversion%','%retention%']) then 'growth'
  when p_department in ('product','quality') or coalesce(p_work_type,'') ilike any(array['%quality%','%regression%','%bug%']) then 'product-quality'
  else 'operations' end;
$$;
create or replace function public.hq_workforce_enqueue_unrouted_work() returns integer language plpgsql security invoker set search_path=public as $$ declare r record; lane text; wid uuid; sid uuid; n integer:=0; begin
 for r in select * from public.hq_work_items where status not in ('resolved','closed','done') loop
  lane:=public.hq_workforce_lane_for_work(r.department_key,r.work_type,r.source_type);
  select l.owner_worker_id into wid from public.hq_workforce_lanes l join public.hq_workforce_workers w on w.id=l.owner_worker_id where l.lane_key=lane and l.active and w.status='active';
  if wid is null then continue; end if;
  insert into public.hq_workforce_runs(work_item_id,lane_key,worker_id,skill_id,trigger_type,status,authority_result,execution_evidence)
  select r.id,lane,wid,s.id,'event',case when r.approval_required then 'decision_required' else 'queued' end,case when r.approval_required then 'approval_required' else 'allow' end,jsonb_build_object('routed_from',r.department_key,'work_type',r.work_type,'source_type',r.source_type)
  from public.hq_workforce_skills s where s.lane_key=lane and s.status='certified' order by s.version desc limit 1
  on conflict(work_item_id,lane) do nothing;
  if found then update public.hq_work_items set route=lane,updated_at=now() where id=r.id; n:=n+1; end if;
 end loop; return n; end $$;
create or replace function public.hq_workforce_execute_safe_queue() returns integer language plpgsql security invoker set search_path=public as $$ declare r record; n integer:=0; begin
 for r in select wr.id,wr.work_item_id,wr.lane_key,wr.worker_id,w.worker_key,wi.title,wi.work_type from public.hq_workforce_runs wr join public.hq_workforce_workers w on w.id=wr.worker_id left join public.hq_work_items wi on wi.id=wr.work_item_id where wr.status='queued' and wr.authority_result='allow' loop
  update public.hq_workforce_runs set status='running',started_at=now() where id=r.id;
  update public.hq_workforce_runs set status='completed',completed_at=now(),execution_evidence=execution_evidence||jsonb_build_object('execution_method','deterministic','action','triage_and_own','worker_key',r.worker_key,'completed_at',now()) where id=r.id;
  update public.hq_work_items set action_taken=coalesce(action_taken,'{}'::jsonb)||jsonb_build_object('workforce_lane',r.lane_key,'worker_key',r.worker_key,'action','triage_and_own'),acted_at=coalesce(acted_at,now()),updated_at=now() where id=r.work_item_id;
  n:=n+1;
 end loop; return n; end $$;
revoke all on function public.hq_workforce_lane_for_work(text,text,text) from public,anon,authenticated;
revoke all on function public.hq_workforce_enqueue_unrouted_work() from public,anon,authenticated;
revoke all on function public.hq_workforce_execute_safe_queue() from public,anon,authenticated;
