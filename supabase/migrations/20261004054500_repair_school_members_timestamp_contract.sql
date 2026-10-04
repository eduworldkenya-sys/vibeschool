-- Repair the canonical school_members timestamp contract.
-- school_members records membership time in joined_at; it has no created_at column.
-- Historical functions that ordered memberships by sm.created_at fail at runtime
-- with: column sm.created_at does not exist.
--
-- Do not rewrite historical migrations. This forward migration repairs the
-- deployed function definitions and keeps fresh database replays correct.

do $$
declare
  r record;
  v_definition text;
begin
  for r in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'ce_get_teacher_derivation_context',
        'get_my_teacher_school_context',
        'record_product_activity'
      )
      and pg_get_functiondef(p.oid) ilike '%sm.created_at%'
  loop
    v_definition := replace(
      pg_get_functiondef(r.oid),
      'sm.created_at',
      'sm.joined_at'
    );
    execute v_definition;
  end loop;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'ce_get_teacher_derivation_context',
        'get_my_teacher_school_context',
        'record_product_activity'
      )
      and pg_get_functiondef(p.oid) ilike '%sm.created_at%'
  ) then
    raise exception 'school_members_timestamp_contract_repair_failed';
  end if;
end
$$;
