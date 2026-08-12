-- Recovered verbatim from the production Supabase migration ledger for L0 replay parity.
create table if not exists public.hq_workforce_security_events (
 id uuid primary key default gen_random_uuid(), event_key text not null unique, worker_key text not null, lane_key text, attack_vector text not null, target_ref text not null, status text not null check(status in ('denied','allowed','error')), violation_code text, evidence jsonb not null default '{}'::jsonb, occurred_at timestamptz not null default now()
);
alter table public.hq_workforce_security_events enable row level security;
create or replace function public.hq_workforce_authorize_fact(p_worker_key text,p_fact_key text)
returns table(status text,violation_code text,scope_id uuid) language plpgsql stable security invoker set search_path=public as $$
declare sid uuid;
begin
 select s.id into sid from public.hq_context_scopes s where s.scope_type='worker' and s.scope_owner_key=p_worker_key;
 if sid is null then return query select 'deny'::text,'SCOPE_MISSING'::text,null::uuid; return; end if;
 if not public.hq_context_scope_allows(sid,p_fact_key) then return query select 'deny'::text,'SCOPE_VIOLATION_DIRECT_LEAK'::text,sid; return; end if;
 return query select 'allow'::text,null::text,sid;
end $$;
create or replace function public.hq_workforce_authorize_skill_target(p_worker_key text,p_skill_key text,p_target_fact_key text)
returns table(status text,violation_code text) language plpgsql stable security invoker set search_path=public as $$
declare wid uuid; sid uuid; ok_skill boolean;
begin
 select w.id into wid from public.hq_workforce_workers w where w.worker_key=p_worker_key and w.status='active';
 if wid is null then return query select 'deny'::text,'WORKER_NOT_ACTIVE'::text; return; end if;
 select exists(select 1 from public.hq_workforce_worker_skills ws join public.hq_workforce_skills sk on sk.id=ws.skill_id where ws.worker_id=wid and ws.status='certified' and sk.skill_key=p_skill_key and sk.status='certified') into ok_skill;
 if not ok_skill then return query select 'deny'::text,'SKILL_NOT_CERTIFIED_FOR_WORKER'::text; return; end if;
 select s.id into sid from public.hq_context_scopes s where s.scope_type='worker' and s.scope_owner_key=p_worker_key;
 if sid is null or not public.hq_context_scope_allows(sid,p_target_fact_key) then return query select 'deny'::text,'SCOPE_VIOLATION_INDIRECT_SKILL_OVERRIDE'::text; return; end if;
 return query select 'allow'::text,null::text;
end $$;
create or replace function public.hq_workforce_authorize_snapshot(p_worker_key text,p_snapshot_id uuid)
returns table(status text,violation_code text) language plpgsql stable security invoker set search_path=public as $$
declare sid uuid; f jsonb; k text;
begin
 select s.id into sid from public.hq_context_scopes s where s.scope_type='worker' and s.scope_owner_key=p_worker_key;
 if sid is null then return query select 'deny'::text,'SCOPE_MISSING'::text; return; end if;
 select d.facts into f from public.hq_context_decision_snapshots d where d.id=p_snapshot_id;
 if f is null then return query select 'deny'::text,'SNAPSHOT_NOT_FOUND'::text; return; end if;
 if jsonb_typeof(f) <> 'array' then return query select 'deny'::text,'SNAPSHOT_FORMAT_INVALID'::text; return; end if;
 for k in select elem->>'fact_key' from jsonb_array_elements(f) elem where elem ? 'fact_key' loop
   if not public.hq_context_scope_allows(sid,k) then return query select 'deny'::text,'SCOPE_VIOLATION_SNAPSHOT_MISMATCH'::text; return; end if;
 end loop;
 return query select 'allow'::text,null::text;
end $$;
revoke all on table public.hq_workforce_security_events from anon,authenticated;
revoke all on function public.hq_workforce_authorize_fact(text,text) from public,anon,authenticated;
revoke all on function public.hq_workforce_authorize_skill_target(text,text,text) from public,anon,authenticated;
revoke all on function public.hq_workforce_authorize_snapshot(text,uuid) from public,anon,authenticated;
