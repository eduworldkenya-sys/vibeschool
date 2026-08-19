\set ON_ERROR_STOP on

begin;

do $$
declare v_def text;
begin
  select pg_get_functiondef('public.attach_commerce_mpesa_request(uuid,text,text,jsonb)'::regprocedure) into v_def;
  if v_def not like '%commerce_payment_callback_events%'
     or v_def not like '%process_commerce_payment_callback_event%'
     or v_def not like '%early_callback_replayed%'
     or v_def not like '%reconciliation_required%' then
    raise exception 'task19: callback-before-client/provider-response replay contract missing';
  end if;
  if has_function_privilege('anon','public.attach_commerce_mpesa_request(uuid,text,text,jsonb)','EXECUTE')
     or has_function_privilege('authenticated','public.attach_commerce_mpesa_request(uuid,text,text,jsonb)','EXECUTE')
     or not has_function_privilege('service_role','public.attach_commerce_mpesa_request(uuid,text,text,jsonb)','EXECUTE') then
    raise exception 'task19: provider request attachment authority boundary incorrect';
  end if;
end $$;

rollback;
\echo 'Task 19 Callback Ordering Contract: PASS'
