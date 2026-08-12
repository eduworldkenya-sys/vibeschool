begin;

-- Anonymous access is retained only for explicitly public, read-oriented
-- reader/telemetry endpoints. All identity-, school-, learner-, finance-,
-- authoring-, and mutation-oriented SECURITY DEFINER RPCs require sign-in.
do $block$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure::text as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('anon', p.oid, 'execute')
      and p.oid::regprocedure::text not in (
        'fn_invitation_attempt(text,boolean)',
        'get_vibetextbook_reader(uuid)',
        'increment_publication_reads(uuid,uuid)',
        'increment_view_count(uuid)',
        'increment_view_count(uuid,uuid)'
      )
  loop
    execute format('revoke execute on function %s from public, anon', r.signature);
    execute format('grant execute on function %s to authenticated, service_role', r.signature);
  end loop;
end
$block$;

-- Inventory mutations must be backend-only.
do $block$
begin
  if to_regprocedure('public.increment_available_copies(uuid)') is not null then
    revoke execute on function public.increment_available_copies(uuid) from public, anon, authenticated;
    grant execute on function public.increment_available_copies(uuid) to service_role;
  end if;
end
$block$;

commit;
