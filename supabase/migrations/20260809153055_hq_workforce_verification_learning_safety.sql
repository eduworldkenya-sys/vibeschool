-- Recovered verbatim from the production Supabase migration ledger for L0 replay parity.
alter table public.hq_workforce_outcome_verifications add column if not exists verifier_kind text not null default 'independent_rule';
alter table public.hq_workforce_outcome_verifications add column if not exists verifier_ref text;
alter table public.hq_workforce_outcome_verifications add column if not exists verification_version integer not null default 1;
create or replace function public.hq_workforce_skill_certifiable(p_skill_id uuid) returns boolean language sql stable security invoker set search_path=public as $$
 select exists(select 1 from public.hq_workforce_skills s where s.id=p_skill_id and s.version>0 and s.status='certified' and jsonb_typeof(s.procedure)='object' and jsonb_array_length(coalesce(s.procedure->'steps','[]'::jsonb))>0 and jsonb_typeof(s.verification)='object' and s.verification <> '{}'::jsonb and jsonb_typeof(s.recovery)='object' and s.recovery <> '{}'::jsonb and s.execution_method in ('none','local_algorithm','local_model','human','external_model'));
$$;
revoke all on function public.hq_workforce_skill_certifiable(uuid) from public,anon,authenticated;
