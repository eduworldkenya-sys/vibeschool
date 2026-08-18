\set ON_ERROR_STOP on
begin;

-- This fixture test is intentionally transaction-local and rolled back. It proves
-- the catalogue projection does not surface uncleared/draft inventory and that a
-- rights-cleared one-time textbook offer becomes discoverable without requiring
-- production catalogue activation.
do $$
declare
  v_author uuid;
  v_resource uuid;
  v_publication uuid;
  v_product uuid;
  v_offer uuid;
  v_payload jsonb;
begin
  select id into v_author from public.profiles order by created_at limit 1;
  if v_author is null then
    raise notice 'catalogue fixture skipped: no profile fixture available in disposable database';
    return;
  end if;

  insert into public.vibe_publications(author_id,format,title,status,pricing,chapter_count,curriculum_framework)
  values(v_author,'vibetextbook','Commerce Fixture Textbook','published','{"type":"freemium","freeChapters":1}'::jsonb,3,'Kenya')
  returning id into v_publication;

  insert into public.learning_resources(title,resource_type,source_type,publication_id,status,created_by)
  values('Commerce Fixture Textbook','publication','publication',v_publication,'published',v_author)
  returning id into v_resource;

  insert into public.learning_products(sku,product_type,title,status,owner_type,owner_profile_id,rights_status)
  values('commerce-fixture-textbook','ebook','Commerce Fixture Textbook','draft','creator',v_author,'cleared')
  returning id into v_product;

  insert into public.learning_product_items(product_id,learning_resource_id,item_role,sequence,previewable)
  values(v_product,v_resource,'primary',1,true);

  insert into public.learning_product_offers(product_id,offer_key,pricing_model,amount_kes,status,terms_version)
  values(v_product,'commerce-fixture-one-time','one_time',250,'active','fixture-v1')
  returning id into v_offer;

  select public.commerce_list_storefront(null,null,40) into v_payload;
  if jsonb_array_length(coalesce(v_payload->'items','[]'::jsonb)) <> 0 then
    raise exception 'catalogue fixture: draft product leaked into catalogue';
  end if;

  update public.learning_products set status='active' where id=v_product;
  select public.commerce_list_storefront(null,null,40) into v_payload;
  if not exists (
    select 1 from jsonb_array_elements(coalesce(v_payload->'items','[]'::jsonb)) item
    where item->>'product_id'=v_product::text
      and item->>'publication_id'=v_publication::text
      and item->>'sample_available'='true'
      and item->>'sample_chapters'='1'
      and (item->'offer'->>'amount_kes')::integer=250
  ) then
    raise exception 'catalogue fixture: active cleared offer missing or sample/price projection incorrect';
  end if;

  update public.learning_products set rights_status='restricted' where id=v_product;
  select public.commerce_list_storefront(null,null,40) into v_payload;
  if exists (
    select 1 from jsonb_array_elements(coalesce(v_payload->'items','[]'::jsonb)) item
    where item->>'product_id'=v_product::text
  ) then
    raise exception 'catalogue fixture: restricted product leaked into catalogue';
  end if;
end $$;

rollback;
\echo 'Learning Product Catalogue Fixture Contract: PASS'
