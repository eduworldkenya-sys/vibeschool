begin;

-- Publishing commerce completion layer.
-- Builds on the non-activating Learning Product commerce spine. This migration
-- creates projections and analytics only; it does not activate products, offers,
-- M-Pesa initiation or mutate publication pricing.

create or replace function public.commerce_list_storefront(
  p_subject text default null,
  p_grade text default null,
  p_limit integer default 40
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  with candidates as (
    select
      lp.id as product_id,
      vp.id as publication_id,
      lp.sku,
      lp.product_type,
      lp.title,
      coalesce(lp.description, vp.description) as description,
      vp.cover_url,
      vp.cbc_subject,
      vp.cbc_grade,
      vp.language,
      vp.chapter_count,
      vp.total_reads,
      vp.published_at,
      o.id as offer_id,
      o.offer_key,
      o.pricing_model,
      o.amount_kes,
      o.access_days,
      o.preview_policy,
      o.terms_version,
      case
        when coalesce(vp.pricing->>'type','free') in ('free','donation') then true
        when coalesce(vp.pricing->>'type','free') = 'freemium'
          and jsonb_typeof(vp.pricing->'freeChapters') = 'number'
          and (vp.pricing->>'freeChapters')::integer > 0 then true
        else false
      end as sample_available,
      case
        when coalesce(vp.pricing->>'type','free') = 'freemium'
          and jsonb_typeof(vp.pricing->'freeChapters') = 'number'
          then greatest(0,(vp.pricing->>'freeChapters')::integer)
        when coalesce(vp.pricing->>'type','free') in ('free','donation') then vp.chapter_count
        else 0
      end as sample_chapters,
      row_number() over (
        partition by lp.id
        order by o.amount_kes asc, o.created_at asc
      ) as offer_rank
    from public.learning_products lp
    join public.learning_product_items lpi on lpi.product_id = lp.id
    join public.learning_resources lr
      on lr.id = lpi.learning_resource_id
      and lr.source_type = 'publication'
      and lr.publication_id is not null
    join public.vibe_publications vp
      on vp.id = lr.publication_id
      and vp.status = 'published'
      and vp.format = 'vibetextbook'
    join public.learning_product_offers o
      on o.product_id = lp.id
      and o.status = 'active'
      and o.pricing_model = 'one_time'
      and o.amount_kes is not null
      and o.amount_kes > 0
      and (o.starts_at is null or o.starts_at <= now())
      and (o.ends_at is null or o.ends_at > now())
    where lp.status = 'active'
      and lp.rights_status = 'cleared'
      and (p_subject is null or lower(coalesce(vp.cbc_subject,'')) = lower(btrim(p_subject)))
      and (p_grade is null or lower(coalesce(vp.cbc_grade,'')) = lower(btrim(p_grade)))
  ), limited as (
    select * from candidates
    where offer_rank = 1
    order by published_at desc nulls last, title
    limit least(greatest(coalesce(p_limit,40),1),100)
  )
  select jsonb_build_object(
    'ok', true,
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'product_id', product_id,
      'publication_id', publication_id,
      'sku', sku,
      'product_type', product_type,
      'title', title,
      'description', description,
      'cover_url', cover_url,
      'subject', cbc_subject,
      'grade', cbc_grade,
      'language', language,
      'chapter_count', chapter_count,
      'total_reads', coalesce(total_reads,0),
      'offer', jsonb_build_object(
        'id', offer_id,
        'offer_key', offer_key,
        'pricing_model', pricing_model,
        'amount_kes', amount_kes,
        'access_days', access_days,
        'terms_version', terms_version
      ),
      'sample_available', sample_available,
      'sample_chapters', sample_chapters
    ) order by published_at desc nulls last, title), '[]'::jsonb)
  )
  from limited;
$function$;

revoke all on function public.commerce_list_storefront(text,text,integer) from public;
grant execute on function public.commerce_list_storefront(text,text,integer) to anon, authenticated, service_role;

comment on function public.commerce_list_storefront(text,text,integer) is
'Allowlisted public Learning Product catalogue. Returns only cleared, active, one-time saleable textbook offers. Sample availability mirrors canonical publication pricing so catalogue never promises content the reader will deny.';

create or replace function public.commerce_get_my_publisher_analytics(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_caller uuid := auth.uid();
  v_days integer := least(greatest(coalesce(p_days,30),1),365);
  v_from timestamptz;
  v_totals jsonb;
  v_products jsonb;
begin
  if v_caller is null then raise exception 'authentication_required'; end if;
  v_from := now() - make_interval(days => v_days);

  with owned_products as (
    select distinct lp.id as product_id, lp.title, vp.id as publication_id
    from public.learning_products lp
    left join public.learning_product_items lpi on lpi.product_id = lp.id
    left join public.learning_resources lr on lr.id = lpi.learning_resource_id and lr.source_type='publication'
    left join public.vibe_publications vp on vp.id = lr.publication_id
    where lp.owner_profile_id = v_caller
       or vp.author_id = v_caller
  ), order_stats as (
    select
      op.product_id,
      count(*) filter (where o.created_at >= v_from) as orders,
      count(*) filter (where o.status='fulfilled' and o.fulfilled_at >= v_from) as fulfilled_orders,
      count(distinct o.purchaser_profile_id) filter (where o.status='fulfilled' and o.fulfilled_at >= v_from) as buyers,
      coalesce(sum(o.amount_kes) filter (where o.status='fulfilled' and o.fulfilled_at >= v_from),0) as gross_revenue_kes,
      count(*) filter (where o.status='reconciliation_required' and o.updated_at >= v_from) as reconciliation_required,
      count(*) filter (where o.status='refunded' and o.refunded_at >= v_from) as refunds
    from owned_products op
    left join public.learning_product_orders o on o.product_id = op.product_id
    group by op.product_id
  ), entitlement_stats as (
    select op.product_id,
      count(e.id) filter (
        where e.status='active' and e.starts_at <= now()
          and (e.ends_at is null or e.ends_at > now()) and e.revoked_at is null
      ) as active_entitlements
    from owned_products op
    left join public.learning_product_entitlements e on e.product_id=op.product_id
    group by op.product_id
  ), view_stats as (
    select op.product_id,
      count(v.id) filter (where v.viewed_at >= v_from) as publication_views
    from owned_products op
    left join public.vibe_publication_views v on v.publication_id=op.publication_id
    group by op.product_id
  ), product_rows as (
    select
      op.product_id, op.title,
      coalesce(os.orders,0) as orders,
      coalesce(os.fulfilled_orders,0) as fulfilled_orders,
      coalesce(os.buyers,0) as buyers,
      coalesce(os.gross_revenue_kes,0) as gross_revenue_kes,
      coalesce(os.reconciliation_required,0) as reconciliation_required,
      coalesce(os.refunds,0) as refunds,
      coalesce(es.active_entitlements,0) as active_entitlements,
      coalesce(vs.publication_views,0) as publication_views
    from owned_products op
    left join order_stats os using(product_id)
    left join entitlement_stats es using(product_id)
    left join view_stats vs using(product_id)
  )
  select
    jsonb_build_object(
      'days', v_days,
      'product_count', count(*),
      'orders', coalesce(sum(orders),0),
      'fulfilled_orders', coalesce(sum(fulfilled_orders),0),
      'buyers', coalesce(sum(buyers),0),
      'gross_revenue_kes', coalesce(sum(gross_revenue_kes),0),
      'active_entitlements', coalesce(sum(active_entitlements),0),
      'publication_views', coalesce(sum(publication_views),0),
      'reconciliation_required', coalesce(sum(reconciliation_required),0),
      'refunds', coalesce(sum(refunds),0)
    ),
    coalesce(jsonb_agg(jsonb_build_object(
      'product_id', product_id,
      'title', title,
      'orders', orders,
      'fulfilled_orders', fulfilled_orders,
      'buyers', buyers,
      'gross_revenue_kes', gross_revenue_kes,
      'active_entitlements', active_entitlements,
      'publication_views', publication_views,
      'reconciliation_required', reconciliation_required,
      'refunds', refunds
    ) order by gross_revenue_kes desc, title), '[]'::jsonb)
  into v_totals, v_products
  from product_rows;

  return jsonb_build_object('ok',true,'from',v_from,'to',now(),'totals',coalesce(v_totals,'{}'::jsonb),'products',coalesce(v_products,'[]'::jsonb));
end;
$function$;

revoke all on function public.commerce_get_my_publisher_analytics(integer) from public, anon;
grant execute on function public.commerce_get_my_publisher_analytics(integer) to authenticated, service_role;

comment on function public.commerce_get_my_publisher_analytics(integer) is
'Owner-scoped publisher analytics derived from immutable fulfilled orders, durable entitlements and publication views. Never trusts mutable publication earnings counters.';

create or replace function public.commerce_get_platform_revenue_analytics(p_days integer default 30)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  with bounds as (
    select now() - make_interval(days => least(greatest(coalesce(p_days,30),1),365)) as from_at
  ), rows as (
    select
      count(*) filter (where o.created_at >= b.from_at) as orders,
      count(*) filter (where o.status='fulfilled' and o.fulfilled_at >= b.from_at) as fulfilled_orders,
      count(distinct o.purchaser_profile_id) filter (where o.status='fulfilled' and o.fulfilled_at >= b.from_at) as buyers,
      coalesce(sum(o.amount_kes) filter (where o.status='fulfilled' and o.fulfilled_at >= b.from_at),0) as gross_revenue_kes,
      count(*) filter (where o.status='reconciliation_required' and o.updated_at >= b.from_at) as reconciliation_required,
      count(*) filter (where o.status='refunded' and o.refunded_at >= b.from_at) as refunds
    from public.learning_product_orders o cross join bounds b
  )
  select jsonb_build_object(
    'ok',true,
    'days',least(greatest(coalesce(p_days,30),1),365),
    'orders',orders,
    'fulfilled_orders',fulfilled_orders,
    'buyers',buyers,
    'gross_revenue_kes',gross_revenue_kes,
    'reconciliation_required',reconciliation_required,
    'refunds',refunds,
    'active_entitlements',(select count(*) from public.learning_product_entitlements e where e.status='active' and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now()) and e.revoked_at is null)
  ) from rows;
$function$;

revoke all on function public.commerce_get_platform_revenue_analytics(integer) from public, anon, authenticated;
grant execute on function public.commerce_get_platform_revenue_analytics(integer) to service_role;

comment on function public.commerce_get_platform_revenue_analytics(integer) is
'Service-only company revenue snapshot for Learning Product commerce. Financial truth is derived from fulfilled orders and entitlement ledger state.';

commit;
