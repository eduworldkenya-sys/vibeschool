begin;

-- Some privileged RPCs predate repository migration history. Harden every
-- exact signature that exists without making a blank rebuild depend on
-- production-only functions.
do $$
declare
  v_signature text;
  v_backend_only boolean;
begin
  for v_signature, v_backend_only in
    select * from (values
      ('public.admin_add_student(text,text,text,text,uuid,uuid)', false),
      ('public.teacher_add_student(text,text,uuid,uuid)', false),
      ('public.create_child_for_parent(text,date,uuid)', false),
      ('public.create_school_with_admin(uuid,text,text,text,text)', false),
      ('public.join_school_as_admin(uuid,text,uuid)', false),
      ('public.onboard_teacher_class(uuid,uuid,text,text,text)', false),
      ('public.purchase_credits(uuid,integer,text)', false),
      ('public.purchase_credits(uuid,uuid,text)', false),
      ('public.spend_credit(uuid,text,integer,text)', false),
      ('public.fn_nightly_maintenance()', true),
      ('public.fn_write_health_log(uuid,text,text,integer,text,text,numeric)', true)
    ) signatures(signature, backend_only)
  loop
    if to_regprocedure(v_signature) is null then
      raise notice 'P0 hardening: % absent; skipping', v_signature;
      continue;
    end if;

    if v_backend_only then
      execute format(
        'revoke execute on function %s from public, anon, authenticated',
        v_signature
      );
      execute format(
        'grant execute on function %s to service_role',
        v_signature
      );
    else
      execute format(
        'revoke execute on function %s from public, anon',
        v_signature
      );
      execute format(
        'grant execute on function %s to authenticated, service_role',
        v_signature
      );
    end if;

    execute format(
      'alter function %s set search_path = public, pg_temp',
      v_signature
    );
  end loop;
end;
$$;

commit;
