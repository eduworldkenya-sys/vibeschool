-- Recovered verbatim from the production Supabase migration ledger for L0 replay parity.
create or replace function public.hq_context_scope_allows(p_scope_id uuid,p_fact_key text) returns boolean language sql stable security invoker set search_path=public as $$
 select exists(select 1 from public.hq_context_scopes s where s.id=p_scope_id and cardinality(s.allowed_fact_keys)>0 and p_fact_key=any(s.allowed_fact_keys) and not p_fact_key=any(s.denied_fact_keys));
$$;
create or replace function public.hq_context_resolve(p_scope_id uuid,p_fact_keys text[] default null) returns table(fact_key text,value jsonb,confidence numeric,computed_at timestamptz,freshness_expires_at timestamptz,is_fresh boolean,fact_definition_id uuid) language sql stable security invoker set search_path=public as $$
 select c.fact_key,c.value,c.confidence,c.computed_at,c.freshness_expires_at,(c.freshness_expires_at>now()),c.fact_definition_id from public.hq_context_facts_cache c join public.hq_context_scopes s on s.id=c.scope_id where c.scope_id=p_scope_id and cardinality(s.allowed_fact_keys)>0 and c.fact_key=any(s.allowed_fact_keys) and not c.fact_key=any(s.denied_fact_keys) and (p_fact_keys is null or c.fact_key=any(p_fact_keys));
$$;
revoke all on function public.hq_context_scope_allows(uuid,text) from public,anon,authenticated;
revoke all on function public.hq_context_resolve(uuid,text[]) from public,anon,authenticated;
