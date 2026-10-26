-- Issue a receiver gift in one transaction, after real payment and verified recipient consent.
-- This is a private service-only checkout integration point, NOT an activation of guest checkout.
-- A second call for the same payment is idempotent but cannot reveal one-time secrets.
create or replace function public.success_wish_issue_verified_paid_card(
  p_payment_attempt_id uuid,
  p_receiver_id uuid,
  p_theme text,
  p_sender_name text,
  p_message text,
  p_exam_year text,
  p_sender_reveal_early boolean default false
) returns table (
  issued_card_id uuid,
  link_secret text,
  access_code text,
  newly_issued boolean
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
  then
    raise exception 'Invalid Success Wish details' using errcode = '22023';
  end if;

  select id into v_receiver from public.success_wish_receivers
    where id = p_receiver_id and consent_status = 'verified';
  if v_receiver is null then
    raise exception 'Recipient identity and appropriate consent must be verified before delivery'
      using errcode = '23514';
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
