-- Disposable PostgreSQL verification, no user data or external services.
-- All exposed Success Wishes SQL functions must remain deny-by-default for
-- anonymous clients. The five authenticated functions have explicit internal
-- school/owner guards and are separately exercised in the adversarial suite.
do $sw_acl$
declare f record; staff_function boolean;
begin
  for f in
    select p.oid, p.proname, p.prosecdef, p.proconfig
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'success_wishes_%'
  loop
    staff_function := f.proname = any(array[
      'success_wishes_owner_schools',
      'success_wishes_reset_access',
      'success_wishes_resolve_report',
      'success_wishes_set_school_participation',
      'success_wishes_set_sponsored_pilot'
    ]);
    if has_function_privilege('anon',f.oid,'EXECUTE') then
      raise exception 'Anonymous SQL execute leaked: %', f.proname;
    end if;
    if has_function_privilege('authenticated',f.oid,'EXECUTE') <> staff_function then
      raise exception 'Incorrect authenticated SQL execute: %', f.proname;
    end if;
    if f.prosecdef <> staff_function then
      raise exception 'Unexpected SECURITY DEFINER setting: %', f.proname;
    end if;
    if f.proconfig is null or not (
      f.proconfig @> array['search_path=']::text[]
      or f.proconfig @> array['search_path=""']::text[]
    ) then
      raise exception 'Function search_path not pinned to empty: %', f.proname;
    end if;
  end loop;

  if (select count(*) from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname like 'success_wishes_%') <> 10 then
    raise exception 'Unexpected Success Wishes function inventory';
  end if;
end $sw_acl$;
select 'Success Wishes function grants, SECURITY DEFINER and search paths passed' as result;
