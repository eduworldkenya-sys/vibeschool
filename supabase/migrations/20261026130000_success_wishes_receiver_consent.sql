-- Receiver consent must be confirmed before a paid card can be revealed or added to a private inbox.
-- Identity/guardian route is assigned by trusted recipient provisioning, NEVER by bearer-link input.
-- No public grants or automatic SMS activation are introduced.
alter table public.success_wish_receivers
  add column if not exists consent_route text check (consent_route in ('adult','guardian')),
  add column if not exists guardian_phone_e164 text check (guardian_phone_e164 is null or guardian_phone_e164 ~ '^[+]254[17][0-9]{8}$'),
  add column if not exists consent_verified_at timestamptz;

-- A challenge created for guardian approval must not be redeemable as a different purpose.
alter table public.success_wish_receiver_challenges
  add column if not exists purpose text not null default 'recovery'
    check (purpose in ('recovery','consent_adult','consent_guardian'));

drop function if exists public.success_wish_consume_receiver_challenge(uuid,uuid,text);
create function public.success_wish_consume_receiver_challenge(
  p_challenge uuid, p_receiver uuid, p_digest text, p_purpose text
) returns boolean
language plpgsql security invoker set search_path=public as $$
declare was_valid boolean;
begin
  if p_purpose not in ('recovery','consent_adult','consent_guardian') then return false; end if;
  update public.success_wish_receiver_challenges
  set attempts = attempts + 1,
      consumed_at = case when code_hash = p_digest then now() else null end
  where id = p_challenge and receiver_id = p_receiver and purpose = p_purpose
    and consumed_at is null and expires_at > now() and attempts < 5
  returning (consumed_at is not null) into was_valid;
  return coalesce(was_valid,false);
end;
$$;
revoke all on function public.success_wish_consume_receiver_challenge(uuid,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.success_wish_consume_receiver_challenge(uuid,uuid,text,text)
  to service_role;

-- Payment remains mandatory. The paid issuer may create a sealed envelope for pending
-- consent; server-side read and reveal gates must enforce consent before disclosing content.
-- Real guest checkout and production SMS are separate launch-gated workstreams.
create or replace function public.success_wish_issue_verified_paid_card(
  p_payment_attempt_id uuid,
  p_receiver_id uuid,
  p_theme text,
  p_sender_name text,
  p_message text,
  p_exam_year text,
  p_sender_reveal_early boolean default false
) returns table (
  issued_card_id uuid, link_secret text, access_code text, newly_issued boolean
)
language plpgsql security invoker set search_path = ''
as $$
declare v_card_id uuid;
declare v_receiver uuid;
declare v_link text;
declare v_code text;
begin
  if p_payment_attempt_id is null or p_receiver_id is null
    or p_theme not in ('heritage','botanical','nightfall','sunrise')
    or char_length(btrim(coalesce(p_sender_name,''))) not between 1 and 100
    or char_length(btrim(coalesce(p_message,''))) not between 1 and 1500
    or coalesce(p_exam_year,'') !~ '^20[0-9]{2}$'
  then raise exception 'Invalid Success Wish details' using errcode = '22023'; end if;

  select id into v_receiver from public.success_wish_receivers
    where id = p_receiver_id and consent_status in ('pending','verified');
  if v_receiver is null then
    raise exception 'Receiver must be provisioned and not revoked' using errcode = '23514';
  end if;

  insert into public.success_wish_cards(
    receiver_id,payment_attempt_id,theme,sender_name,message,exam_year,
    sender_reveal_early,expires_at
  ) values (
    p_receiver_id,p_payment_attempt_id,p_theme,btrim(p_sender_name),btrim(p_message),p_exam_year,
    coalesce(p_sender_reveal_early,false),now()+interval '90 days'
  ) on conflict(payment_attempt_id) do nothing
  returning id into v_card_id;

  if v_card_id is null then
    select id,receiver_id into v_card_id,v_receiver
      from public.success_wish_cards where payment_attempt_id = p_payment_attempt_id;
    if v_card_id is null or v_receiver <> p_receiver_id then
      raise exception 'Payment already belongs to another recipient' using errcode = '23514';
    end if;
    return query select v_card_id,null::text,null::text,false;
    return;
  end if;

  v_link := encode(extensions.gen_random_bytes(32),'hex');
  v_code := upper(encode(extensions.gen_random_bytes(16),'hex'));
  insert into public.success_wish_card_access(card_id,link_hash,code_hash,expires_at)
  values (
    v_card_id,
    encode(extensions.digest('success-wishes:paid-link:' || v_link,'sha256'),'hex'),
    encode(extensions.digest('success-wishes:paid-code:' || v_code,'sha256'),'hex'),
    now()+interval '90 days'
  );
  return query select v_card_id,v_link,v_code,true;
end;
$$;
revoke all on function public.success_wish_issue_verified_paid_card(uuid,uuid,text,text,text,text,boolean)
  from public,anon,authenticated;
grant execute on function public.success_wish_issue_verified_paid_card(uuid,uuid,text,text,text,text,boolean)
  to service_role;
