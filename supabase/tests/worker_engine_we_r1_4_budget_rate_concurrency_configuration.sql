-- WE-R1.4.7 governed capability-limit configuration contract.
begin;

do $$
begin
  if to_regprocedure('public.hq_workforce_configure_draft_capability_execution_limits(uuid,integer,integer,integer,integer,integer)') is null then
    raise exception 'draft capability limit configurator missing';
  end if;
  if has_function_privilege('anon','public.hq_workforce_configure_draft_capability_execution_limits(uuid,integer,integer,integer,integer,integer)','EXECUTE')
     or has_function_privilege('authenticated','public.hq_workforce_configure_draft_capability_execution_limits(uuid,integer,integer,integer,integer,integer)','EXECUTE') then
    raise exception 'product role can configure capability execution limits';
  end if;
  if not has_function_privilege('service_role','public.hq_workforce_configure_draft_capability_execution_limits(uuid,integer,integer,integer,integer,integer)','EXECUTE') then
    raise exception 'service_role governed draft configurator missing';
  end if;
end $$;

-- Invalid values fail before authority lookup, proving all five ceilings are bounded inputs.
do $$
declare failed boolean;
begin
  failed:=false; begin perform public.hq_workforce_configure_draft_capability_execution_limits(gen_random_uuid(),0,1,1,1,100); exception when others then failed:=position('cycle_limit_invalid' in sqlerrm)>0; end; if not failed then raise exception 'invalid cycle ceiling accepted'; end if;
  failed:=false; begin perform public.hq_workforce_configure_draft_capability_execution_limits(gen_random_uuid(),1,0,1,1,100); exception when others then failed:=position('record_limit_invalid' in sqlerrm)>0; end; if not failed then raise exception 'invalid record ceiling accepted'; end if;
  failed:=false; begin perform public.hq_workforce_configure_draft_capability_execution_limits(gen_random_uuid(),1,1,0,1,100); exception when others then failed:=position('concurrency_invalid' in sqlerrm)>0; end; if not failed then raise exception 'invalid concurrency ceiling accepted'; end if;
  failed:=false; begin perform public.hq_workforce_configure_draft_capability_execution_limits(gen_random_uuid(),1,1,1,0,100); exception when others then failed:=position('rate_invalid' in sqlerrm)>0; end; if not failed then raise exception 'invalid rate ceiling accepted'; end if;
  failed:=false; begin perform public.hq_workforce_configure_draft_capability_execution_limits(gen_random_uuid(),1,1,1,1,49); exception when others then failed:=position('runtime_invalid' in sqlerrm)>0; end; if not failed then raise exception 'invalid runtime ceiling accepted'; end if;
end $$;

-- Missing grants never create configuration rows or authority.
do $$
declare failed boolean:=false;
begin
  begin
    perform public.hq_workforce_configure_draft_capability_execution_limits(gen_random_uuid(),1,1,1,1,100);
  exception when others then failed:=position('capability_authority_not_found' in sqlerrm)>0; end;
  if not failed then raise exception 'missing authority configured'; end if;
end $$;

rollback;
