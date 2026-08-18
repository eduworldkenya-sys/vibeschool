begin;

-- Fail-closed certification for the first paid VibeSchool Learning Product.
-- This migration does not activate publications, products, offers, or M-Pesa.

create or replace function public.commerce_get_flagship_launch_readiness(p_publication_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
with publication as (
  select vp.*
  from public.vibe_publications vp
  where vp.id = p_publication_id
), quality as (
  select
    pq.quality_score,
    pq.failed_checks,
    pq.warning_checks,
    pq.checked_at
  from public.publication_quality_current pq
  where pq.publication_id = p_publication_id
), release as (
  select
    count(*) filter (where prc.status='fail')::int as failed,
    count(*) filter (where prc.status='warn')::int as warnings,
    bool_and(prc.status='pass') filter (where prc.check_code='rights_clearance') as rights_clear,
    max(prc.checked_at) as checked_at
  from public.publication_release_checks prc
  where prc.publication_id = p_publication_id
), resource as (
  select lr.id
  from public.learning_resources lr
  where lr.publication_id = p_publication_id
    and lr.source_type='publication'
    and lr.status='active'
  order by lr.created_at asc
  limit 1
), product as (
  select lp.id,lp.sku,lp.status,lp.rights_status
  from public.learning_products lp
  join public.learning_product_items lpi on lpi.product_id=lp.id
  join resource r on r.id=lpi.learning_resource_id
  order by lp.created_at asc
  limit 1
), offer as (
  select o.id,o.offer_key,o.status,o.pricing_model,o.amount_kes,o.preview_policy
  from public.learning_product_offers o
  join product p on p.id=o.product_id
  where o.pricing_model='one_time'
  order by o.created_at asc
  limit 1
), runtime as (
  select initiation_enabled
  from public.mpesa_runtime_control
  where singleton=true
), gates as (
  select
    p.id is not null as publication_exists,
    coalesce(p.format='vibetextbook',false) as vibetextbook,
    coalesce(p.status='published',false) as publication_published,
    coalesce(p.chapter_count,0) >= 8 as sufficient_depth,
    coalesce(q.quality_score,0) >= 90 as quality_threshold,
    coalesce(q.failed_checks,999999)=0 as zero_failed_checks,
    coalesce(r.failed,999999)=0 as release_zero_failures,
    coalesce(r.rights_clear,false) as rights_release_pass,
    rs.id is not null as canonical_publication_resource,
    coalesce(p.pricing->>'type','')='freemium' as freemium_preview,
    case
      when jsonb_typeof(p.pricing->'freeChapters')='number'
      then (p.pricing->>'freeChapters')::int between 1 and greatest(coalesce(p.chapter_count,0)-1,1)
      else false
    end as valid_preview_chapters,
    pr.id is not null as learning_product_exists,
    coalesce(pr.status='active',false) as learning_product_active,
    coalesce(pr.rights_status='cleared',false) as product_rights_cleared,
    ofr.id is not null as one_time_offer_exists,
    coalesce(ofr.status='active',false) as offer_active,
    coalesce(ofr.amount_kes,0)>0 as positive_kes_price,
    coalesce((select initiation_enabled from runtime),false) as mpesa_initiation_enabled
  from publication p
  left join quality q on true
  left join release r on true
  left join resource rs on true
  left join product pr on true
  left join offer ofr on true
)
select jsonb_build_object(
  'ok',true,
  'publication_id',p_publication_id,
  'publication',coalesce((select jsonb_build_object('title',title,'status',status,'format',format,'chapters',chapter_count,'pricing',pricing) from publication),'{}'::jsonb),
  'quality',coalesce((select jsonb_build_object('score',quality_score,'failed_checks',failed_checks,'warning_checks',warning_checks,'checked_at',checked_at) from quality),'{}'::jsonb),
  'commerce',jsonb_build_object(
    'product',coalesce((select jsonb_build_object('id',id,'sku',sku,'status',status,'rights_status',rights_status) from product),'{}'::jsonb),
    'offer',coalesce((select jsonb_build_object('id',id,'offer_key',offer_key,'status',status,'pricing_model',pricing_model,'amount_kes',amount_kes,'preview_policy',preview_policy) from offer),'{}'::jsonb)
  ),
  'gates',(select to_jsonb(gates) from gates),
  'content_ready',(select publication_exists and vibetextbook and publication_published and sufficient_depth and quality_threshold and zero_failed_checks and release_zero_failures and rights_release_pass and canonical_publication_resource and freemium_preview and valid_preview_chapters from gates),
  'commerce_ready',(select learning_product_exists and learning_product_active and product_rights_cleared and one_time_offer_exists and offer_active and positive_kes_price from gates),
  'ready_for_controlled_payment',(select publication_exists and vibetextbook and publication_published and sufficient_depth and quality_threshold and zero_failed_checks and release_zero_failures and rights_release_pass and canonical_publication_resource and freemium_preview and valid_preview_chapters and learning_product_exists and learning_product_active and product_rights_cleared and one_time_offer_exists and offer_active and positive_kes_price and mpesa_initiation_enabled from gates)
);
$function$;

revoke all on function public.commerce_get_flagship_launch_readiness(uuid) from public, anon, authenticated;
grant execute on function public.commerce_get_flagship_launch_readiness(uuid) to service_role;

comment on function public.commerce_get_flagship_launch_readiness(uuid) is
'Service-only fail-closed paid flagship certification. Requires publication quality >=90, zero release failures, rights pass, freemium preview, active cleared Learning Product, positive one-time KES offer, and explicitly enabled M-Pesa before controlled payment is reported ready.';

commit;
