\set ON_ERROR_STOP on

-- Runs against the isolated clean-rebuild database. Functions that are live
-- drift but not yet represented in the repository are checked when present.
do $verification$
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
      if has_function_privilege(
        'anon', function_signature, 'execute'
      ) then
        raise exception 'anon can execute internal function %', function_name;
      end if;

      if has_function_privilege(
        'authenticated', function_signature, 'execute'
      ) then
        raise exception
          'authenticated can execute internal function %', function_name;
      end if;

      if not has_function_privilege(
        'service_role', function_signature, 'execute'
      ) then
        raise exception
          'service_role cannot execute internal function %', function_name;
      end if;
    end if;
  end loop;

  if to_regprocedure(
    'public.ce_ingest_released_mark_competency()'
  ) is null then
    raise exception
      'tracked internal function ce_ingest_released_mark_competency is missing';
  end if;
end
$verification$;

select 'INTERNAL FUNCTION PRIVILEGE VERIFICATION PASSED' as result;

