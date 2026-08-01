do $migration$
declare
  r record;
  v_path text;
begin
  v_path := case
    when exists (select 1 from pg_namespace where nspname = 'extensions')
      then 'public, extensions, pg_temp'
    else 'public, pg_temp'
  end;

  for r in
    select p.oid::regprocedure::text as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    left join pg_depend d
      on d.classid = 'pg_proc'::regclass
     and d.objid = p.oid
     and d.deptype = 'e'
    where n.nspname = 'public'
      and d.objid is null
      and pg_get_userbyid(p.proowner) = current_user
      and not exists (
        select 1
        from unnest(coalesce(p.proconfig, array[]::text[])) cfg
        where cfg like 'search_path=%'
      )
  loop
    execute format('alter function %s set search_path = %s', r.signature, v_path);
  end loop;
end
$migration$;
