begin;

-- Operational activation is a database-owned precondition for crossing the
-- external M-Pesa side-effect boundary. This prevents a function/code deploy,
-- commercial-policy change, or stale client from initiating an STK request
-- until an operator explicitly enables the M-Pesa runtime control.
create or replace function public.claim_mpesa_payment_attempt(p_attempt_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_claimed uuid;
  v_enabled boolean;
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'service_role_required';
  end if;

  select initiation_enabled into v_enabled
  from public.mpesa_runtime_control
  where singleton = true;

  if coalesce(v_enabled, false) is not true then
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

commit;
