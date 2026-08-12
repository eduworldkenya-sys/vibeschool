-- Worker Engine WE-L5: deterministic-first Model Gateway.
-- access: service-only public.hq_workforce_model_invocations
-- authorization-test: public.hq_workforce_model_invocations anon/authenticated denied; service_role only.

create table public.hq_workforce_model_invocations (
 id uuid primary key default gen_random_uuid(), worker_key text not null references public.hq_workforce_workers(worker_key) on delete restrict,
 task_id uuid references public.hq_workforce_task_contracts(id) on delete restrict,
 reason_code text not null, deterministic_attempted boolean not null,
 deterministic_failure_evidence jsonb not null default '{}'::jsonb,
 model_key text not null, token_budget bigint not null check(token_budget>0),
 status text not null check(status in ('authorized','denied','completed','failed')),
 created_at timestamptz not null default now()
);

create or replace function public.hq_workforce_authorize_model_call(p_worker_key text,p_task_id uuid,p_reason_code text,p_failure_evidence jsonb,p_model_key text,p_token_budget bigint)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
 perform public.hq_workforce_assert_identity(p_worker_key);
 perform public.hq_workforce_assert_certification(p_worker_key);
 if public.hq_workforce_current_lifecycle_state(p_worker_key)<>'active' then raise exception 'worker_not_active'; end if;
 if p_reason_code not in ('semantic_ambiguity','unstructured_synthesis','novel_classification') then raise exception 'model_reason_not_allowlisted'; end if;
 if coalesce(p_failure_evidence,'{}'::jsonb)='{}'::jsonb then raise exception 'deterministic_failure_evidence_required'; end if;
 if p_token_budget<1 then raise exception 'model_token_budget_required'; end if;
 perform public.hq_workforce_reserve_budget(p_worker_key,'model_tokens',p_token_budget);
 insert into public.hq_workforce_model_invocations(worker_key,task_id,reason_code,deterministic_attempted,deterministic_failure_evidence,model_key,token_budget,status)
 values(p_worker_key,p_task_id,p_reason_code,true,p_failure_evidence,p_model_key,p_token_budget,'authorized') returning id into v_id;
 return v_id;
end $$;

alter table public.hq_workforce_model_invocations enable row level security;
revoke all on table public.hq_workforce_model_invocations from public,anon,authenticated,service_role;
grant select,insert,update,delete on table public.hq_workforce_model_invocations to service_role;
revoke all on function public.hq_workforce_authorize_model_call(text,uuid,text,jsonb,text,bigint) from public,anon,authenticated;
grant execute on function public.hq_workforce_authorize_model_call(text,uuid,text,jsonb,text,bigint) to service_role;
