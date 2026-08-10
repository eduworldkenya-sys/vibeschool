-- Internal trigger and maintenance functions must not be callable through
-- PostgREST by anonymous or signed-in application users.
--
-- Three of these functions currently exist only in the live schema. Keeping
-- this migration conditional closes that drift without making clean rebuilds
-- depend on untracked production objects.

do $migration$
declare
  function_name text;
  function_signature regprocedure;
begin
  foreach function_name in array array[
    'public.ce_refresh_mastery_trigger()',
    'public.ce_ingest_released_mark_competency()',
    'public.fn_notify_signup_provisioning_failures()',
    'public.hq_derive_product_signal()'
  ]
  loop
    function_signature := to_regprocedure(function_name);

    if function_signature is not null then
      execute format(
        'revoke all privileges on function %s from public, anon, authenticated',
        function_signature
      );

      execute format(
        'grant execute on function %s to service_role',
        function_signature
      );
    end if;
  end loop;
end
$migration$;

