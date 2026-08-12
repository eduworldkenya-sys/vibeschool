-- Worker Engine WE-L3: shadow execution and certification.
-- access: service-only public.hq_workforce_shadow_runs
-- authorization-test: public.hq_workforce_shadow_runs anon/authenticated denied; service_role only.
-- access: service-only public.hq_workforce_certifications
-- authorization-test: public.hq_workforce_certifications anon/authenticated denied; service_role only.

create table public.hq_workforce_shadow_runs (
 id uuid primary key default gen_random_uuid(), worker_key text not null references public.hq_workforce_workers(worker_key) on delete restrict,
 tool_contract_id uuid not null references public.hq_workforce_tool_contracts(id) on delete restrict,
 input_snapshot jsonb not null, expected_outcome jsonb not null, observed_outcome jsonb not null,
 side_effects_applied boolean not null default false check(side_effects_applied=false),
 verifier_key text not null, passed boolean not null, executed_at timestamptz not null default now()
);
create index hq_workforce_shadow_runs_worker_idx on public.hq_workforce_shadow_runs(worker_key,executed_at desc);

create table public.hq_workforce_certifications (
 id uuid primary key default gen_random_uuid(), worker_key text not null references public.hq_workforce_workers(worker_key) on delete restrict,
 creation_contract_id uuid not null references public.hq_workforce_creation_contracts(id) on delete restrict,
 certification_key text not null unique, status text not null check(status in ('active','expired','revoked')),
 required_shadow_runs integer not null check(required_shadow_runs>=3), passed_shadow_runs integer not null,
 verifier_key text not null, issued_at timestamptz not null default now(), expires_at timestamptz not null,
 revoked_at timestamptz, revocation_reason text, check(expires_at>issued_at), check(passed_shadow_runs>=required_shadow_runs)
);
create unique index hq_workforce_one_active_cert_idx on public.hq_workforce_certifications(worker_key) where status='active';

create or replace function public.hq_workforce_record_shadow_run(p_worker_key text,p_tool_contract_id uuid,p_input jsonb,p_expected jsonb,p_observed jsonb,p_verifier_key text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_pass boolean;
begin
 if public.hq_workforce_current_lifecycle_state(p_worker_key)<>'shadow' then raise exception 'worker_not_in_shadow'; end if;
 if coalesce(trim(p_verifier_key),'')='' then raise exception 'independent_verifier_required'; end if;
 perform 1 from public.hq_workforce_tool_contracts where id=p_tool_contract_id and status='approved'; if not found then raise exception 'approved_tool_required'; end if;
 v_pass := p_expected=p_observed;
 insert into public.hq_workforce_shadow_runs(worker_key,tool_contract_id,input_snapshot,expected_outcome,observed_outcome,verifier_key,passed)
 values(p_worker_key,p_tool_contract_id,p_input,p_expected,p_observed,p_verifier_key,v_pass) returning id into v_id;
 return v_id;
end $$;

create or replace function public.hq_workforce_issue_certification(p_worker_key text,p_creation_contract_id uuid,p_verifier_key text,p_required integer default 3,p_valid_for interval default interval '30 days')
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_passed int; v_id uuid;
begin
 if public.hq_workforce_current_lifecycle_state(p_worker_key)<>'certification_pending' then raise exception 'worker_not_certification_pending'; end if;
 if p_required<3 then raise exception 'minimum_three_shadow_runs'; end if;
 if p_valid_for<=interval '0 seconds' then raise exception 'certification_validity_required'; end if;
 select count(*) into v_passed from public.hq_workforce_shadow_runs where worker_key=p_worker_key and passed and verifier_key=p_verifier_key;
 if v_passed<p_required then raise exception 'insufficient_verified_shadow_runs'; end if;
 insert into public.hq_workforce_certifications(worker_key,creation_contract_id,certification_key,status,required_shadow_runs,passed_shadow_runs,verifier_key,expires_at)
 values(p_worker_key,p_creation_contract_id,p_worker_key||':'||extract(epoch from clock_timestamp())::bigint,'active',p_required,v_passed,p_verifier_key,now()+p_valid_for) returning id into v_id;
 return v_id;
end $$;

create or replace function public.hq_workforce_assert_certification(p_worker_key text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
 select id into v_id from public.hq_workforce_certifications where worker_key=p_worker_key and status='active' and expires_at>now() order by issued_at desc limit 1;
 if v_id is null then raise exception 'worker_certification_invalid'; end if; return v_id;
end $$;

alter table public.hq_workforce_shadow_runs enable row level security; alter table public.hq_workforce_certifications enable row level security;
revoke all on table public.hq_workforce_shadow_runs,public.hq_workforce_certifications from public,anon,authenticated,service_role;
grant select,insert,update,delete on table public.hq_workforce_shadow_runs,public.hq_workforce_certifications to service_role;
revoke all on function public.hq_workforce_record_shadow_run(text,uuid,jsonb,jsonb,jsonb,text),public.hq_workforce_issue_certification(text,uuid,text,integer,interval),public.hq_workforce_assert_certification(text) from public,anon,authenticated;
grant execute on function public.hq_workforce_record_shadow_run(text,uuid,jsonb,jsonb,jsonb,text),public.hq_workforce_issue_certification(text,uuid,text,integer,interval),public.hq_workforce_assert_certification(text) to service_role;
