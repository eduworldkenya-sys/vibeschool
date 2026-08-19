-- HQ Schools Network Operating System structural/security contract.
-- Disposable reconstructed database only.
begin;

do $$
declare sig text; r text; p record;
begin
  foreach sig in array array[
    'public.hq_school_network_overview(integer)',
    'public.hq_school_network_trend(integer)',
    'public.hq_school_network_county_detail(text,integer)',
    'public.hq_school_network_school_360(uuid,integer)',
    'public.hq_school_network_school_learning(uuid,integer)'
  ] loop
    if to_regprocedure(sig) is null then raise exception 'missing HQ School Network RPC %',sig; end if;
    foreach r in array array['public','anon'] loop
      if has_function_privilege(r,sig,'EXECUTE') then raise exception 'unexpected % execute on %',r,sig; end if;
    end loop;
    if not has_function_privilege('authenticated',sig,'EXECUTE') then raise exception 'authenticated transport execute missing on %',sig; end if;
    select pr.prosecdef,coalesce(array_to_string(pr.proconfig,','),'') cfg,pg_get_functiondef(pr.oid) def into p from pg_proc pr where pr.oid=to_regprocedure(sig);
    if not p.prosecdef then raise exception '% must be SECURITY DEFINER',sig; end if;
    if p.cfg not like '%search_path=public, pg_temp%' and p.cfg not like '%search_path=public,pg_temp%' then raise exception '% fixed search_path missing: %',sig,p.cfg; end if;
    if position('hq_assert_owner' in p.def)=0 then raise exception '% owner assertion missing',sig; end if;
  end loop;
end $$;

do $$
declare sig text; d text;
begin
  foreach sig in array array[
    'public.hq_list_school_identity_queue(text,integer)',
    'public.hq_review_school_identity_candidate(uuid,text,uuid,text,text)',
    'public.hq_resolve_school_discovery_request(uuid,text,uuid,text,text,text)',
    'public.hq_school_identity_coverage_by_county()'
  ] loop
    if not has_function_privilege('authenticated',sig,'EXECUTE') then raise exception 'owner browser transport missing on %',sig; end if;
    if has_function_privilege('anon',sig,'EXECUTE') or has_function_privilege('public',sig,'EXECUTE') then raise exception 'anonymous/public execution leaked on %',sig; end if;
    d:=pg_get_functiondef(sig::regprocedure);
    if position('is_platform_owner' in d)=0 and position('hq_assert_owner' in d)=0 then raise exception 'owner authorization missing on %',sig; end if;
  end loop;
end $$;

do $$
declare d text; n text;
begin
  d:=pg_get_functiondef('public.hq_school_network_overview(integer)'::regprocedure);
  n:=replace(d,' ','');
  if position('''administrative_regions'',47' in n)=0 then raise exception '47-county country contract missing'; end if;
  if position('''West Pokot'',47' in d)=0 or position('''Baringo'',1' in d)=0 then raise exception 'Kenya county boundary list incomplete'; end if;
  if position('join connected c on c.school_id=pe.school_id' in lower(d))=0 then raise exception 'active school stage must be bounded by connected schools'; end if;
end $$;

do $$
declare d text; n text;
begin
  d:=pg_get_functiondef('public.hq_school_network_school_360(uuid,integer)'::regprocedure);
  n:=lower(regexp_replace(d,'\s+','','g'));
  if position('''reported_students'',null' in n)=0 or position('''reported_staff'',null' in n)=0 then raise exception 'unknown institution population semantics missing'; end if;
  if position('''penetration_claimable'',false' in n)=0 then raise exception 'penetration must fail closed without authoritative denominator'; end if;
  if position('''institution_paid_claimable'',false' in n)=0 then raise exception 'institution-paid revenue must not be inferred'; end if;
  if position('distincto.id' in n)=0 then raise exception 'revenue attribution must de-duplicate paid orders'; end if;
  if position('full_name' in d)>0 or position('date_of_birth' in d)>0 then raise exception 'School 360 read model exposes personal profile PII'; end if;
end $$;

do $$
declare d text; n text;
begin
  d:=pg_get_functiondef('public.hq_school_network_school_learning(uuid,integer)'::regprocedure);
  n:=lower(regexp_replace(d,'\s+','','g'));
  if position('''usage_only'',true' in n)=0 then raise exception 'learning usage semantic missing'; end if;
  if position('''learning_outcome_claimed'',false' in n)=0 or position('''retention_claimed'',false' in n)=0 then raise exception 'unsupported learning/retention claim guard missing'; end if;
  if position('public.teaching_occurrences' in d)=0 or position('public.attendance' in d)=0 or position('public.homework' in d)=0 or position('public.assessment_attempts' in d)=0 then raise exception 'School learning evidence sources incomplete'; end if;
end $$;

do $$
declare d text;
begin
  d:=lower(pg_get_functiondef('public.hq_school_network_trend(integer)'::regprocedure));
  if position('join connected c on c.school_id=pe.school_id' in d)=0 then raise exception 'trend activity not restricted to connected schools'; end if;
  if position('count(distinct pe.actor_id)' in d)=0 then raise exception 'trend active user de-duplication missing'; end if;
  if position('min(sm.joined_at)' in d)=0 then raise exception 'connected school first-connection semantics missing'; end if;
end $$;

rollback;