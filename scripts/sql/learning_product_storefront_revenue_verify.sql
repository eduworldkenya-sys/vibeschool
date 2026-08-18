\set ON_ERROR_STOP on
begin;

do $$
declare
  v_sig text;
  v_oid regprocedure;
  v_config text;
begin
  foreach v_sig in array array[
    'public.commerce_list_storefront(text,text,integer)',
    'public.commerce_get_my_publisher_analytics(integer)',
    'public.commerce_get_platform_revenue_analytics(integer)'
  ] loop
    v_oid := to_regprocedure(v_sig);
    if v_oid is null then raise exception 'storefront/revenue contract: missing function %', v_sig; end if;
    select coalesce(array_to_string(p.proconfig,','),'') into v_config from pg_proc p where p.oid=v_oid;
    if v_config not like '%search_path=%' then raise exception 'storefront/revenue contract: % lacks fixed search_path', v_sig; end if;
  end loop;
end $$;

do $$
begin
  if not has_function_privilege('anon','public.commerce_list_storefront(text,text,integer)','EXECUTE') then
    raise exception 'storefront/revenue contract: anonymous catalogue unavailable';
  end if;
  if not has_function_privilege('authenticated','public.commerce_list_storefront(text,text,integer)','EXECUTE') then
    raise exception 'storefront/revenue contract: authenticated catalogue unavailable';
  end if;
  if has_function_privilege('anon','public.commerce_get_my_publisher_analytics(integer)','EXECUTE') then
    raise exception 'storefront/revenue contract: anonymous publisher analytics exposed';
  end if;
  if not has_function_privilege('authenticated','public.commerce_get_my_publisher_analytics(integer)','EXECUTE') then
    raise exception 'storefront/revenue contract: publisher analytics unavailable';
  end if;
  if has_function_privilege('authenticated','public.commerce_get_platform_revenue_analytics(integer)','EXECUTE') then
    raise exception 'storefront/revenue contract: platform revenue exposed to browser role';
  end if;
  if not has_function_privilege('service_role','public.commerce_get_platform_revenue_analytics(integer)','EXECUTE') then
    raise exception 'storefront/revenue contract: service revenue analytics unavailable';
  end if;
end $$;

do $$
declare
  v_catalogue text;
  v_publisher text;
  v_platform text;
begin
  select pg_get_functiondef('public.commerce_list_storefront(text,text,integer)'::regprocedure) into v_catalogue;
  if v_catalogue not like '%rights_status = ''cleared''%'
     or v_catalogue not like '%pricing_model = ''one_time''%'
     or v_catalogue not like '%vp.status = ''published''%'
     or v_catalogue not like '%freeChapters%' then
    raise exception 'storefront/revenue contract: catalogue lacks rights/offer/publication/sample invariants';
  end if;

  select pg_get_functiondef('public.commerce_get_my_publisher_analytics(integer)'::regprocedure) into v_publisher;
  if v_publisher not like '%owner_profile_id = v_caller%'
     or v_publisher not like '%vp.author_id = v_caller%'
     or v_publisher not like '%status=''fulfilled''%'
     or v_publisher not like '%vibe_publication_views%' then
    raise exception 'storefront/revenue contract: publisher analytics not owner-scoped or ledger-derived';
  end if;

  select pg_get_functiondef('public.commerce_get_platform_revenue_analytics(integer)'::regprocedure) into v_platform;
  if v_platform not like '%learning_product_orders%'
     or v_platform not like '%status=''fulfilled''%'
     or v_platform not like '%learning_product_entitlements%' then
    raise exception 'storefront/revenue contract: platform analytics not ledger-derived';
  end if;
end $$;

-- Completion layer remains non-activating.
do $$
begin
  if exists (select 1 from public.learning_products where status='active') then
    raise exception 'storefront/revenue contract: completion migration activated a product';
  end if;
  if exists (select 1 from public.learning_product_orders) then
    raise exception 'storefront/revenue contract: completion migration created an order';
  end if;
end $$;

rollback;
\echo 'Learning Product Storefront + Revenue Contract: PASS'
