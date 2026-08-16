begin;

-- Financial safety invariant: a teacher can have only one unresolved M-Pesa
-- attempt at a time. This prevents double STK pushes after duplicate clicks,
-- concurrent requests, modal close/reopen, or uncertain provider outcomes.
create unique index if not exists mpesa_payment_attempts_one_unresolved_per_teacher_idx
  on public.mpesa_payment_attempts (teacher_id)
  where state in ('created','submitting','awaiting_customer','reconciliation_required');

-- The provider side effect may be entered exactly once. A conditional UPDATE
-- and RETURNING inside PostgreSQL is the concurrency boundary; callers must not
-- infer success from an HTTP/SDK update that matched zero rows. The database
-- also enforces both release activation and active-teacher eligibility before
-- any request may cross the provider boundary.
create or replace function public.claim_mpesa_payment_attempt(p_attempt_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_claimed uuid;
  v_teacher_id uuid;
  v_runtime_enabled boolean;
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'service_role_required';
  end if;

  select teacher_id into v_teacher_id
  from public.mpesa_payment_attempts
  where id=p_attempt_id and state='created'
  for update;

  if not found then
    return false;
  end if;

  select initiation_enabled into v_runtime_enabled
  from public.mpesa_runtime_control
  where singleton=true;

  if coalesce(v_runtime_enabled,false) is not true then
    update public.mpesa_payment_attempts
       set state='failed',
           processing_error='payment_initiation_runtime_disabled',
           provider_result_desc='M-Pesa initiation is disabled pending release attestation.',
           updated_at=now()
     where id=p_attempt_id and state='created';
    return false;
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id=v_teacher_id
      and p.role='teacher'
      and p.account_status::text='active'
  ) then
    update public.mpesa_payment_attempts
       set state='failed',
           processing_error='teacher_not_eligible_for_billing',
           provider_result_desc='Only an active teacher account may purchase Vibe Credits.',
           updated_at=now()
     where id=p_attempt_id and state='created';
    return false;
  end if;

  update public.mpesa_payment_attempts
     set state='submitting', requested_at=now(), updated_at=now()
   where id=p_attempt_id
     and state='created'
  returning id into v_claimed;

  return v_claimed is not null;
end;
$function$;

revoke all on function public.claim_mpesa_payment_attempt(uuid) from public, anon, authenticated;
grant execute on function public.claim_mpesa_payment_attempt(uuid) to service_role;

-- Once Safaricom has accepted the STK request, attaching its identifiers is a
-- second financial boundary. It must never be inferred from an SDK call that
-- can succeed while matching zero rows. PostgreSQL owns the compare-and-set and
-- returns the authoritative resulting state.
create or replace function public.attach_mpesa_provider_request(
  p_attempt_id uuid,
  p_checkout_request_id text,
  p_merchant_request_id text,
  p_provider_response jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_attempt public.mpesa_payment_attempts%rowtype;
  v_checkout text := nullif(btrim(coalesce(p_checkout_request_id,'')),'');
  v_merchant text := nullif(btrim(coalesce(p_merchant_request_id,'')),'');
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'service_role_required';
  end if;

  if v_checkout is null then
    return jsonb_build_object('success',false,'error','missing_checkout_request_id');
  end if;

  select * into v_attempt
  from public.mpesa_payment_attempts
  where id=p_attempt_id
  for update;

  if not found then
    return jsonb_build_object('success',false,'error','attempt_not_found');
  end if;

  if v_attempt.checkout_request_id is not null then
    if v_attempt.checkout_request_id = v_checkout then
      return jsonb_build_object(
        'success',true,
        'idempotent',true,
        'state',v_attempt.state,
        'checkout_request_id',v_attempt.checkout_request_id,
        'merchant_request_id',v_attempt.merchant_request_id
      );
    end if;

    update public.mpesa_payment_attempts
       set state='reconciliation_required',
           processing_error='provider_checkout_conflict',
           updated_at=now()
     where id=v_attempt.id and state <> 'settled';
    return jsonb_build_object('success',false,'error','checkout_conflict','state','reconciliation_required');
  end if;

  if v_attempt.state <> 'submitting' then
    update public.mpesa_payment_attempts
       set state='reconciliation_required',
           processing_error=format('provider_attachment_invalid_state:%s',v_attempt.state),
           updated_at=now()
     where id=v_attempt.id and state <> 'settled';
    return jsonb_build_object('success',false,'error','invalid_attempt_state','state',v_attempt.state);
  end if;

  begin
    update public.mpesa_payment_attempts
       set state='awaiting_customer',
           checkout_request_id=v_checkout,
           merchant_request_id=v_merchant,
           provider_response=p_provider_response,
           processing_error=null,
           updated_at=now()
     where id=v_attempt.id;
  exception when unique_violation then
    update public.mpesa_payment_attempts
       set state='reconciliation_required',
           processing_error='duplicate_provider_checkout_request_id',
           provider_response=p_provider_response,
           updated_at=now()
     where id=v_attempt.id and state <> 'settled';
    return jsonb_build_object('success',false,'error','duplicate_checkout_request_id','state','reconciliation_required');
  end;

  return jsonb_build_object(
    'success',true,
    'state','awaiting_customer',
    'checkout_request_id',v_checkout,
    'merchant_request_id',v_merchant
  );
end;
$function$;

revoke all on function public.attach_mpesa_provider_request(uuid,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.attach_mpesa_provider_request(uuid,text,text,jsonb) to service_role;

commit;
