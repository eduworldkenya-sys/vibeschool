begin;

-- Learning Product commerce shares the already-governed M-Pesa operational
-- kill switch. Deploying this schema or its Edge Functions must never initiate
-- an external STK side effect while mpesa_runtime_control is OFF.
create or replace function public.claim_commerce_payment_attempt(p_attempt_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_enabled boolean := false;
  v_claimed uuid;
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'service_role_required';
  end if;

  select initiation_enabled into v_enabled
  from public.mpesa_runtime_control
  where singleton = true;

  if coalesce(v_enabled,false) is not true then return false; end if;

  update public.commerce_payment_attempts
  set state='submitting',requested_at=coalesce(requested_at,now()),updated_at=now()
  where id=p_attempt_id and state='created'
  returning id into v_claimed;

  return v_claimed is not null;
end;
$function$;

revoke all on function public.claim_commerce_payment_attempt(uuid) from public, anon, authenticated;
grant execute on function public.claim_commerce_payment_attempt(uuid) to service_role;

comment on function public.claim_commerce_payment_attempt(uuid) is
'Crosses the Learning Product external-payment boundary only when the canonical M-Pesa runtime control is explicitly enabled.';

commit;
