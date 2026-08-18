-- WE-R1.3X X2 Memory/Context Fabric regression and adversarial tests.
begin;

do $$
begin
  if to_regclass('public.hq_workforce_memory_records') is null then raise exception 'memory records missing'; end if;
  if to_regclass('public.hq_workforce_objective_context') is null then raise exception 'objective context missing'; end if;
  if to_regclass('public.hq_workforce_memory_events') is null then raise exception 'memory events missing'; end if;
end $$;

do $$
declare r text;
begin
  foreach r in array array['public','anon','authenticated'] loop
    if has_table_privilege(r,'public.hq_workforce_memory_records','SELECT')
       or has_table_privilege(r,'public.hq_workforce_memory_records','INSERT')
       or has_table_privilege(r,'public.hq_workforce_memory_records','UPDATE')
       or has_table_privilege(r,'public.hq_workforce_memory_records','DELETE') then
      raise exception 'unexpected memory privilege for %',r;
    end if;
  end loop;
end $$;

-- Service transport must never manufacture authoritative or verified institutional truth.
do $$
begin
  begin
    perform public.hq_workforce_add_memory('X2-BAD-AUTH-'||gen_random_uuid()::text,'fact','{"value":1}','{"source":"test"}','test',null,0.8,'unverified',true);
    raise exception 'unverified authoritative memory accepted';
  exception when others then if sqlerrm='unverified authoritative memory accepted' then raise; end if; end;

  begin
    perform public.hq_workforce_add_memory('X2-BAD-VERIFIED-'||gen_random_uuid()::text,'fact','{"value":1}','{"source":"test"}','test',null,0.8,'verified',false);
    raise exception 'service transport created verified memory';
  exception when others then if sqlerrm='service transport created verified memory' then raise; end if; end;

  begin
    perform public.hq_workforce_add_memory('X2-BAD-HYP-'||gen_random_uuid()::text,'hypothesis','{"value":1}','{"source":"test"}','test',null,0.8,'verified',true);
    raise exception 'authoritative hypothesis accepted';
  exception when others then if sqlerrm='authoritative hypothesis accepted' then raise; end if; end;
end $$;

-- Corroborated non-authoritative evidence may be captured with provenance.
do $$
declare mid uuid;
begin
  mid:=public.hq_workforce_add_memory('X2-FACT-'||gen_random_uuid()::text,'fact','{"value":"known"}','{"source":"x2-suite"}','test','case-1',0.95,'corroborated',false,'platform_internal','{}',array['internal'],array['global']);
  if mid is null then raise exception 'valid memory create failed'; end if;
  if (select verification_state from public.hq_workforce_memory_records where id=mid)<>'corroborated' then raise exception 'corroborated memory state changed'; end if;
  if (select authoritative from public.hq_workforce_memory_records where id=mid) then raise exception 'transport memory became authoritative'; end if;
  if (select count(*) from public.hq_workforce_memory_events where memory_id=mid and event_kind='created')<>1 then raise exception 'memory creation evidence missing'; end if;
end $$;

-- Stale context must fail closed.
do $$
declare oid uuid; mid uuid;
begin
  oid:=public.hq_workforce_create_objective('X2-OBJ-'||gen_random_uuid()::text,'test',null,'Validate stale context rejection','platform_internal','{}','[]','[]','[]',50::smallint,0::smallint,null,'{"suite":"x2"}',null);
  mid:=public.hq_workforce_add_memory('X2-STALE-'||gen_random_uuid()::text,'observation','{"state":"old"}','{"source":"x2-suite"}','test',null,0.7,'corroborated',false,'platform_internal','{}',array['internal'],array['global'],clock_timestamp()-interval '2 hours',clock_timestamp()-interval '1 hour',clock_timestamp()-interval '2 hours');
  begin
    perform public.hq_workforce_bind_objective_context(oid,mid,'supporting','must reject stale memory',null);
    raise exception 'stale memory bound to objective';
  exception when others then if sqlerrm='stale memory bound to objective' then raise; end if; end;
end $$;

-- Contradictory active memories must not be silently selected as governed objective context.
do $$
declare oid uuid; m1 uuid; m2 uuid; grp text:='X2-C-'||gen_random_uuid()::text;
begin
  oid:=public.hq_workforce_create_objective('X2-CONTRA-OBJ-'||gen_random_uuid()::text,'test',null,'Validate contradiction rejection','platform_internal','{}','[]','[]','[]',50::smallint,0::smallint,null,'{"suite":"x2"}',null);
  m1:=public.hq_workforce_add_memory('X2-C1-'||gen_random_uuid()::text,'fact','{"answer":"A"}','{"source":"one"}','test',null,0.8,'corroborated',false,'platform_internal','{}',array['internal'],array['global'],clock_timestamp(),null,clock_timestamp(),null,grp);
  m2:=public.hq_workforce_add_memory('X2-C2-'||gen_random_uuid()::text,'fact','{"answer":"B"}','{"source":"two"}','test',null,0.8,'corroborated',false,'platform_internal','{}',array['internal'],array['global'],clock_timestamp(),null,clock_timestamp(),null,grp);
  begin
    perform public.hq_workforce_bind_objective_context(oid,m1,'supporting','contradiction must fail closed',null);
    raise exception 'contradictory memory bound';
  exception when others then if sqlerrm='contradictory memory bound' then raise; end if; end;
end $$;

-- Supersession must demote prior memory and preserve lineage without granting authority.
do $$
declare old_id uuid; new_id uuid; key text:='X2-V-'||gen_random_uuid()::text;
begin
  old_id:=public.hq_workforce_add_memory(key,'fact','{"v":1}','{"source":"old"}','test',null,0.9,'corroborated',false);
  new_id:=public.hq_workforce_add_memory(key,'fact','{"v":2}','{"source":"new"}','test',null,0.95,'corroborated',false,'platform_internal','{}',array['internal'],array['global'],clock_timestamp(),null,clock_timestamp(),old_id);
  if (select verification_state from public.hq_workforce_memory_records where id=old_id)<>'superseded' then raise exception 'superseded memory not demoted'; end if;
  if (select authoritative from public.hq_workforce_memory_records where id=old_id) then raise exception 'superseded memory stayed authoritative'; end if;
  if (select supersedes_id from public.hq_workforce_memory_records where id=new_id)<>old_id then raise exception 'supersession lineage missing'; end if;
  if (select authoritative from public.hq_workforce_memory_records where id=new_id) then raise exception 'replacement memory became authoritative'; end if;
end $$;

-- History is append-only.
do $$
declare eid bigint;
begin
  select id into eid from public.hq_workforce_memory_events order by id desc limit 1;
  begin
    update public.hq_workforce_memory_events set reason='tamper' where id=eid;
    raise exception 'memory history mutation accepted';
  exception when others then if sqlerrm='memory history mutation accepted' then raise; end if; end;
end $$;

-- Runtime remains L0/OFF.
do $$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false) or coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0 or coalesce(ec.runtime_max_risk,0)<>0 then raise exception 'X2 changed runtime boundary'; end if;
end $$;

rollback;
