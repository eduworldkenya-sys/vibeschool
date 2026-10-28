-- Success Wishes SMS delivery address: never replace M-Pesa payer phone.
-- Delivery is explicitly gated by server configuration. An uncertain SMS is never retried automatically.
-- access: service-only public.success_wish_guest_sms_delivery
-- authorization-test: public.success_wish_guest_sms_delivery
create table public.success_wish_guest_sms_delivery (
  guest_order_id uuid primary key references public.success_wish_guest_orders(id),
  destination_phone text not null check (destination_phone ~ '^[+]254[17][0-9]{8}$'),
  status text not null default 'queued' check (status in ('queued','sending','accepted','needs_review')),
  provider_id text,
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.success_wish_guest_sms_delivery enable row level security;
revoke all on public.success_wish_guest_sms_delivery from public, anon, authenticated;
grant select, insert, update on public.success_wish_guest_sms_delivery to service_role;

-- An idempotent, single-use claim after a verified settlement and gift issuance.
-- The phone number must match the sender's immutable order snapshot.
create function public.success_wish_claim_guest_sms_delivery(p_id uuid, p_key_hash text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare o public.success_wish_guest_orders; v_claim uuid;
begin
 if coalesce(p_key_hash,'') !~ '^[a-f0-9]{64}$' then return null; end if;
 select * into o from public.success_wish_guest_orders
   where id=p_id and key_hash=p_key_hash for update;
 if o.id is null or o.receiver_id is not null or o.request_id is not null
   or o.state<>'settled' or o.provider_receipt is null
   or o.provider_verified_at is null or o.settled_at is null
   or o.refunded_at is not null or o.amount_kes<>50
   or coalesce(o.card->>'deliveryPhone','') !~ '^[+]254[17][0-9]{8}
   or not exists(select 1 from public.success_wish_guest_gifts g
     where g.guest_order_id=o.id and g.revoked_at is null and g.expires_at>now())
 then return null; end if;
 insert into public.success_wish_guest_sms_delivery(guest_order_id,destination_phone)
 values(o.id,o.card->>'deliveryPhone') on conflict(guest_order_id) do nothing;
 update public.success_wish_guest_sms_delivery
 set status='sending',updated_at=now()
 where guest_order_id=o.id and destination_phone=o.card->>'deliveryPhone'
   and status='queued'
 returning guest_order_id into v_claim;
 return v_claim;
end $$;
revoke all on function public.success_wish_claim_guest_sms_delivery(uuid,text)
 from public,anon,authenticated;
grant execute on function public.success_wish_claim_guest_sms_delivery(uuid,text) to service_role;

-- Printable six-character card codes for receiver-linked, verified gifts.
-- The inbox session/guardian verification remains mandatory before any message can be read.
create function public.success_wish_new_short_card_code() returns text
language plpgsql security invoker set search_path='' as $$
declare alphabet text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'; result text; b int; i int; tries int;
begin
 for tries in 1..64 loop
  result := '';
  for i in 1..6 loop
   loop
    b := get_byte(extensions.gen_random_bytes(1),0);
    exit when b<252;
   end loop;
   result := result || substr(alphabet,(b % 36)+1,1);
  end loop;
  if result ~ '[A-Z]' and result ~ '[0-9]' then return result; end if;
 end loop;
 raise exception 'Card code generation failed';
end $$;
revoke all on function public.success_wish_new_short_card_code() from public,anon,authenticated;
grant execute on function public.success_wish_new_short_card_code() to service_role;

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
  v_code := public.success_wish_new_short_card_code();
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

   or not exists(select 1 from public.success_wish_guest_gifts g
     where g.guest_order_id=o.id and g.revoked_at is null and g.expires_at>now())
 then return null; end if;
 insert into public.success_wish_guest_sms_delivery(guest_order_id,destination_phone)
 values(o.id,o.card->>'deliveryPhone') on conflict(guest_order_id) do nothing;
 update public.success_wish_guest_sms_delivery
 set status='sending',updated_at=now()
 where guest_order_id=o.id and destination_phone=o.card->>'deliveryPhone'
   and status='queued'
 returning guest_order_id into v_claim;
 return v_claim;
end $$;
revoke all on function public.success_wish_claim_guest_sms_delivery(uuid,text)
 from public,anon,authenticated;
grant execute on function public.success_wish_claim_guest_sms_delivery(uuid,text) to service_role;

-- Printable six-character card codes for receiver-linked, verified gifts.
-- The inbox session/guardian verification remains mandatory before any message can be read.
create function public.success_wish_new_short_card_code() returns text
language plpgsql security invoker set search_path='' as $$
declare alphabet text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'; result text; b int; i int; tries int;
begin
 for tries in 1..64 loop
  result := '';
  for i in 1..6 loop
   loop
    b := get_byte(extensions.gen_random_bytes(1),0);
    exit when b<252;
   end loop;
   result := result || substr(alphabet,(b % 36)+1,1);
  end loop;
  if result ~ '[A-Z]' and result ~ '[0-9]' then return result; end if;
 end loop;
 raise exception 'Card code generation failed';
end $$;
revoke all on function public.success_wish_new_short_card_code() from public,anon,authenticated;
grant execute on function public.success_wish_new_short_card_code() to service_role;

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
  v_code := public.success_wish_new_short_card_code();
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
