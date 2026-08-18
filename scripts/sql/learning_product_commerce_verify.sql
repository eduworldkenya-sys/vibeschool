\set ON_ERROR_STOP on

begin;

-- Required commercial objects exist and are protected by RLS.
do $$
declare
  v_table text;
  v_rls boolean;
begin
  foreach v_table in array array[
    'learning_products',
    'learning_product_items',
    'learning_product_curriculum_links',
    'learning_product_offers',
    'learning_product_orders',
    'learning_product_entitlements',
    'learning_product_order_events',
    'commerce_payment_attempts',
    'commerce_payment_callback_events'
  ] loop
    select c.relrowsecurity into v_rls
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=v_table and c.relkind='r';
    if v_rls is distinct from true then
      raise exception 'commerce contract: % missing or RLS disabled', v_table;
    end if;
  end loop;
end $$;

-- Browser roles must never mutate commercial truth directly.
do $$
declare
  v_table text;
  v_role text;
  v_priv text;
begin
  foreach v_table in array array[
    'learning_products','learning_product_items','learning_product_curriculum_links',
    'learning_product_offers','learning_product_orders','learning_product_entitlements',
    'learning_product_order_events','commerce_payment_attempts','commerce_payment_callback_events'
  ] loop
    foreach v_role in array array['anon','authenticated'] loop
      foreach v_priv in array array['INSERT','UPDATE','DELETE','TRUNCATE'] loop
        if has_table_privilege(v_role, format('public.%I',v_table), v_priv) then
          raise exception 'commerce contract: % unexpectedly has % on %', v_role, v_priv, v_table;
        end if;
      end loop;
    end loop;
  end loop;
end $$;

-- Raw publishing inventory, payment callbacks and audit events are company-side
-- truth. Browser roles consume allowlisted storefront projections instead.
do $$
declare
  v_table text;
  v_role text;
begin
  foreach v_table in array array[
    'learning_products','learning_product_items','learning_product_curriculum_links',
    'learning_product_offers','learning_product_order_events','commerce_payment_callback_events'
  ] loop
    foreach v_role in array array['anon','authenticated'] loop
      if has_table_privilege(v_role, format('public.%I',v_table), 'SELECT') then
        raise exception 'commerce contract: % unexpectedly has raw SELECT on %', v_role, v_table;
      end if;
    end loop;
  end loop;

  if has_table_privilege('anon','public.learning_product_orders','SELECT') then
    raise exception 'commerce contract: anonymous order reads granted';
  end if;
  if not has_table_privilege('authenticated','public.learning_product_orders','SELECT') then
    raise exception 'commerce contract: authenticated self-order read unavailable';
  end if;
  if not has_table_privilege('authenticated','public.learning_product_entitlements','SELECT') then
    raise exception 'commerce contract: authenticated entitlement read unavailable';
  end if;
  if not has_table_privilege('authenticated','public.commerce_payment_attempts','SELECT') then
    raise exception 'commerce contract: authenticated self-payment read unavailable';
  end if;
end $$;

-- Security-sensitive RPCs have fixed search_path and least-privilege EXECUTE.
do $$
declare
  v_signature text;
  v_oid regprocedure;
  v_config text;
begin
  foreach v_signature in array array[
    'public.commerce_create_learning_product_order(uuid,text,uuid)',
    'public.commerce_fulfill_learning_product_order(uuid,text,text,numeric)',
    'public.commerce_current_user_has_product_entitlement(uuid)',
    'public.can_viewer_read_chapter(uuid,uuid)',
    'public.can_current_viewer_read_chapter(uuid)',
    'public.get_public_vibetextbook_reader(uuid)',
    'public.claim_commerce_payment_attempt(uuid)',
    'public.attach_commerce_mpesa_request(uuid,text,text,jsonb)',
    'public.process_commerce_payment_callback_event(uuid)',
    'public.commerce_get_publication_purchase_context(uuid)',
    'public.commerce_sync_order_from_payment_attempt()'
  ] loop
    v_oid := to_regprocedure(v_signature);
    if v_oid is null then raise exception 'commerce contract: missing function %', v_signature; end if;
    select coalesce(array_to_string(p.proconfig,','),'') into v_config from pg_proc p where p.oid=v_oid;
    if v_config not like '%search_path=%' then
      raise exception 'commerce contract: function % missing fixed search_path', v_signature;
    end if;
  end loop;

  if has_function_privilege('anon','public.commerce_create_learning_product_order(uuid,text,uuid)','EXECUTE') then
    raise exception 'commerce contract: anonymous order creation executable';
  end if;
  if not has_function_privilege('authenticated','public.commerce_create_learning_product_order(uuid,text,uuid)','EXECUTE') then
    raise exception 'commerce contract: authenticated order creation unavailable';
  end if;
  if has_function_privilege('authenticated','public.commerce_fulfill_learning_product_order(uuid,text,text,numeric)','EXECUTE') then
    raise exception 'commerce contract: browser can fulfill paid order';
  end if;
  if not has_function_privilege('service_role','public.commerce_fulfill_learning_product_order(uuid,text,text,numeric)','EXECUTE') then
    raise exception 'commerce contract: service fulfillment unavailable';
  end if;
  if not has_function_privilege('anon','public.commerce_get_publication_purchase_context(uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.commerce_get_publication_purchase_context(uuid)','EXECUTE') then
    raise exception 'commerce contract: storefront projection unavailable';
  end if;
end $$;

-- Rights clearance is a mechanical saleability invariant.
do $$
begin
  begin
    insert into public.learning_products(sku,product_type,title,status,rights_status)
    values ('verify-rights-block','ebook','Verification fixture','active','unreviewed');
    raise exception 'commerce contract: active product accepted without cleared rights';
  exception
    when check_violation then null;
  end;
end $$;

-- Payment/order relationship, retry and duplicate-charge guards must be installed.
do $$
declare
  v_order_fn text;
  v_sync_fn text;
  v_storefront_fn text;
begin
  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='learning_product_orders'
      and t.tgname='commerce_validate_order_contract' and not t.tgisinternal
  ) then raise exception 'commerce contract: order validator trigger missing'; end if;
  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='commerce_payment_attempts'
      and t.tgname='commerce_validate_payment_attempt_contract' and not t.tgisinternal
  ) then raise exception 'commerce contract: payment validator trigger missing'; end if;
  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='commerce_payment_attempts'
      and t.tgname='commerce_sync_order_from_payment_attempt' and not t.tgisinternal
  ) then raise exception 'commerce contract: failed-payment order-release trigger missing'; end if;

  select pg_get_functiondef('public.commerce_create_learning_product_order(uuid,text,uuid)'::regprocedure) into v_order_fn;
  if v_order_fn not like '%pg_advisory_xact_lock%'
     or v_order_fn not like '%learning_product_entitlements%'
     or v_order_fn not like '%payment_reconciliation_required%'
     or v_order_fn not like '%pending_payment%' then
    raise exception 'commerce contract: order boundary lacks duplicate-charge serialization/entitlement/reconciliation guard';
  end if;

  select pg_get_functiondef('public.commerce_sync_order_from_payment_attempt()'::regprocedure) into v_sync_fn;
  if v_sync_fn not like '%failed%'
     or v_sync_fn not like '%cancelled%'
     or v_sync_fn not like '%expired%'
     or v_sync_fn not like '%reconciliation_required%' then
    raise exception 'commerce contract: payment terminal-state synchronization incomplete';
  end if;

  select pg_get_functiondef('public.commerce_get_publication_purchase_context(uuid)'::regprocedure) into v_storefront_fn;
  if v_storefront_fn not like '%pricing_model = ''one_time''%'
     or v_storefront_fn not like '%rights_status = ''cleared''%' then
    raise exception 'commerce contract: storefront advertises unsupported or uncleared products';
  end if;
end $$;

-- Paid content cannot fall through legacy public chapter/block policies.
do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='vibe_chapters'
      and policyname in ('vibe_chapters_public_read_published','vibe_chapters_public_read_published_or_locked')
  ) then raise exception 'commerce contract: legacy public raw chapter policy still present'; end if;
  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='content_blocks'
      and policyname='content_blocks_public_read'
  ) then raise exception 'commerce contract: legacy public raw content-block policy still present'; end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='vibe_chapters'
      and policyname='vibe_chapters_entitled_reader_select'
      and coalesce(qual,'') like '%can_current_viewer_read_chapter%'
  ) then raise exception 'commerce contract: entitlement-aware chapter RLS missing'; end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='content_blocks'
      and policyname='content_blocks_entitled_reader_select'
      and coalesce(qual,'') like '%can_current_viewer_read_chapter%'
  ) then raise exception 'commerce contract: entitlement-aware content-block RLS missing'; end if;
end $$;

-- Reader helper and public preview must actually depend on durable entitlement logic.
do $$
declare
  v_reader text;
  v_public_reader text;
  v_claim text;
begin
  select pg_get_functiondef('public.can_viewer_read_chapter(uuid,uuid)'::regprocedure) into v_reader;
  if v_reader not like '%learning_product_entitlements%' or v_reader not like '%rights_status%' then
    raise exception 'commerce contract: reader does not bind durable entitlements and cleared rights';
  end if;
  select pg_get_functiondef('public.get_public_vibetextbook_reader(uuid)'::regprocedure) into v_public_reader;
  if v_public_reader not like '%can_viewer_read_chapter%' then
    raise exception 'commerce contract: public preview bypasses canonical reader authority';
  end if;
  select pg_get_functiondef('public.claim_commerce_payment_attempt(uuid)'::regprocedure) into v_claim;
  if v_claim not like '%mpesa_runtime_control%' or v_claim not like '%initiation_enabled%' then
    raise exception 'commerce contract: STK claim does not enforce runtime activation guard';
  end if;
end $$;

-- Schema package is non-activating: it creates no saleable products or orders.
do $$
begin
  if exists (select 1 from public.learning_products where status='active') then
    raise exception 'commerce contract: migration activated a Learning Product';
  end if;
  if exists (select 1 from public.learning_product_orders) then
    raise exception 'commerce contract: migration created commerce orders';
  end if;
end $$;

rollback;

\echo 'Learning Product Commerce Contract: PASS'
