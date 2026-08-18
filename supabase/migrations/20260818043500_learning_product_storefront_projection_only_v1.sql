begin;

-- Raw publishing inventory is an internal business asset. Public discovery and
-- checkout consume explicit SECURITY DEFINER projections rather than direct
-- table SELECTs, preventing future metadata/rights/owner columns from becoming
-- accidental public API surface.
revoke select on table public.learning_products from anon, authenticated;
revoke select on table public.learning_product_items from anon, authenticated;
revoke select on table public.learning_product_curriculum_links from anon, authenticated;
revoke select on table public.learning_product_offers from anon, authenticated;

drop policy if exists learning_products_public_read_active on public.learning_products;
drop policy if exists learning_product_items_public_read_active on public.learning_product_items;
drop policy if exists learning_product_curriculum_public_read_active on public.learning_product_curriculum_links;
drop policy if exists learning_product_offers_public_read_active on public.learning_product_offers;

create or replace function public.commerce_get_publication_purchase_context(p_publication_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_caller uuid := auth.uid();
  v_product public.learning_products%rowtype;
  v_offers jsonb := '[]'::jsonb;
  v_beneficiaries jsonb := '[]'::jsonb;
  v_entitled boolean := false;
begin
  select lp.* into v_product
  from public.learning_resources lr
  join public.learning_product_items lpi
    on lpi.learning_resource_id = lr.id
  join public.learning_products lp
    on lp.id = lpi.product_id
  where lr.source_type = 'publication'
    and lr.publication_id = p_publication_id
    and lp.status = 'active'
    and lp.rights_status = 'cleared'
  order by case lpi.item_role when 'primary' then 0 else 1 end, lp.created_at
  limit 1;

  if not found then
    return jsonb_build_object(
      'ok', true,
      'saleable', false,
      'authenticated', v_caller is not null,
      'product', null,
      'offers', '[]'::jsonb,
      'beneficiaries', '[]'::jsonb,
      'already_entitled', false
    );
  end if;

  -- This P0 checkout intentionally supports permanent/time-bounded one-time
  -- purchases only. Subscription and school-license fulfillment are separate
  -- later lanes and are not falsely advertised as checkout-ready here.
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', o.id,
      'offer_key', o.offer_key,
      'pricing_model', o.pricing_model,
      'amount_kes', o.amount_kes,
      'access_days', o.access_days,
      'preview_policy', o.preview_policy,
      'terms_version', o.terms_version
    ) order by coalesce(o.amount_kes, 0), o.created_at
  ), '[]'::jsonb)
  into v_offers
  from public.learning_product_offers o
  where o.product_id = v_product.id
    and o.status = 'active'
    and o.pricing_model = 'one_time'
    and o.amount_kes is not null
    and o.amount_kes > 0
    and (o.starts_at is null or o.starts_at <= now())
    and (o.ends_at is null or o.ends_at > now());

  if v_caller is not null then
    select exists (
      select 1
      from public.learning_product_entitlements e
      where e.product_id = v_product.id
        and e.status = 'active'
        and e.starts_at <= now()
        and (e.ends_at is null or e.ends_at > now())
        and e.revoked_at is null
        and e.profile_id = v_caller
    ) into v_entitled;

    select coalesce(jsonb_agg(item order by item->>'label'), '[]'::jsonb)
    into v_beneficiaries
    from (
      select jsonb_build_object(
        'kind', 'self',
        'student_id', null,
        'label', 'My account',
        'already_entitled', v_entitled
      ) as item
      union all
      select jsonb_build_object(
        'kind', 'student',
        'student_id', s.id,
        'label', s.name,
        'already_entitled', exists (
          select 1
          from public.learning_product_entitlements e
          where e.product_id = v_product.id
            and e.student_id = s.id
            and e.status = 'active'
            and e.starts_at <= now()
            and (e.ends_at is null or e.ends_at > now())
            and e.revoked_at is null
        )
      )
      from public.parent_student_links psl
      join public.students s on s.id = psl.student_id
      where psl.parent_id = v_caller
        and s.deleted_at is null
    ) q;
  end if;

  return jsonb_build_object(
    'ok', true,
    'saleable', jsonb_array_length(v_offers) > 0,
    'authenticated', v_caller is not null,
    'product', jsonb_build_object(
      'id', v_product.id,
      'sku', v_product.sku,
      'title', v_product.title,
      'description', v_product.description,
      'product_type', v_product.product_type
    ),
    'offers', v_offers,
    'beneficiaries', v_beneficiaries,
    'already_entitled', v_entitled
  );
end;
$function$;

revoke all on function public.commerce_get_publication_purchase_context(uuid) from public;
grant execute on function public.commerce_get_publication_purchase_context(uuid) to anon, authenticated, service_role;

comment on function public.commerce_get_publication_purchase_context(uuid) is
'Allowlisted storefront projection for one publication. Raw Learning Product, offer, item and curriculum-link tables remain unavailable to browser roles.';

commit;
