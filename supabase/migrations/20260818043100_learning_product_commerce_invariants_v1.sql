begin;

-- Commercial invariants that must hold even for privileged/server writes.
alter table public.learning_products
  add constraint learning_products_active_requires_rights_check
  check (status <> 'active' or rights_status = 'cleared');

create or replace function public.commerce_validate_order_contract()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_offer public.learning_product_offers%rowtype;
  v_product public.learning_products%rowtype;
begin
  select * into v_offer from public.learning_product_offers where id = new.offer_id;
  if not found then raise exception 'commerce_order_offer_missing'; end if;

  select * into v_product from public.learning_products where id = new.product_id;
  if not found then raise exception 'commerce_order_product_missing'; end if;

  if v_offer.product_id <> new.product_id then
    raise exception 'commerce_order_offer_product_mismatch';
  end if;
  if new.amount_kes is distinct from coalesce(v_offer.amount_kes, 0) then
    raise exception 'commerce_order_amount_mismatch';
  end if;
  if new.currency <> 'KES' then raise exception 'commerce_order_currency_invalid'; end if;
  if v_product.status <> 'active' or v_product.rights_status <> 'cleared' then
    raise exception 'commerce_order_product_not_saleable';
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists commerce_validate_order_contract on public.learning_product_orders;
create trigger commerce_validate_order_contract
before insert or update of product_id, offer_id, amount_kes, currency
on public.learning_product_orders
for each row execute function public.commerce_validate_order_contract();

create or replace function public.commerce_validate_payment_attempt_contract()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_order public.learning_product_orders%rowtype;
begin
  select * into v_order from public.learning_product_orders where id = new.order_id;
  if not found then raise exception 'commerce_payment_order_missing'; end if;
  if new.payer_profile_id <> v_order.purchaser_profile_id then
    raise exception 'commerce_payment_payer_mismatch';
  end if;
  if new.expected_amount_kes <> v_order.amount_kes then
    raise exception 'commerce_payment_amount_mismatch';
  end if;
  if new.provider <> 'mpesa' then raise exception 'commerce_payment_provider_invalid'; end if;

  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists commerce_validate_payment_attempt_contract on public.commerce_payment_attempts;
create trigger commerce_validate_payment_attempt_contract
before insert or update of order_id, payer_profile_id, expected_amount_kes, provider
on public.commerce_payment_attempts
for each row execute function public.commerce_validate_payment_attempt_contract();

-- Locked chapters are never part of an anonymous/free preview. They may be
-- consumed by the author or by an authenticated viewer with a durable product
-- entitlement. This keeps `locked` useful for paid publication delivery.
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
  select * into v_chapter from public.vibe_chapters where id = p_chapter_id;
  if not found then return false; end if;

  select * into v_publication from public.vibe_publications where id = v_chapter.publication_id;
  if not found or v_publication.format <> 'vibetextbook' then return false; end if;

  v_viewer_is_author := p_viewer_id is not null and p_viewer_id = v_publication.author_id;
  if v_publication.status <> 'published' and not v_viewer_is_author then return false; end if;
  if v_viewer_is_author then return true; end if;
  if v_chapter.status not in ('published','locked') then return false; end if;

  v_pricing_type := coalesce(v_publication.pricing->>'type', 'free');
  v_free_chapter_count := case
    when jsonb_typeof(v_publication.pricing->'freeChapters') = 'number'
      then greatest(0, (v_publication.pricing->>'freeChapters')::integer)
    else 0
  end;

  if v_chapter.status = 'published' and v_pricing_type in ('free','donation') then
    return true;
  end if;
  if v_chapter.status = 'published'
     and v_pricing_type = 'freemium'
     and v_chapter.number <= v_free_chapter_count then
    return true;
  end if;
  if p_viewer_id is null then return false; end if;

  return exists (
    select 1
    from public.learning_resources lr
    join public.learning_product_items lpi
      on lpi.learning_resource_id = lr.id
    join public.learning_products lp
      on lp.id = lpi.product_id
     and lp.status = 'active'
     and lp.rights_status = 'cleared'
    join public.learning_product_entitlements e
      on e.product_id = lp.id
    where lr.source_type = 'publication'
      and lr.publication_id = v_publication.id
      and e.status = 'active'
      and e.starts_at <= now()
      and (e.ends_at is null or e.ends_at > now())
      and e.revoked_at is null
      and (
        e.profile_id = p_viewer_id
        or exists (
          select 1
          from public.students s
          where s.id = e.student_id
            and s.profile_id = p_viewer_id
            and s.deleted_at is null
        )
      )
  );
end;
$function$;

revoke all on function public.can_viewer_read_chapter(uuid,uuid) from public, anon, authenticated;
grant execute on function public.can_viewer_read_chapter(uuid,uuid) to service_role;

-- Public reader: metadata may advertise locked units, but raw blocks are emitted
-- only when the anonymous entitlement decision says they are genuinely free.
create or replace function public.get_public_vibetextbook_reader(publication_id_input uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_publication public.vibe_publications%rowtype;
  v_publication_payload jsonb;
  v_chapters jsonb;
begin
  select * into v_publication
  from public.vibe_publications
  where id = publication_id_input
    and format = 'vibetextbook'
    and status = 'published';

  if not found then return jsonb_build_object('ok',false,'reason','not_found'); end if;

  v_publication_payload := jsonb_build_object(
    'id',v_publication.id,'format',v_publication.format,'title',v_publication.title,
    'subtitle',v_publication.subtitle,'cover_url',v_publication.cover_url,
    'description',v_publication.description,'genre',v_publication.genre,
    'tags',v_publication.tags,'language',v_publication.language,'status',v_publication.status,
    'pricing',v_publication.pricing,'chapter_count',v_publication.chapter_count,
    'total_reads',v_publication.total_reads,'total_vibes',v_publication.total_vibes,
    'cbc_subject',v_publication.cbc_subject,'cbc_grade',v_publication.cbc_grade,
    'cbc_aligned',v_publication.cbc_aligned,'curriculum_framework',v_publication.curriculum_framework,
    'series_name',v_publication.series_name,'series_number',v_publication.series_number,
    'publication_name',v_publication.publication_name,'issue_number',v_publication.issue_number,
    'created_at',v_publication.created_at,'updated_at',v_publication.updated_at,
    'published_at',v_publication.published_at
  );

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',c.id,'publication_id',c.publication_id,'title',c.title,'number',c.number,
      'status',c.status,'word_count',c.word_count,'reading_time_min',c.reading_time_min,
      'published_at',c.published_at,'created_at',c.created_at,'updated_at',c.updated_at,
      'cbc_strand',c.cbc_strand,
      'can_read',public.can_viewer_read_chapter(c.id,null),
      'is_bookmarked',false,'progress_percent',0,'completed_at',null,'last_read_at',null,
      'curriculum',jsonb_build_object(
        'framework',v_publication.curriculum_framework,'grade',v_publication.cbc_grade,
        'subject',v_publication.cbc_subject,'strand',c.cbc_strand,'sub_strand',null,
        'topic',null,'term',null,'week',null,'learning_outcomes',coalesce(c.learning_outcomes,'{}'),
        'key_inquiry_questions','{}','suggested_experiences','{}','core_competencies','{}',
        'core_values','{}','source_ref',null,'alignment_status',c.alignment_status,
        'authority',case c.alignment_status
          when 'verified' then 'official'
          when 'creator_claimed' then 'publisher'
          when 'pending_review' then 'publisher'
          else null end,
        'verified_by',null,'verified_at',c.verified_at,
        'has_curriculum_detail',(c.cbc_strand is not null or coalesce(array_length(c.learning_outcomes,1),0)>0)
      ),
      'blocks',case
        when public.can_viewer_read_chapter(c.id,null)
          then case when jsonb_typeof(c.blocks)='array' then c.blocks else '[]'::jsonb end
        else null end
    ) order by c.number
  ),'[]'::jsonb)
  into v_chapters
  from public.vibe_chapters c
  where c.publication_id = v_publication.id
    and c.status in ('published','locked');

  return jsonb_build_object(
    'ok',true,'reason',null,'viewer_is_author',false,
    'author_name','Vibeschool Publisher','publication',v_publication_payload,
    'chapters',v_chapters,'resume',null
  );
end;
$function$;

revoke all on function public.get_public_vibetextbook_reader(uuid) from public;
grant execute on function public.get_public_vibetextbook_reader(uuid) to anon, authenticated, service_role;

comment on constraint learning_products_active_requires_rights_check on public.learning_products is
'No Learning Product can enter the saleable catalogue until rights are explicitly cleared.';

commit;
