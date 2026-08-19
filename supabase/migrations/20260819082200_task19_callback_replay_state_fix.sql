begin;

create or replace function public.attach_commerce_mpesa_request(
  p_attempt_id uuid,
  p_checkout_request_id text,
  p_merchant_request_id text,
  p_provider_response jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event_id uuid;
  v_processed jsonb;
  v_state text;
begin
  if current_user not in ('postgres','service_role') then raise exception 'service_role_required'; end if;
  if nullif(btrim(coalesce(p_checkout_request_id,'')),'') is null then
    return jsonb_build_object('success',false,'error','missing_checkout_request_id');
  end if;

  update public.commerce_payment_attempts
  set checkout_request_id=btrim(p_checkout_request_id),
      merchant_request_id=nullif(btrim(coalesce(p_merchant_request_id,'')),''),
      provider_response=coalesce(p_provider_response,'{}'::jsonb),
      state='awaiting_customer',updated_at=now()
  where id=p_attempt_id and state='submitting';
  if not found then return jsonb_build_object('success',false,'error','attempt_not_submitting'); end if;

  select e.id into v_event_id
  from public.commerce_payment_callback_events e
  where e.checkout_request_id=btrim(p_checkout_request_id)
    and e.processing_status<>'processed'
  order by e.received_at asc
  limit 1;

  if v_event_id is not null then
    v_processed:=public.process_commerce_payment_callback_event(v_event_id);
    if coalesce((v_processed->>'success')::boolean,false) is not true then
      update public.commerce_payment_attempts
      set state='reconciliation_required',
          processing_error=coalesce(v_processed->>'error','early_callback_replay_failed'),
          updated_at=now()
      where id=p_attempt_id and state<>'settled';
      select state into v_state from public.commerce_payment_attempts where id=p_attempt_id;
      return jsonb_build_object(
        'success',false,'error','early_callback_replay_failed','state',coalesce(v_state,'reconciliation_required'),
        'early_callback_replayed',true,'callback_result',v_processed
      );
    end if;

    select state into v_state from public.commerce_payment_attempts where id=p_attempt_id;
    return jsonb_build_object(
      'success',true,'state',coalesce(v_state,'reconciliation_required'),
      'early_callback_replayed',true,'callback_result',v_processed
    );
  end if;

  return jsonb_build_object('success',true,'state','awaiting_customer','early_callback_replayed',false);
exception
  when unique_violation then
    update public.commerce_payment_attempts
    set state='reconciliation_required',processing_error='duplicate_checkout_request_id',updated_at=now()
    where id=p_attempt_id;
    return jsonb_build_object('success',false,'error','duplicate_checkout_request_id','state','reconciliation_required');
end;
$function$;

revoke all on function public.attach_commerce_mpesa_request(uuid,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.attach_commerce_mpesa_request(uuid,text,text,jsonb) to service_role;

commit;
