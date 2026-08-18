begin;

-- VibeSchool commercial architecture v1
-- Distribution objects remain in learning_resources. A Learning Product is the
-- economic wrapper that can bundle any number of those resources and map them
-- to curriculum outcomes, offers, orders and durable entitlements.
--
-- Migration-contract declarations. The executable authorization coverage is
-- certified by scripts/sql/learning_product_commerce_verify.sql.
-- authorization-test: public.learning_products
-- authorization-test: public.learning_product_items
-- authorization-test: public.learning_product_curriculum_links
-- authorization-test: public.learning_product_offers
-- authorization-test: public.learning_product_orders
-- authorization-test: public.learning_product_entitlements
-- authorization-test: public.learning_product_order_events
-- authorization-test: public.commerce_payment_attempts
-- authorization-test: public.commerce_payment_callback_events
-- access: service-only public.learning_product_order_events
-- access: service-only public.commerce_payment_callback_events

create table if not exists public.learning_products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  product_type text not null,
  title text not null,
  description text,
  status text not null default 'draft',
  owner_type text not null default 'platform',
  owner_profile_id uuid references public.profiles(id) on delete set null,
  rights_status text not null default 'unreviewed',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_products_sku_nonempty check (btrim(sku) <> ''),
  constraint learning_products_title_nonempty check (btrim(title) <> ''),
  constraint learning_products_type_check check (product_type in (
    'ebook','revision_pack','exam','mock_exam','question_bank','workbook',
    'interactive_activity','simulation','study_guide','lesson_companion',
    'teacher_guide','holiday_programme','pathway_bundle','video_course',
    'practical_lab','assessment','bundle','other'
  )),
  constraint learning_products_status_check check (status in ('draft','active','retired')),
  constraint learning_products_owner_type_check check (owner_type in ('platform','creator','publisher','school')),
  constraint learning_products_rights_status_check check (rights_status in ('unreviewed','cleared','restricted','expired'))
);

create table if not exists public.learning_product_items (
  product_id uuid not null references public.learning_products(id) on delete cascade,
  learning_resource_id uuid not null references public.learning_resources(id) on delete restrict,
  item_role text not null default 'included',
  sequence integer not null default 1 check (sequence > 0),
  previewable boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (product_id, learning_resource_id),
  constraint learning_product_items_role_check check (item_role in ('primary','included','bonus'))
);

create table if not exists public.learning_product_curriculum_links (
  product_id uuid not null references public.learning_products(id) on delete cascade,
  outcome_id uuid not null references public.curriculum_learning_outcomes(id) on delete restrict,
  relationship text not null default 'supports',
  coverage_weight numeric(5,4) not null default 1.0 check (coverage_weight > 0 and coverage_weight <= 1),
  created_at timestamptz not null default now(),
  primary key (product_id, outcome_id, relationship),
  constraint learning_product_curriculum_relationship_check check (relationship in (
    'teaches','supports','practises','assesses','remediates','prerequisite'
  ))
);

create table if not exists public.learning_product_offers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.learning_products(id) on delete cascade,
  offer_key text not null unique,
  pricing_model text not null,
  amount_kes integer,
  access_days integer,
  status text not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  preview_policy jsonb not null default '{}'::jsonb,
  terms_version text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_product_offers_key_nonempty check (btrim(offer_key) <> ''),
  constraint learning_product_offers_pricing_model_check check (pricing_model in ('free','one_time','subscription','school_license','donation')),
  constraint learning_product_offers_amount_check check (
    (pricing_model = 'free' and coalesce(amount_kes,0) = 0)
    or (pricing_model in ('one_time','subscription','school_license') and amount_kes is not null and amount_kes > 0)
    or (pricing_model = 'donation' and (amount_kes is null or amount_kes >= 0))
  ),
  constraint learning_product_offers_access_days_check check (access_days is null or access_days > 0),
  constraint learning_product_offers_status_check check (status in ('draft','active','retired')),
  constraint learning_product_offers_window_check check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.learning_product_orders (
  id uuid primary key default gen_random_uuid(),
  purchaser_profile_id uuid not null references public.profiles(id) on delete restrict,
  beneficiary_profile_id uuid references public.profiles(id) on delete restrict,
  beneficiary_student_id uuid references public.students(id) on delete restrict,
  beneficiary_school_id uuid references public.schools(id) on delete restrict,
  product_id uuid not null references public.learning_products(id) on delete restrict,
  offer_id uuid not null references public.learning_product_offers(id) on delete restrict,
  currency text not null default 'KES',
  amount_kes integer not null check (amount_kes >= 0),
  status text not null default 'pending_payment',
  idempotency_key text not null,
  payment_provider text,
  provider_checkout_id text,
  provider_receipt text,
  product_snapshot jsonb not null,
  offer_snapshot jsonb not null,
  access_days_snapshot integer,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  fulfilled_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (purchaser_profile_id, idempotency_key),
  constraint learning_product_orders_status_check check (status in (
    'pending_payment','paid','fulfilled','cancelled','refunded','reconciliation_required'
  )),
  constraint learning_product_orders_currency_check check (currency = 'KES'),
  constraint learning_product_orders_target_check check (
    num_nonnulls(beneficiary_profile_id, beneficiary_student_id, beneficiary_school_id) = 1
  )
);

create unique index if not exists learning_product_orders_provider_receipt_uidx
  on public.learning_product_orders(payment_provider, provider_receipt)
  where provider_receipt is not null;
create index if not exists learning_product_orders_purchaser_created_idx
  on public.learning_product_orders(purchaser_profile_id, created_at desc);
create index if not exists learning_product_orders_status_created_idx
  on public.learning_product_orders(status, created_at);

create table if not exists public.learning_product_entitlements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.learning_products(id) on delete restrict,
  order_id uuid references public.learning_product_orders(id) on delete restrict,
  profile_id uuid references public.profiles(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  school_id uuid references public.schools(id) on delete cascade,
  source text not null,
  status text not null default 'active',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_product_entitlements_target_check check (
    num_nonnulls(profile_id, student_id, school_id) = 1
  ),
  constraint learning_product_entitlements_source_check check (source in ('purchase','subscription','school_license','grant','promotion')),
  constraint learning_product_entitlements_status_check check (status in ('active','revoked','expired')),
  constraint learning_product_entitlements_window_check check (ends_at is null or ends_at > starts_at)
);

create unique index if not exists learning_product_entitlements_order_uidx
  on public.learning_product_entitlements(order_id)
  where order_id is not null;
create index if not exists learning_product_entitlements_profile_idx
  on public.learning_product_entitlements(profile_id, product_id)
  where profile_id is not null;
create index if not exists learning_product_entitlements_student_idx
  on public.learning_product_entitlements(student_id, product_id)
  where student_id is not null;
create index if not exists learning_product_entitlements_school_idx
  on public.learning_product_entitlements(school_id, product_id)
  where school_id is not null;

create table if not exists public.learning_product_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.learning_product_orders(id) on delete cascade,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint learning_product_order_events_type_check check (event_type in (
    'order_created','payment_started','payment_accepted','payment_failed',
    'payment_reconciliation_required','payment_settled','entitlement_granted',
    'order_cancelled','order_refunded'
  ))
);
create index if not exists learning_product_order_events_order_idx
  on public.learning_product_order_events(order_id, created_at);

-- Provider-neutral payment ledger. Existing teacher-credit M-Pesa remains intact;
-- this is the durable payment boundary for Learning Product commerce.
create table if not exists public.commerce_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.learning_product_orders(id) on delete restrict,
  payer_profile_id uuid not null references public.profiles(id) on delete restrict,
  provider text not null default 'mpesa',
  expected_amount_kes integer not null check (expected_amount_kes > 0),
  phone text not null,
  idempotency_key text not null,
  state text not null default 'created',
  merchant_request_id text,
  checkout_request_id text,
  provider_receipt text,
  provider_result_code integer,
  provider_result_desc text,
  provider_response jsonb,
  processing_error text,
  requested_at timestamptz,
  callback_received_at timestamptz,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payer_profile_id, idempotency_key),
  unique (checkout_request_id),
  unique (provider_receipt),
  constraint commerce_payment_attempts_provider_check check (provider in ('mpesa')),
  constraint commerce_payment_attempts_state_check check (state in (
    'created','submitting','awaiting_customer','settled','failed','cancelled','expired','reconciliation_required'
  ))
);
create unique index if not exists commerce_payment_attempts_single_open_order_uidx
  on public.commerce_payment_attempts(order_id)
  where state in ('created','submitting','awaiting_customer','reconciliation_required');
create index if not exists commerce_payment_attempts_payer_created_idx
  on public.commerce_payment_attempts(payer_profile_id, created_at desc);
create index if not exists commerce_payment_attempts_state_updated_idx
  on public.commerce_payment_attempts(state, updated_at)
  where state in ('created','submitting','awaiting_customer','reconciliation_required');

create table if not exists public.commerce_payment_callback_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'mpesa',
  event_key text not null unique,
  checkout_request_id text not null,
  merchant_request_id text,
  result_code integer,
  result_desc text,
  provider_receipt text,
  paid_amount_kes numeric(12,2),
  raw_payload jsonb not null,
  processing_status text not null default 'pending',
  processing_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint commerce_payment_callback_provider_check check (provider in ('mpesa')),
  constraint commerce_payment_callback_status_check check (processing_status in ('pending','processed','reconciliation_required'))
);
create index if not exists commerce_payment_callback_checkout_idx
  on public.commerce_payment_callback_events(checkout_request_id, received_at desc);
create index if not exists commerce_payment_callback_pending_idx
  on public.commerce_payment_callback_events(received_at)
  where processing_status = 'pending';

-- RLS / explicit Data API grants (Supabase 2026 safe-by-default contract).
alter table public.learning_products enable row level security;
alter table public.learning_product_items enable row level security;
alter table public.learning_product_curriculum_links enable row level security;
alter table public.learning_product_offers enable row level security;
alter table public.learning_product_orders enable row level security;
alter table public.learning_product_entitlements enable row level security;
alter table public.learning_product_order_events enable row level security;
alter table public.commerce_payment_attempts enable row level security;
alter table public.commerce_payment_callback_events enable row level security;

revoke all on table public.learning_products from public, anon, authenticated;
revoke all on table public.learning_product_items from public, anon, authenticated;
revoke all on table public.learning_product_curriculum_links from public, anon, authenticated;
revoke all on table public.learning_product_offers from public, anon, authenticated;
revoke all on table public.learning_product_orders from public, anon, authenticated;
revoke all on table public.learning_product_entitlements from public, anon, authenticated;
revoke all on table public.learning_product_order_events from public, anon, authenticated;
revoke all on table public.commerce_payment_attempts from public, anon, authenticated;
revoke all on table public.commerce_payment_callback_events from public, anon, authenticated;

grant select on table public.learning_products to anon, authenticated;
grant select on table public.learning_product_items to anon, authenticated;
grant select on table public.learning_product_curriculum_links to anon, authenticated;
grant select on table public.learning_product_offers to anon, authenticated;
grant select on table public.learning_product_orders to authenticated;
grant select on table public.learning_product_entitlements to authenticated;
grant select on table public.commerce_payment_attempts to authenticated;

grant all on table public.learning_products to service_role;
grant all on table public.learning_product_items to service_role;
grant all on table public.learning_product_curriculum_links to service_role;
grant all on table public.learning_product_offers to service_role;
grant all on table public.learning_product_orders to service_role;
grant all on table public.learning_product_entitlements to service_role;
grant all on table public.learning_product_order_events to service_role;
grant all on table public.commerce_payment_attempts to service_role;
grant all on table public.commerce_payment_callback_events to service_role;

drop policy if exists learning_products_public_read_active on public.learning_products;
create policy learning_products_public_read_active
  on public.learning_products for select to anon, authenticated
  using (status = 'active');

drop policy if exists learning_product_items_public_read_active on public.learning_product_items;
create policy learning_product_items_public_read_active
  on public.learning_product_items for select to anon, authenticated
  using (exists (
    select 1 from public.learning_products p
    where p.id = learning_product_items.product_id and p.status = 'active'
  ));

drop policy if exists learning_product_curriculum_public_read_active on public.learning_product_curriculum_links;
create policy learning_product_curriculum_public_read_active
  on public.learning_product_curriculum_links for select to anon, authenticated
  using (exists (
    select 1 from public.learning_products p
    where p.id = learning_product_curriculum_links.product_id and p.status = 'active'
  ));

drop policy if exists learning_product_offers_public_read_active on public.learning_product_offers;
create policy learning_product_offers_public_read_active
  on public.learning_product_offers for select to anon, authenticated
  using (
    status = 'active'
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
    and exists (
      select 1 from public.learning_products p
      where p.id = learning_product_offers.product_id and p.status = 'active'
    )
  );

drop policy if exists learning_product_orders_self_read on public.learning_product_orders;
create policy learning_product_orders_self_read
  on public.learning_product_orders for select to authenticated
  using (
    purchaser_profile_id = auth.uid()
    or beneficiary_profile_id = auth.uid()
    or exists (
      select 1 from public.students s
      where s.id = learning_product_orders.beneficiary_student_id
        and s.profile_id = auth.uid()
        and s.deleted_at is null
    )
  );

drop policy if exists learning_product_entitlements_self_read on public.learning_product_entitlements;
create policy learning_product_entitlements_self_read
  on public.learning_product_entitlements for select to authenticated
  using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.students s
      where s.id = learning_product_entitlements.student_id
        and s.profile_id = auth.uid()
        and s.deleted_at is null
    )
  );

drop policy if exists commerce_payment_attempts_self_read on public.commerce_payment_attempts;
create policy commerce_payment_attempts_self_read
  on public.commerce_payment_attempts for select to authenticated
  using (payer_profile_id = auth.uid());

-- No client policies are intentionally created for order events or raw callback
-- evidence. Those are service-only audit records.

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
  where id = v_offer.product_id and status = 'active';
  if not found then raise exception 'product_unavailable'; end if;

  if v_offer.pricing_model <> 'one_time' or v_offer.amount_kes is null or v_offer.amount_kes <= 0 then
    raise exception 'offer_not_supported_by_purchase_flow';
  end if;

  if p_beneficiary_student_id is not null then
    select exists (
      select 1 from public.students s
      where s.id = p_beneficiary_student_id
        and s.deleted_at is null
        and (
          s.profile_id = v_caller
          or exists (
            select 1 from public.parent_student_links psl
            where psl.parent_id = v_caller
              and psl.student_id = s.id
          )
        )
    ) into v_is_student_authorized;
    if not v_is_student_authorized then raise exception 'beneficiary_not_authorized'; end if;
  end if;

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

  insert into public.learning_product_order_events(order_id, event_type, details)
  values (v_order.id, 'order_created', jsonb_build_object('amount_kes', v_order.amount_kes, 'product_id', v_order.product_id));

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

create or replace function public.commerce_fulfill_learning_product_order(
  p_order_id uuid,
  p_provider text,
  p_provider_receipt text,
  p_paid_amount_kes numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order public.learning_product_orders%rowtype;
  v_ends_at timestamptz;
  v_entitlement_id uuid;
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'service_role_required';
  end if;
  if p_provider <> 'mpesa'
     or nullif(btrim(coalesce(p_provider_receipt,'')),'') is null
     or p_paid_amount_kes is null or p_paid_amount_kes <= 0 then
    return jsonb_build_object('success',false,'error','invalid_fulfillment_input');
  end if;

  select * into v_order
  from public.learning_product_orders
  where id = p_order_id
  for update;
  if not found then return jsonb_build_object('success',false,'error','order_not_found'); end if;

  if v_order.status = 'fulfilled' then
    if v_order.payment_provider = p_provider
       and v_order.provider_receipt = btrim(p_provider_receipt) then
      return jsonb_build_object('success',true,'idempotent',true,'order_id',v_order.id);
    end if;
    update public.learning_product_orders
      set status='reconciliation_required', updated_at=now()
      where id=v_order.id;
    insert into public.learning_product_order_events(order_id,event_type,details)
      values(v_order.id,'payment_reconciliation_required',jsonb_build_object('reason','fulfilled_receipt_conflict'));
    return jsonb_build_object('success',false,'error','receipt_conflict');
  end if;

  if p_paid_amount_kes <> v_order.amount_kes then
    update public.learning_product_orders
      set status='reconciliation_required', updated_at=now()
      where id=v_order.id;
    insert into public.learning_product_order_events(order_id,event_type,details)
      values(v_order.id,'payment_reconciliation_required',jsonb_build_object(
        'reason','amount_mismatch','expected',v_order.amount_kes,'received',p_paid_amount_kes
      ));
    return jsonb_build_object('success',false,'error','amount_mismatch');
  end if;

  if exists (
    select 1 from public.learning_product_orders o
    where o.payment_provider=p_provider
      and o.provider_receipt=btrim(p_provider_receipt)
      and o.id<>v_order.id
  ) then
    update public.learning_product_orders
      set status='reconciliation_required', updated_at=now()
      where id=v_order.id;
    insert into public.learning_product_order_events(order_id,event_type,details)
      values(v_order.id,'payment_reconciliation_required',jsonb_build_object('reason','duplicate_provider_receipt'));
    return jsonb_build_object('success',false,'error','duplicate_receipt');
  end if;

  v_ends_at := case
    when v_order.access_days_snapshot is null then null
    else now() + make_interval(days => v_order.access_days_snapshot)
  end;

  select id into v_entitlement_id
  from public.learning_product_entitlements
  where order_id = v_order.id;

  if v_entitlement_id is null then
    insert into public.learning_product_entitlements(
      product_id,order_id,profile_id,student_id,school_id,source,status,starts_at,ends_at,metadata
    ) values (
      v_order.product_id,
      v_order.id,
      v_order.beneficiary_profile_id,
      v_order.beneficiary_student_id,
      v_order.beneficiary_school_id,
      'purchase',
      'active',
      now(),
      v_ends_at,
      jsonb_build_object('payment_provider',p_provider,'provider_receipt',btrim(p_provider_receipt))
    ) returning id into v_entitlement_id;
  end if;

  update public.learning_product_orders
  set status='fulfilled',
      payment_provider=p_provider,
      provider_receipt=btrim(p_provider_receipt),
      paid_at=coalesce(paid_at,now()),
      fulfilled_at=coalesce(fulfilled_at,now()),
      updated_at=now()
  where id=v_order.id;

  insert into public.learning_product_order_events(order_id,event_type,details)
    values(v_order.id,'payment_settled',jsonb_build_object('provider',p_provider,'receipt',btrim(p_provider_receipt),'amount_kes',p_paid_amount_kes));
  insert into public.learning_product_order_events(order_id,event_type,details)
    values(v_order.id,'entitlement_granted',jsonb_build_object('entitlement_id',v_entitlement_id,'product_id',v_order.product_id));

  return jsonb_build_object(
    'success',true,
    'order_id',v_order.id,
    'entitlement_id',v_entitlement_id,
    'product_id',v_order.product_id,
    'receipt',btrim(p_provider_receipt)
  );
end;
$function$;

revoke all on function public.commerce_fulfill_learning_product_order(uuid,text,text,numeric) from public, anon, authenticated;
grant execute on function public.commerce_fulfill_learning_product_order(uuid,text,text,numeric) to service_role;

create or replace function public.commerce_current_user_has_product_entitlement(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select case when auth.uid() is null then false else exists (
    select 1
    from public.learning_product_entitlements e
    where e.product_id = p_product_id
      and e.status = 'active'
      and e.starts_at <= now()
      and (e.ends_at is null or e.ends_at > now())
      and e.revoked_at is null
      and (
        e.profile_id = auth.uid()
        or exists (
          select 1 from public.students s
          where s.id = e.student_id
            and s.profile_id = auth.uid()
            and s.deleted_at is null
        )
      )
  ) end;
$function$;

revoke all on function public.commerce_current_user_has_product_entitlement(uuid) from public;
grant execute on function public.commerce_current_user_has_product_entitlement(uuid) to anon, authenticated, service_role;

-- Upgrade the canonical reader entitlement authority. Paid/freemium locked
-- chapters become readable only when a durable Learning Product entitlement
-- covers the publication resource.
create or replace function public.can_viewer_read_chapter(p_chapter_id uuid, p_viewer_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_chapter public.vibe_chapters%rowtype;
  v_publication public.vibe_publications%rowtype;
  v_viewer_is_author boolean := false;
  v_pricing_type text;
  v_free_chapter_count integer := 0;
begin
  select * into v_chapter from public.vibe_chapters where id=p_chapter_id;
  if not found then return false; end if;
  select * into v_publication from public.vibe_publications where id=v_chapter.publication_id;
  if not found or v_publication.format <> 'vibetextbook' then return false; end if;

  v_viewer_is_author := p_viewer_id is not null and p_viewer_id=v_publication.author_id;
  if v_publication.status <> 'published' and not v_viewer_is_author then return false; end if;
  if v_viewer_is_author then return true; end if;
  if v_chapter.status not in ('published','locked') then return false; end if;

  v_pricing_type := coalesce(v_publication.pricing->>'type','free');
  v_free_chapter_count := case
    when jsonb_typeof(v_publication.pricing->'freeChapters')='number'
      then greatest(0,(v_publication.pricing->>'freeChapters')::integer)
    else 0
  end;

  if v_pricing_type in ('free','donation') then return true; end if;
  if v_pricing_type='freemium' and v_chapter.number <= v_free_chapter_count then return true; end if;
  if p_viewer_id is null then return false; end if;

  return exists (
    select 1
    from public.learning_resources lr
    join public.learning_product_items lpi on lpi.learning_resource_id=lr.id
    join public.learning_products lp on lp.id=lpi.product_id and lp.status='active'
    join public.learning_product_entitlements e on e.product_id=lp.id
    where lr.source_type='publication'
      and lr.publication_id=v_publication.id
      and e.status='active'
      and e.starts_at <= now()
      and (e.ends_at is null or e.ends_at > now())
      and e.revoked_at is null
      and (
        e.profile_id=p_viewer_id
        or exists (
          select 1 from public.students s
          where s.id=e.student_id
            and s.profile_id=p_viewer_id
            and s.deleted_at is null
        )
      )
  );
end;
$function$;

revoke all on function public.can_viewer_read_chapter(uuid,uuid) from public, anon, authenticated;
grant execute on function public.can_viewer_read_chapter(uuid,uuid) to service_role;

create or replace function public.can_current_viewer_read_chapter(p_chapter_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select public.can_viewer_read_chapter(p_chapter_id, auth.uid());
$function$;

revoke all on function public.can_current_viewer_read_chapter(uuid) from public;
grant execute on function public.can_current_viewer_read_chapter(uuid) to anon, authenticated, service_role;

-- Close the direct Data API bypass. The previous public policies exposed raw
-- chapter.blocks/content_blocks whenever the publication was published, even
-- when pricing said paid/freemium/school_license.
drop policy if exists "vibe_chapters_public_read_published" on public.vibe_chapters;
drop policy if exists "vibe_chapters_public_read_published_or_locked" on public.vibe_chapters;
create policy vibe_chapters_entitled_reader_select
  on public.vibe_chapters for select to anon, authenticated
  using (public.can_current_viewer_read_chapter(id));

drop policy if exists content_blocks_public_read on public.content_blocks;
create policy content_blocks_entitled_reader_select
  on public.content_blocks for select to anon, authenticated
  using (
    status='published'
    and chapter_id is not null
    and public.can_current_viewer_read_chapter(chapter_id)
  );

-- Public preview remains intentionally capable of listing locked chapter
-- metadata, but it never serializes locked blocks. SECURITY DEFINER is safe here
-- because every returned field is explicitly allowlisted and content release is
-- governed by pricing rules, not caller-controlled identifiers.
create or replace function public.get_public_vibetextbook_reader(publication_id_input uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  publication_payload jsonb;
  publication_pricing jsonb;
  chapter_payload jsonb;
  pricing_type text;
  free_chapter_count integer := 0;
begin
  select jsonb_build_object(
      'id',p.id,'format',p.format,'title',p.title,'subtitle',p.subtitle,
      'cover_url',p.cover_url,'description',p.description,'genre',p.genre,
      'tags',p.tags,'language',p.language,'status',p.status,'pricing',p.pricing,
      'chapter_count',p.chapter_count,'total_reads',p.total_reads,'total_vibes',p.total_vibes,
      'cbc_subject',p.cbc_subject,'cbc_grade',p.cbc_grade,'cbc_aligned',p.cbc_aligned,
      'curriculum_framework',p.curriculum_framework,'series_name',p.series_name,
      'series_number',p.series_number,'publication_name',p.publication_name,
      'issue_number',p.issue_number,'created_at',p.created_at,'updated_at',p.updated_at,
      'published_at',p.published_at
    ), p.pricing
  into publication_payload, publication_pricing
  from public.vibe_publications p
  where p.id=publication_id_input and p.format='vibetextbook' and p.status='published';

  if publication_payload is null then
    return jsonb_build_object('ok',false,'reason','not_found');
  end if;

  pricing_type := coalesce(publication_pricing->>'type','free');
  free_chapter_count := case
    when jsonb_typeof(publication_pricing->'freeChapters')='number'
      then greatest(0,(publication_pricing->>'freeChapters')::integer)
    else 0
  end;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',c.id,'publication_id',c.publication_id,'title',c.title,'number',c.number,
      'status',c.status,'word_count',c.word_count,'reading_time_min',c.reading_time_min,
      'published_at',c.published_at,'created_at',c.created_at,'updated_at',c.updated_at,
      'cbc_strand',c.cbc_strand,
      'can_read', case
        when pricing_type in ('free','donation') then true
        when pricing_type='freemium' and c.number <= free_chapter_count then true
        else false end,
      'is_bookmarked',false,'progress_percent',0,'completed_at',null,'last_read_at',null,
      'curriculum',jsonb_build_object(
        'framework',publication_payload->>'curriculum_framework',
        'grade',publication_payload->>'cbc_grade','subject',publication_payload->>'cbc_subject',
        'strand',c.cbc_strand,'sub_strand',null,'topic',null,'term',null,'week',null,
        'learning_outcomes',coalesce(c.learning_outcomes,'{}'),'key_inquiry_questions','{}',
        'suggested_experiences','{}','core_competencies','{}','core_values','{}','source_ref',null,
        'alignment_status',c.alignment_status,
        'authority',case c.alignment_status when 'verified' then 'official' when 'creator_claimed' then 'publisher' when 'pending_review' then 'publisher' else null end,
        'verified_by',null,'verified_at',c.verified_at,
        'has_curriculum_detail',(c.cbc_strand is not null or coalesce(array_length(c.learning_outcomes,1),0)>0)
      ),
      'blocks',case
        when pricing_type in ('free','donation') or (pricing_type='freemium' and c.number <= free_chapter_count)
          then case when jsonb_typeof(c.blocks)='array' then c.blocks else '[]'::jsonb end
        else null end
    ) order by c.number
  ),'[]'::jsonb)
  into chapter_payload
  from public.vibe_chapters c
  where c.publication_id=publication_id_input and c.status in ('published','locked');

  return jsonb_build_object(
    'ok',true,'reason',null,'viewer_is_author',false,
    'author_name','Vibeschool Publisher','publication',publication_payload,
    'chapters',chapter_payload,'resume',null
  );
end;
$function$;

revoke all on function public.get_public_vibetextbook_reader(uuid) from public;
grant execute on function public.get_public_vibetextbook_reader(uuid) to anon, authenticated, service_role;

create or replace function public.claim_commerce_payment_attempt(p_attempt_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if current_user not in ('postgres','service_role') then raise exception 'service_role_required'; end if;
  update public.commerce_payment_attempts
  set state='submitting', requested_at=coalesce(requested_at,now()), updated_at=now()
  where id=p_attempt_id and state='created';
  return found;
end;
$function$;
revoke all on function public.claim_commerce_payment_attempt(uuid) from public, anon, authenticated;
grant execute on function public.claim_commerce_payment_attempt(uuid) to service_role;

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
  return jsonb_build_object('success',true,'state','awaiting_customer');
exception when unique_violation then
  update public.commerce_payment_attempts
  set state='reconciliation_required',processing_error='duplicate_checkout_request_id',updated_at=now()
  where id=p_attempt_id;
  return jsonb_build_object('success',false,'error','duplicate_checkout_request_id','state','reconciliation_required');
end;
$function$;
revoke all on function public.attach_commerce_mpesa_request(uuid,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.attach_commerce_mpesa_request(uuid,text,text,jsonb) to service_role;

create or replace function public.process_commerce_payment_callback_event(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event public.commerce_payment_callback_events%rowtype;
  v_attempt public.commerce_payment_attempts%rowtype;
  v_result jsonb;
  v_terminal_state text;
begin
  if current_user not in ('postgres','service_role') then raise exception 'service_role_required'; end if;

  select * into v_event from public.commerce_payment_callback_events where id=p_event_id for update;
  if not found then return jsonb_build_object('success',false,'error','event_not_found'); end if;
  if v_event.processing_status='processed' then return jsonb_build_object('success',true,'idempotent',true); end if;

  select * into v_attempt
  from public.commerce_payment_attempts
  where checkout_request_id=v_event.checkout_request_id
  for update;
  if not found then
    update public.commerce_payment_callback_events set processing_error='attempt_not_found' where id=v_event.id;
    return jsonb_build_object('success',false,'error','attempt_not_found');
  end if;

  if coalesce(v_event.result_code,-1) <> 0 then
    v_terminal_state := case
      when v_event.result_code=1032 then 'cancelled'
      when v_event.result_code in (1037,1) then 'expired'
      else 'failed' end;
    if v_attempt.state <> 'settled' then
      update public.commerce_payment_attempts
      set state=v_terminal_state,provider_result_code=v_event.result_code,
          provider_result_desc=v_event.result_desc,callback_received_at=now(),
          processing_error=null,updated_at=now()
      where id=v_attempt.id;
      insert into public.learning_product_order_events(order_id,event_type,details)
      values(v_attempt.order_id,'payment_failed',jsonb_build_object('state',v_terminal_state,'result_code',v_event.result_code));
    end if;
    update public.commerce_payment_callback_events
      set processing_status='processed',processing_error=null,processed_at=now()
      where id=v_event.id;
    return jsonb_build_object('success',true,'state',case when v_attempt.state='settled' then 'settled' else v_terminal_state end);
  end if;

  if nullif(btrim(coalesce(v_event.provider_receipt,'')),'') is null
     or v_event.paid_amount_kes is null or v_event.paid_amount_kes <= 0 then
    update public.commerce_payment_attempts
      set state='reconciliation_required',provider_result_code=v_event.result_code,
          provider_result_desc=v_event.result_desc,callback_received_at=now(),
          processing_error='successful_callback_missing_receipt_or_amount',updated_at=now()
      where id=v_attempt.id and state<>'settled';
    update public.learning_product_orders set status='reconciliation_required',updated_at=now()
      where id=v_attempt.order_id and status<>'fulfilled';
    update public.commerce_payment_callback_events
      set processing_status='reconciliation_required',processing_error='missing_receipt_or_amount',processed_at=now()
      where id=v_event.id;
    return jsonb_build_object('success',false,'error','missing_receipt_or_amount');
  end if;

  v_result := public.commerce_fulfill_learning_product_order(
    v_attempt.order_id,'mpesa',v_event.provider_receipt,v_event.paid_amount_kes
  );

  if coalesce((v_result->>'success')::boolean,false) then
    update public.commerce_payment_attempts
    set state='settled',provider_receipt=btrim(v_event.provider_receipt),
        provider_result_code=v_event.result_code,provider_result_desc=v_event.result_desc,
        callback_received_at=now(),settled_at=now(),processing_error=null,updated_at=now()
    where id=v_attempt.id;
    update public.commerce_payment_callback_events
      set processing_status='processed',processing_error=null,processed_at=now()
      where id=v_event.id;
  else
    update public.commerce_payment_attempts
      set state='reconciliation_required',processing_error=v_result->>'error',updated_at=now()
      where id=v_attempt.id and state<>'settled';
    update public.commerce_payment_callback_events
      set processing_status='reconciliation_required',processing_error=v_result->>'error',processed_at=now()
      where id=v_event.id;
  end if;

  return v_result;
end;
$function$;
revoke all on function public.process_commerce_payment_callback_event(uuid) from public, anon, authenticated;
grant execute on function public.process_commerce_payment_callback_event(uuid) to service_role;

comment on table public.learning_products is 'Commercial Learning Product identity. Educational objects remain canonical in learning_resources.';
comment on table public.learning_product_entitlements is 'Durable access grants produced by purchase/subscription/licence/grant workflows.';
comment on table public.commerce_payment_attempts is 'Provider-neutral durable payment attempts for Learning Product orders; no external side effect should occur before this row exists.';
comment on function public.can_current_viewer_read_chapter(uuid) is 'Fail-closed chapter access helper used by RLS. Free previews pass; paid content requires a durable Learning Product entitlement.';

commit;