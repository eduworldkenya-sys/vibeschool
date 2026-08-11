begin;

-- Canonical production hardening migration.
-- Some privileged RPCs existed in production before tracked migration history
-- began and several are no longer present in the current production catalog.
-- Harden each legacy signature only when it exists so blank replay does not
-- fabricate obsolete privileged APIs merely to satisfy GRANT/REVOKE/ALTER.
do $$
declare
  fn regprocedure;
  sig text;
  app_rpc_signatures text[] := array[
    'public.admin_add_student(text,text,text,text,uuid,uuid)',
    'public.teacher_add_student(text,text,uuid,uuid)',
    'public.create_child_for_parent(text,date,uuid)',
    'public.create_school_with_admin(uuid,text,text,text,text)',
    'public.join_school_as_admin(uuid,text,uuid)',
    'public.onboard_teacher_class(uuid,uuid,text,text,text)',
    'public.purchase_credits(uuid,integer,text)',
    'public.purchase_credits(uuid,uuid,text)',
    'public.spend_credit(uuid,text,integer,text)'
  ];
  backend_rpc_signatures text[] := array[
    'public.fn_nightly_maintenance()',
    'public.fn_write_health_log(uuid,text,text,integer,text,text,numeric)'
  ];
begin
  foreach sig in array app_rpc_signatures loop
    fn := to_regprocedure(sig);
    if fn is not null then
      execute format('revoke execute on function %s from public, anon', fn);
      execute format('grant execute on function %s to authenticated, service_role', fn);
      execute format('alter function %s set search_path = public, pg_temp', fn);
    end if;
  end loop;

  foreach sig in array backend_rpc_signatures loop
    fn := to_regprocedure(sig);
    if fn is not null then
      execute format('revoke execute on function %s from public, anon, authenticated', fn);
      execute format('grant execute on function %s to service_role', fn);
      execute format('alter function %s set search_path = public, pg_temp', fn);
    end if;
  end loop;
end
$$;

commit;
