begin;

-- A payment attempt owns the lifecycle of its pending order. Terminal provider
-- failures must release that order so the buyer can intentionally retry with a
-- new idempotency key; uncertain provider state must block a second charge.
create or replace function public.commerce_sync_order_from_payment_attempt()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_changed boolean := false;
begin
  if new.state is not distinct from old.state then
    return new;
  end if;

  if new.state in ('failed','cancelled','expired') then
    update public.learning_product_orders
    set status = 'cancelled',
        cancelled_at = coalesce(cancelled_at, now()),
        updated_at = now()
    where id = new.order_id
      and status = 'pending_payment';
    v_changed := found;

    if v_changed then
      insert into public.learning_product_order_events(order_id,event_type,details)
      values (
        new.order_id,
        'order_cancelled',
        jsonb_build_object('payment_attempt_id',new.id,'payment_state',new.state,'provider',new.provider)
      );
    end if;
  elsif new.state = 'reconciliation_required' then
    update public.learning_product_orders
    set status = 'reconciliation_required',
        updated_at = now()
    where id = new.order_id
      and status = 'pending_payment';
  end if;

  return new;
end;
$function$;

revoke all on function public.commerce_sync_order_from_payment_attempt() from public, anon, authenticated;

drop trigger if exists commerce_sync_order_from_payment_attempt on public.commerce_payment_attempts;
create trigger commerce_sync_order_from_payment_attempt
after update of state on public.commerce_payment_attempts
for each row execute function public.commerce_sync_order_from_payment_attempt();

-- The order boundary serializes one beneficiary/product purchase decision at a
-- time. It refuses a second charge when valid access already exists, reuses an
-- outstanding pending order, and blocks retries while provider state is
-- uncertain.
create or replace function public.commerce_create_learning_product_order(
  p_offer_id uuid,
  p_idempotency_key text,
  p_beneficiary_student_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_caller uuid := auth.uid();
  v_offer public.learning_product_offers%rowtype;
  v_product public.learning_products%rowtype;
  v_existing public.learning_product_orders%rowtype;
  v_order public.learning_product_orders%rowtype;
  v_is_student_authorized boolean := false;
  v_target_key text;
  v_has_entitlement boolean := false;
begin
  if v_caller is null then
    raise exception 'authentication_required';
  end if;
  if p_idempotency_key is null
     or p_idempotency_key !~ '^[A-Za-z0-9_-]{16,80}$' then
    raise exception 'invalid_idempotency_key';
  end if;

  select * into v_offer
  from public.learning_product_offers
  where id = p_offer_id
    and status = 'active'
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now());
  if not found then raise exception 'offer_unavailable'; end if;

  select * into v_product
  from public.learning_products
  where id = v_offer.product_id
    and status = 'active'
    and rights_status = 'cleared';
  if not found then raise exception 'product_unavailable'; end if;

  if v_offer.pricing_model <> 'one_time'
     or v_offer.amount_kes is null
     or v_offer.amount_kes <= 0 then
    raise exception 'offer_not_supported_by_purchase_flow';
  end if;

  if p_beneficiary_student_id is not null then
    select exists (
      select 1
      from public.students s
      where s.id = p_beneficiary_student_id
        and s.deleted_at is null
        and (
          s.profile_id = v_caller
          or exists (
            select 1
            from public.parent_student_links psl
            where psl.parent_id = v_caller
              and psl.student_id = s.id
          )
        )
    ) into v_is_student_authorized;
    if not v_is_student_authorized then
      raise exception 'beneficiary_not_authorized';
    end if;
  end if;

  -- A repeated exact request always resolves to its original order first.
  select * into v_existing
  from public.learning_product_orders
  where purchaser_profile_id = v_caller
    and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'success', true,
      'idempotent', true,
      'order_id', v_existing.id,
      'status', v_existing.status,
      'amount_kes', v_existing.amount_kes,
      'product_id', v_existing.product_id
    );
  end if;

  v_target_key := v_product.id::text || ':' || coalesce(p_beneficiary_student_id::text, v_caller::text);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_target_key, 0));

  select exists (
    select 1
    from public.learning_product_entitlements e
    where e.product_id = v_product.id
      and e.status = 'active'
      and e.starts_at <= now()
      and (e.ends_at is null or e.ends_at > now())
      and e.revoked_at is null
      and (
        (p_beneficiary_student_id is null and e.profile_id = v_caller)
        or (p_beneficiary_student_id is not null and e.student_id = p_beneficiary_student_id)
      )
  ) into v_has_entitlement;

  if v_has_entitlement then
    return jsonb_build_object(
      'success', true,
      'already_entitled', true,
      'status', 'fulfilled',
      'product_id', v_product.id,
      'amount_kes', 0
    );
  end if;

  select * into v_existing
  from public.learning_product_orders o
  where o.purchaser_profile_id = v_caller
    and o.product_id = v_product.id
    and o.status = 'reconciliation_required'
    and (
      (p_beneficiary_student_id is null and o.beneficiary_profile_id = v_caller)
      or (p_beneficiary_student_id is not null and o.beneficiary_student_id = p_beneficiary_student_id)
    )
  order by o.created_at desc
  limit 1;
  if found then
    return jsonb_build_object(
      'success', false,
      'error', 'payment_reconciliation_required',
      'order_id', v_existing.id,
      'status', v_existing.status,
      'product_id', v_existing.product_id
    );
  end if;

  select * into v_existing
  from public.learning_product_orders o
  where o.purchaser_profile_id = v_caller
    and o.product_id = v_product.id
    and o.status = 'pending_payment'
    and (
      (p_beneficiary_student_id is null and o.beneficiary_profile_id = v_caller)
      or (p_beneficiary_student_id is not null and o.beneficiary_student_id = p_beneficiary_student_id)
    )
  order by o.created_at desc
  limit 1;
  if found then
    return jsonb_build_object(
      'success', true,
      'existing_order', true,
      'order_id', v_existing.id,
      'status', v_existing.status,
      'amount_kes', v_existing.amount_kes,
      'product_id', v_existing.product_id
    );
  end if;

  insert into public.learning_product_orders(
    purchaser_profile_id,
    beneficiary_profile_id,
    beneficiary_student_id,
    beneficiary_school_id,
    product_id,
    offer_id,
    amount_kes,
    status,
    idempotency_key,
    product_snapshot,
    offer_snapshot,
    access_days_snapshot
  ) values (
    v_caller,
    case when p_beneficiary_student_id is null then v_caller else null end,
    p_beneficiary_student_id,
    null,
    v_product.id,
    v_offer.id,
    v_offer.amount_kes,
    'pending_payment',
    p_idempotency_key,
    jsonb_build_object(
      'id', v_product.id,
      'sku', v_product.sku,
      'title', v_product.title,
      'product_type', v_product.product_type
    ),
    jsonb_build_object(
      'id', v_offer.id,
      'offer_key', v_offer.offer_key,
      'pricing_model', v_offer.pricing_model,
      'amount_kes', v_offer.amount_kes,
      'terms_version', v_offer.terms_version
    ),
    v_offer.access_days
  ) returning * into v_order;

  insert into public.learning_product_order_events(order_id,event_type,details)
  values (
    v_order.id,
    'order_created',
    jsonb_build_object('amount_kes',v_order.amount_kes,'product_id',v_order.product_id)
  );

  return jsonb_build_object(
    'success', true,
    'idempotent', false,
    'order_id', v_order.id,
    'status', v_order.status,
    'amount_kes', v_order.amount_kes,
    'product_id', v_order.product_id,
    'beneficiary_student_id', v_order.beneficiary_student_id
  );
end;
$function$;

revoke all on function public.commerce_create_learning_product_order(uuid,text,uuid) from public, anon;
grant execute on function public.commerce_create_learning_product_order(uuid,text,uuid) to authenticated;

comment on function public.commerce_create_learning_product_order(uuid,text,uuid) is
'Creates at most one outstanding buyer/product/beneficiary order decision at a time, prevents charging an already-entitled beneficiary, and blocks duplicate payment while reconciliation is unresolved.';

commit;
