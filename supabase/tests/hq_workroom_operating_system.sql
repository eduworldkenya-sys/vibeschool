begin;
do $$ declare sig text; begin
  foreach sig in array array[
    'public.hq_workroom_list(text,text,integer)','public.hq_workroom_get_item(uuid)',
    'public.hq_workroom_assign(uuid,uuid,text,bigint)','public.hq_workroom_act(uuid,text,text,bigint)',
    'public.hq_workroom_add_update(uuid,text,text,jsonb)','public.hq_workroom_add_link(uuid,text,text,text,jsonb)'
  ] loop
    if to_regprocedure(sig) is null then raise exception 'missing %',sig; end if;
    if has_function_privilege('anon',sig,'EXECUTE') then raise exception 'anon execute on %',sig; end if;
    if not has_function_privilege('authenticated',sig,'EXECUTE') then raise exception 'authenticated transport missing on %',sig; end if;
  end loop;
end $$;
do $$ declare p record; d text; begin
  for p in select oid,proname,prosecdef,coalesce(array_to_string(proconfig,','),'') cfg from pg_proc where pronamespace='public'::regnamespace and proname like 'hq_workroom_%' loop
    if not p.prosecdef and p.proname not in('hq_workroom_block_update_delete') then raise exception '% must be security definer',p.proname; end if;
    if p.prosecdef and p.cfg not like '%search_path=public, pg_temp%' and p.cfg not like '%search_path=public,pg_temp%' then raise exception '% fixed search path missing',p.proname; end if;
  end loop;
  d:=pg_get_functiondef('public.hq_workroom_act(uuid,text,text,bigint)'::regprocedure);
  if position('workroom.authorize' in d)=0 or position('workroom.cancel' in d)=0 or position('workroom.verify' in d)=0 then raise exception 'granular mutation permissions missing'; end if;
  if position('workroom_stale_item' in d)=0 or position('workroom_transition_denied' in d)=0 then raise exception 'concurrency or transition guard missing'; end if;
  d:=pg_get_functiondef('public.hq_workroom_has_permission(text)'::regprocedure);
  if position('hq.view' in d)>0 then raise exception 'generic HQ view must not grant Workroom mutation authority'; end if;
end $$;
do $$ begin
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='hq_work_items' and column_name='affected_persona') then raise exception 'persona impact missing'; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='hq_work_items' and column_name='delivery_status') then raise exception 'delivery truth missing'; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='hq_work_items' and column_name='version') then raise exception 'optimistic concurrency missing'; end if;
end $$;
rollback;
\echo 'HQ_WORKROOM_OPERATING_SYSTEM_PASS'
