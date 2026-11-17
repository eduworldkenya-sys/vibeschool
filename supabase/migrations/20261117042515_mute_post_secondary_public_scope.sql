-- Owner-authorized reversible school-only rollout, November 2026.
-- No content, education path, profile, enrollment, progress, publication status,
-- chapter status or historical release record is deleted or rewritten.
-- authorization-test: public.courses, public.learner_education_paths, public.vibe_publications, public.vibe_chapters
-- The academy tables currently contain only post-school courses. School curriculum uses the canonical school library.
create or replace function public.post_secondary_public_enabled()
returns boolean language sql stable set search_path = ''
as $$ select false $$;
revoke all on function public.post_secondary_public_enabled() from public;
grant execute on function public.post_secondary_public_enabled() to anon, authenticated, service_role;
comment on function public.post_secondary_public_enabled() is 'School-only public rollout. Reactivate via reviewed release coordinated with the application scope flag; no row lifecycle changes.';

-- Fixed IDs protect the two existing CPA Originals even if their metadata changes.
-- Future post-school books must carry a stage/qualification tag; the known IDs remain protected.
-- This narrow definer returns only a boolean, never publication contents or subscriber data.
create or replace function public.post_secondary_publication_visible(p_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.post_secondary_public_enabled()
    or (p_id is distinct from '51f1052d-2f59-46bb-9186-c1a7937d203a'::uuid
        and p_id is distinct from 'c0b2a83f-d726-4eed-812e-7d79f57497df'::uuid
        and not exists (
          select 1 from public.vibe_publications p where p.id=p_id and (
            lower(btrim(coalesce(p.cbc_grade,''))) in ('college','university','professional studies','tvet','post-secondary','post_secondary','certificate','diploma','higher diploma','undergraduate','postgraduate','cpa','cs')
            or exists (select 1 from unnest(coalesce(p.tags, ARRAY[]::text[])) tag
              where lower(btrim(tag)) in ('cpa','kasneb','kasneb cpa','kasneb cs','certified public accountants','certified secretaries','post-secondary','post_secondary','professional studies','college','university','tvet'))
          )
        ));
$$;
revoke all on function public.post_secondary_publication_visible(uuid) from public;
grant execute on function public.post_secondary_publication_visible(uuid) to anon, authenticated, service_role;
comment on function public.post_secondary_publication_visible(uuid) is 'A visibility intersection only; never grants content access. Preserves school and general reading.';

-- Clean-replay compatibility: production catalog verified 2026-11-17.
-- These two legacy tables already existed before the recorded live migration.
-- CREATE IF NOT EXISTS and matching existing policy/index/grant definitions
-- reconstruct the missing ledger prerequisites without replacing existing data.
create table if not exists public.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learner_profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  unique (learner_id, course_id)
);
alter table public.course_enrollments enable row level security;
revoke all on public.course_enrollments from public;
grant select, insert, update, delete on public.course_enrollments to anon, authenticated;
grant all on public.course_enrollments to service_role;
drop policy if exists "learner inserts own enrollment" on public.course_enrollments;
create policy "learner inserts own enrollment" on public.course_enrollments for insert with check (auth.uid() = learner_id);
drop policy if exists "learner reads own enrollment" on public.course_enrollments;
create policy "learner reads own enrollment" on public.course_enrollments for select using (auth.uid() = learner_id);

create table if not exists public.vibe_saved_items (
  id uuid primary key default gen_random_uuid(),
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  publication_id uuid not null references public.vibe_publications(id) on delete cascade,
  chapter_id uuid references public.vibe_chapters(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.vibe_saved_items enable row level security;
revoke all on public.vibe_saved_items from public, anon;
grant select, insert, update, delete on public.vibe_saved_items to authenticated;
grant all on public.vibe_saved_items to service_role;
create unique index if not exists uq_vibe_saved_items_book on public.vibe_saved_items(viewer_id, publication_id) where chapter_id is null;
create unique index if not exists uq_vibe_saved_items_chapter on public.vibe_saved_items(viewer_id, publication_id, chapter_id) where chapter_id is not null;
create index if not exists idx_vibe_saved_items_viewer on public.vibe_saved_items(viewer_id, created_at desc);
drop policy if exists vibe_saved_items_owner_select on public.vibe_saved_items;
create policy vibe_saved_items_owner_select on public.vibe_saved_items for select using (viewer_id=auth.uid());

-- Existing authenticated owners retain their private pathway lookup to route to a
-- neutral unavailable screen. New pathway inserts and changes are denied at RLS.
-- Existing owned records are preserved, never silently reclassified.

drop policy if exists post_secondary_public_mute on public.courses;
create policy post_secondary_public_mute on public.courses as restrictive for select to anon, authenticated using (public.post_secondary_public_enabled());

drop policy if exists post_secondary_public_mute on public.modules;
create policy post_secondary_public_mute on public.modules as restrictive for select to anon, authenticated using (public.post_secondary_public_enabled());

drop policy if exists post_secondary_public_mute on public.topics;
create policy post_secondary_public_mute on public.topics as restrictive for select to anon, authenticated using (public.post_secondary_public_enabled());

drop policy if exists post_secondary_public_mute on public.quiz_questions;
create policy post_secondary_public_mute on public.quiz_questions as restrictive for select to anon, authenticated using (public.post_secondary_public_enabled());

drop policy if exists post_secondary_public_mute on public.course_enrollments;
create policy post_secondary_public_mute on public.course_enrollments as restrictive for all to authenticated using (public.post_secondary_public_enabled()) with check (public.post_secondary_public_enabled());

drop policy if exists post_secondary_public_mute on public.learner_progress;
create policy post_secondary_public_mute on public.learner_progress as restrictive for all to authenticated using (public.post_secondary_public_enabled()) with check (public.post_secondary_public_enabled());

drop policy if exists post_secondary_public_mute_insert on public.learner_education_paths;
create policy post_secondary_public_mute_insert on public.learner_education_paths as restrictive for insert to authenticated with check (public.post_secondary_public_enabled());
drop policy if exists post_secondary_public_mute_update on public.learner_education_paths;
create policy post_secondary_public_mute_update on public.learner_education_paths as restrictive for update to authenticated using (public.post_secondary_public_enabled()) with check (public.post_secondary_public_enabled());

drop policy if exists post_secondary_public_mute on public.vibe_publications;
create policy post_secondary_public_mute on public.vibe_publications as restrictive for select to anon, authenticated using (public.post_secondary_publication_visible(id));

drop policy if exists post_secondary_public_mute on public.vibe_chapters;
create policy post_secondary_public_mute on public.vibe_chapters as restrictive for select to anon, authenticated using (public.post_secondary_publication_visible(publication_id));

drop policy if exists post_secondary_public_mute on public.content_blocks;
create policy post_secondary_public_mute on public.content_blocks as restrictive for select to anon, authenticated using (public.post_secondary_publication_visible(publication_id));

drop policy if exists post_secondary_public_mute on public.learning_resources;
create policy post_secondary_public_mute on public.learning_resources as restrictive for select to anon, authenticated using (public.post_secondary_publication_visible(publication_id));

drop policy if exists post_secondary_public_mute on public.vibelearn_content;
create policy post_secondary_public_mute on public.vibelearn_content as restrictive for select to anon, authenticated using (public.post_secondary_publication_visible(vibe_publication_id));

drop policy if exists post_secondary_public_mute on public.vibe_saved_items;
create policy post_secondary_public_mute on public.vibe_saved_items as restrictive for all to authenticated using (public.post_secondary_publication_visible(publication_id)) with check (public.post_secondary_publication_visible(publication_id));

drop policy if exists post_secondary_public_mute on public.vibe_reading_progress;
create policy post_secondary_public_mute on public.vibe_reading_progress as restrictive for all to authenticated using (public.post_secondary_publication_visible(publication_id)) with check (public.post_secondary_publication_visible(publication_id));

drop policy if exists post_secondary_public_mute on public.vibe_workspace_items;
create policy post_secondary_public_mute on public.vibe_workspace_items as restrictive for all to authenticated using (public.post_secondary_publication_visible(publication_id)) with check (public.post_secondary_publication_visible(publication_id));

-- Existing security-definer RPCs bypass RLS. Each existing contract and grant is preserved;
-- add the same release intersection at its read/write authority boundary, not a replacement engine.

-- can_viewer_read_chapter
CREATE OR REPLACE FUNCTION public.can_viewer_read_chapter(p_chapter_id uuid, p_viewer_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_chapter public.vibe_chapters%rowtype; v_publication public.vibe_publications%rowtype; v_viewer_is_author boolean:=false; v_pricing_type text; v_free_chapter_count integer:=0;
begin
  select * into v_chapter from public.vibe_chapters where id=p_chapter_id; if not found then return false; end if;
  select * into v_publication from public.vibe_publications where id=v_chapter.publication_id; if not found or v_publication.format<>'vibetextbook' or not public.post_secondary_publication_visible(v_publication.id) then return false; end if;
  v_viewer_is_author:=p_viewer_id is not null and p_viewer_id=v_publication.author_id;
  if v_publication.status<>'published' and not v_viewer_is_author then return false; end if; if v_viewer_is_author then return true; end if; if v_chapter.status not in ('published','locked') then return false; end if;
  v_pricing_type:=coalesce(v_publication.pricing->>'type','free'); v_free_chapter_count:=case when jsonb_typeof(v_publication.pricing->'freeChapters')='number' then greatest(0,(v_publication.pricing->>'freeChapters')::integer) else 0 end;
  if v_chapter.status='published' and v_pricing_type in ('free','donation') then return true; end if;
  if v_chapter.status='published' and v_pricing_type='freemium' and v_chapter.number<=v_free_chapter_count then return true; end if;
  if p_viewer_id is null then return false; end if;
  return exists(select 1 from public.learning_resources lr join public.learning_product_items lpi on lpi.learning_resource_id=lr.id join public.learning_products lp on lp.id=lpi.product_id and lp.status='active' and lp.rights_status='cleared' join public.learning_product_entitlements e on e.product_id=lp.id where lr.source_type='publication' and lr.publication_id=v_publication.id and e.status='active' and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now()) and e.revoked_at is null and (e.profile_id=p_viewer_id or exists(select 1 from public.students s where s.id=e.student_id and s.profile_id=p_viewer_id and s.deleted_at is null)));
end;$function$;

-- commerce_get_publication_purchase_context
CREATE OR REPLACE FUNCTION public.commerce_get_publication_purchase_context(p_publication_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_caller uuid:=auth.uid(); v_product public.learning_products%rowtype; v_offers jsonb:='[]'::jsonb; v_beneficiaries jsonb:='[]'::jsonb; v_entitled boolean:=false;
begin
  select lp.* into v_product from public.learning_resources lr join public.learning_product_items lpi on lpi.learning_resource_id=lr.id join public.learning_products lp on lp.id=lpi.product_id where lr.source_type='publication' and lr.publication_id=p_publication_id and public.post_secondary_publication_visible(p_publication_id) and lp.status='active' and lp.rights_status='cleared' order by case lpi.item_role when 'primary' then 0 else 1 end,lp.created_at limit 1;
  if not found then return jsonb_build_object('ok',true,'saleable',false,'authenticated',v_caller is not null,'product',null,'offers','[]'::jsonb,'beneficiaries','[]'::jsonb,'already_entitled',false); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'offer_key',o.offer_key,'pricing_model',o.pricing_model,'amount_kes',o.amount_kes,'access_days',o.access_days,'preview_policy',o.preview_policy,'terms_version',o.terms_version) order by coalesce(o.amount_kes,0),o.created_at),'[]'::jsonb) into v_offers from public.learning_product_offers o where o.product_id=v_product.id and o.status='active' and o.pricing_model='one_time' and o.amount_kes is not null and o.amount_kes>0 and (o.starts_at is null or o.starts_at<=now()) and (o.ends_at is null or o.ends_at>now());
  if v_caller is not null then
    select exists(select 1 from public.learning_product_entitlements e where e.product_id=v_product.id and e.status='active' and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now()) and e.revoked_at is null and e.profile_id=v_caller) into v_entitled;
    select coalesce(jsonb_agg(item order by item->>'label'),'[]'::jsonb) into v_beneficiaries from (select jsonb_build_object('kind','self','student_id',null,'label','My account','already_entitled',v_entitled) item union all select jsonb_build_object('kind','student','student_id',s.id,'label',s.name,'already_entitled',exists(select 1 from public.learning_product_entitlements e where e.product_id=v_product.id and e.student_id=s.id and e.status='active' and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now()) and e.revoked_at is null)) from public.parent_student_links psl join public.students s on s.id=psl.student_id where psl.parent_id=v_caller and s.deleted_at is null) q;
  end if;
  return jsonb_build_object('ok',true,'saleable',jsonb_array_length(v_offers)>0,'authenticated',v_caller is not null,'product',jsonb_build_object('id',v_product.id,'sku',v_product.sku,'title',v_product.title,'description',v_product.description,'product_type',v_product.product_type),'offers',v_offers,'beneficiaries',v_beneficiaries,'already_entitled',v_entitled);
end;$function$;

-- commerce_list_storefront
CREATE OR REPLACE FUNCTION public.commerce_list_storefront(p_subject text DEFAULT NULL::text, p_grade text DEFAULT NULL::text, p_limit integer DEFAULT 40)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with candidates as (
    select lp.id product_id,vp.id publication_id,lp.sku,lp.product_type,lp.title,coalesce(lp.description,vp.description) description,vp.cover_url,vp.cbc_subject,vp.cbc_grade,vp.language,vp.chapter_count,vp.total_reads,vp.published_at,o.id offer_id,o.offer_key,o.pricing_model,o.amount_kes,o.access_days,o.preview_policy,o.terms_version,
      case when coalesce(vp.pricing->>'type','free') in ('free','donation') then true when coalesce(vp.pricing->>'type','free')='freemium' and jsonb_typeof(vp.pricing->'freeChapters')='number' and (vp.pricing->>'freeChapters')::integer>0 then true else false end sample_available,
      case when coalesce(vp.pricing->>'type','free')='freemium' and jsonb_typeof(vp.pricing->'freeChapters')='number' then greatest(0,(vp.pricing->>'freeChapters')::integer) when coalesce(vp.pricing->>'type','free') in ('free','donation') then vp.chapter_count else 0 end sample_chapters,
      row_number() over(partition by lp.id order by o.amount_kes asc,o.created_at asc) offer_rank
    from public.learning_products lp join public.learning_product_items lpi on lpi.product_id=lp.id join public.learning_resources lr on lr.id=lpi.learning_resource_id and lr.source_type='publication' and lr.publication_id is not null join public.vibe_publications vp on vp.id=lr.publication_id and vp.status='published' and vp.format='vibetextbook' and public.post_secondary_publication_visible(vp.id) join public.learning_product_offers o on o.product_id=lp.id and o.status='active' and o.pricing_model='one_time' and o.amount_kes is not null and o.amount_kes>0 and (o.starts_at is null or o.starts_at<=now()) and (o.ends_at is null or o.ends_at>now())
    where lp.status='active' and lp.rights_status='cleared' and (p_subject is null or lower(coalesce(vp.cbc_subject,''))=lower(btrim(p_subject))) and (p_grade is null or lower(coalesce(vp.cbc_grade,''))=lower(btrim(p_grade)))
  ), limited as (select * from candidates where offer_rank=1 order by published_at desc nulls last,title limit least(greatest(coalesce(p_limit,40),1),100))
  select jsonb_build_object('ok',true,'items',coalesce(jsonb_agg(jsonb_build_object('product_id',product_id,'publication_id',publication_id,'sku',sku,'product_type',product_type,'title',title,'description',description,'cover_url',cover_url,'subject',cbc_subject,'grade',cbc_grade,'language',language,'chapter_count',chapter_count,'total_reads',coalesce(total_reads,0),'offer',jsonb_build_object('id',offer_id,'offer_key',offer_key,'pricing_model',pricing_model,'amount_kes',amount_kes,'access_days',access_days,'terms_version',terms_version),'sample_available',sample_available,'sample_chapters',sample_chapters) order by published_at desc nulls last,title),'[]'::jsonb)) from limited;
$function$;

-- get_continue_reading
CREATE OR REPLACE FUNCTION public.get_continue_reading(limit_input integer DEFAULT 10)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_viewer_id uuid := auth.uid();
  v_limit     integer;
  v_result    jsonb;
begin
  if v_viewer_id is null then
    return jsonb_build_object('ok', true, 'items', '[]'::jsonb);
  end if;

  v_limit := greatest(1, least(50, coalesce(limit_input, 10)));

  with latest_progress as (
    select distinct on (rp.publication_id)
      rp.publication_id,
      rp.chapter_id,
      rp.progress_percent,
      rp.last_read_at,
      rp.completed_at
    from public.vibe_reading_progress rp
    where rp.viewer_id = v_viewer_id
    order by rp.publication_id, rp.last_read_at desc
  ),
  chapter_counts as (
    select
      c.publication_id,
      count(*) filter (where c.status in ('published', 'locked')) as total_chapters
    from public.vibe_chapters c
    group by c.publication_id
  ),
  completed_counts as (
    select
      rp.publication_id,
      count(*) filter (where rp.completed_at is not null) as completed_chapters
    from public.vibe_reading_progress rp
    where rp.viewer_id = v_viewer_id
    group by rp.publication_id
  ),
  ranked as (
    select
      p.id as publication_id,
      p.title,
      p.cover_url,
      p.cbc_subject,
      p.cbc_grade,
      lp.chapter_id as current_chapter_id,
      ch.number as current_chapter_number,
      ch.title as current_chapter_title,
      lp.progress_percent,
      lp.last_read_at,
      (
        coalesce(cc.completed_chapters, 0) > 0
        and coalesce(cc.completed_chapters, 0) >= coalesce(chc.total_chapters, 0)
      ) as completed
    from latest_progress lp
    join public.vibe_publications p on p.id = lp.publication_id
    join public.vibe_chapters ch on ch.id = lp.chapter_id
    left join chapter_counts chc on chc.publication_id = lp.publication_id
    left join completed_counts cc on cc.publication_id = lp.publication_id
    where p.status = 'published'
      and public.post_secondary_publication_visible(p.id)
      and p.format = 'vibetextbook'
      and (
        coalesce(p.pricing->>'type', 'free') in ('free', 'donation')
        or (
          coalesce(p.pricing->>'type', 'free') = 'freemium'
          and ch.number <= greatest(
            0,
            case
              when jsonb_typeof(p.pricing->'freeChapters') = 'number'
              then (p.pricing->>'freeChapters')::integer
              else 0
            end
          )
        )
        or p.author_id = v_viewer_id
      )
    order by lp.last_read_at desc
    limit v_limit
  )
  select coalesce(
    jsonb_agg(to_jsonb(ranked.*) order by ranked.last_read_at desc),
    '[]'::jsonb
  )
  into v_result
  from ranked;

  return jsonb_build_object('ok', true, 'items', v_result);
end;
$function$;

-- get_my_assigned_reading
CREATE OR REPLACE FUNCTION public.get_my_assigned_reading()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
with viewer as (
  select auth.uid() as viewer_id
), learner as (
  select s.id as student_id
  from public.students s, viewer v
  where s.profile_id = v.viewer_id
    and s.deleted_at is null
  limit 1
), items as (
  select
    a.id,
    a.class_id,
    c.name as class_name,
    c.stream as class_stream,
    a.publication_id,
    vp.title as publication_title,
    vp.cover_url,
    vp.cbc_subject,
    vp.cbc_grade,
    a.chapter_id,
    vc.number as chapter_number,
    vc.title as chapter_title,
    a.assigned_at,
    a.due_at,
    coalesce(rp.progress_percent, 0) as progress_percent,
    rp.started_at,
    rp.last_read_at,
    rp.completed_at,
    case
      when rp.completed_at is not null or coalesce(rp.progress_percent, 0) >= 100 then 'completed'
      when coalesce(rp.progress_percent, 0) > 0 then 'reading'
      else 'not_started'
    end as reading_status,
    case
      when rp.completed_at is not null or coalesce(rp.progress_percent, 0) >= 100 then 'completed'
      when a.due_at is null then 'no_due_date'
      when a.due_at < now() then 'overdue'
      when a.due_at::date = current_date then 'due_today'
      else 'upcoming'
    end as due_status,
    '/read/textbook/' || a.publication_id::text || '?chapter=' || a.chapter_id::text as reader_url
  from public.vibe_chapter_assignments a
  join learner l on true
  join public.student_classes sc
    on sc.class_id = a.class_id
   and sc.school_id = a.school_id
   and sc.student_id = l.student_id
   and sc.is_current = true
   and sc.left_at is null
  join public.classes c on c.id = a.class_id
  join public.vibe_publications vp
    on vp.id = a.publication_id
   and vp.status = 'published'
   and vp.format = 'vibetextbook'
   and public.post_secondary_publication_visible(vp.id)
  join public.vibe_chapters vc
    on vc.id = a.chapter_id
   and vc.publication_id = a.publication_id
   and vc.status = 'published'
  left join viewer v on true
  left join public.vibe_reading_progress rp
    on rp.viewer_id = v.viewer_id
   and rp.publication_id = a.publication_id
   and rp.chapter_id = a.chapter_id
  where a.status = 'assigned'
)
select jsonb_build_object(
  'ok', auth.uid() is not null,
  'reason', case when auth.uid() is null then 'auth_required' else null end,
  'items', coalesce(jsonb_agg(to_jsonb(items.*) order by items.due_at nulls last, items.assigned_at desc), '[]'::jsonb)
)
from items;
$function$;

-- get_my_cpa_paper_catalogue
CREATE OR REPLACE FUNCTION public.get_my_cpa_paper_catalogue()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user uuid := (select auth.uid());
  v_course public.courses%rowtype;
  v_papers jsonb;
begin
  if not public.post_secondary_public_enabled() then
    raise exception 'Learning access unavailable' using errcode = '42501';
  end if;
  if v_user is null or not exists (
    select 1 from public.learner_education_paths p
    where p.user_id = v_user
      and p.education_stage = 'post_secondary'
      and p.programme_family = 'professional_studies'
      and p.qualification_code = 'CPA'
      and p.examining_body = 'KASNEB'
  ) then
    raise exception 'CPA learner access denied' using errcode = '42501';
  end if;

  select * into v_course from public.courses
  where slug = 'kasneb-cpa' and qualification_code = 'CPA'
    and qualifying_body = 'KASNEB';
  if not found then
    raise exception 'CPA catalogue unavailable' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'slug', m.slug,
    'title', m.title,
    'qualification_level', m.qualification_level,
    'qualification_requirement', m.qualification_requirement,
    'sequence_number', m.sequence_number,
    'has_published_lessons', (
      v_course.status = 'live' and exists (
        select 1 from public.topics t where t.module_id=m.id
        and t.content_status='published'
      )
    )
  ) order by m.sequence_number), '[]'::jsonb)
  into v_papers
  from public.modules m
  where m.course_id = v_course.id;

  return jsonb_build_object(
    'status', v_course.status,
    'papers', v_papers
  );
end;
$function$;

-- get_my_library
CREATE OR REPLACE FUNCTION public.get_my_library()
 RETURNS TABLE(publication_id uuid, cover_url text, title text, cbc_grade text, cbc_subject text, saved_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select
    publication.id,
    publication.cover_url,
    publication.title,
    publication.cbc_grade,
    publication.cbc_subject,
    workspace.created_at
  from public.vibe_workspace_items workspace
  join public.vibe_publications publication
    on publication.id = workspace.publication_id
  where workspace.viewer_id = auth.uid()
    and workspace.item_type = 'publication_save'
    and publication.status = 'published'
    and public.post_secondary_publication_visible(publication.id)
  order by workspace.created_at desc;
$function$;

-- get_public_quiz_questions
CREATE OR REPLACE FUNCTION public.get_public_quiz_questions(p_topic_id uuid)
 RETURNS TABLE(id uuid, question_text text, options jsonb, explanation text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  return query
  select q.id, q.question_text,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', option_row.option->>'id',
        'label', option_row.option->>'label',
        'text', option_row.option->>'text'
      ) order by option_row.ordinality)
      from jsonb_array_elements(q.options) with ordinality as option_row(option, ordinality)
    ), '[]'::jsonb), null::text
  from public.quiz_questions q
  join public.topics t on t.id = q.topic_id
  join public.modules m on m.id = t.module_id
  join public.courses c on c.id = m.course_id
  where public.post_secondary_public_enabled() and q.topic_id = p_topic_id
    and t.content_status = 'published'
    and c.status = 'live'
  order by q.created_at, q.id;
end;
$function$;

-- get_public_vibetextbook_reader
CREATE OR REPLACE FUNCTION public.get_public_vibetextbook_reader(publication_id_input uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_publication public.vibe_publications%rowtype; v_publication_payload jsonb; v_chapters jsonb;
begin
  select * into v_publication from public.vibe_publications where id=publication_id_input and format='vibetextbook' and status='published' and public.post_secondary_publication_visible(id); if not found then return jsonb_build_object('ok',false,'reason','not_found'); end if;
  v_publication_payload:=jsonb_build_object('id',v_publication.id,'format',v_publication.format,'title',v_publication.title,'subtitle',v_publication.subtitle,'cover_url',v_publication.cover_url,'description',v_publication.description,'genre',v_publication.genre,'tags',v_publication.tags,'language',v_publication.language,'status',v_publication.status,'pricing',v_publication.pricing,'chapter_count',v_publication.chapter_count,'total_reads',v_publication.total_reads,'total_vibes',v_publication.total_vibes,'cbc_subject',v_publication.cbc_subject,'cbc_grade',v_publication.cbc_grade,'cbc_aligned',v_publication.cbc_aligned,'curriculum_framework',v_publication.curriculum_framework,'series_name',v_publication.series_name,'series_number',v_publication.series_number,'publication_name',v_publication.publication_name,'issue_number',v_publication.issue_number,'created_at',v_publication.created_at,'updated_at',v_publication.updated_at,'published_at',v_publication.published_at);
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'publication_id',c.publication_id,'title',c.title,'number',c.number,'status',c.status,'word_count',c.word_count,'reading_time_min',c.reading_time_min,'published_at',c.published_at,'created_at',c.created_at,'updated_at',c.updated_at,'cbc_strand',c.cbc_strand,'can_read',public.can_viewer_read_chapter(c.id,null),'is_bookmarked',false,'progress_percent',0,'completed_at',null,'last_read_at',null,'curriculum',jsonb_build_object('framework',v_publication.curriculum_framework,'grade',v_publication.cbc_grade,'subject',v_publication.cbc_subject,'strand',c.cbc_strand,'sub_strand',null,'topic',null,'term',null,'week',null,'learning_outcomes',coalesce(c.learning_outcomes,'{}'),'key_inquiry_questions','{}','suggested_experiences','{}','core_competencies','{}','core_values','{}','source_ref',null,'alignment_status',c.alignment_status,'authority',case c.alignment_status when 'verified' then 'official' when 'creator_claimed' then 'publisher' when 'pending_review' then 'publisher' else null end,'verified_by',null,'verified_at',c.verified_at,'has_curriculum_detail',(c.cbc_strand is not null or coalesce(array_length(c.learning_outcomes,1),0)>0)),'blocks',case when public.can_viewer_read_chapter(c.id,null) then case when jsonb_typeof(c.blocks)='array' then c.blocks else '[]'::jsonb end else null end) order by c.number),'[]'::jsonb) into v_chapters from public.vibe_chapters c where c.publication_id=v_publication.id and c.status in ('published','locked');
  return jsonb_build_object('ok',true,'reason',null,'viewer_is_author',false,'author_name','Vibeschool Publisher','publication',v_publication_payload,'chapters',v_chapters,'resume',null);
end;$function$;

-- get_saved_publications
CREATE OR REPLACE FUNCTION public.get_saved_publications(limit_input integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_viewer_id uuid := auth.uid();
  v_limit integer;
  v_result jsonb;
begin
  if v_viewer_id is null then
    return jsonb_build_object('ok', true, 'items', '[]'::jsonb);
  end if;

  v_limit := greatest(1, least(50, coalesce(limit_input, 20)));

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'publication_id', p.id,
        'title', p.title,
        'cover_url', p.cover_url,
        'cbc_subject', p.cbc_subject,
        'cbc_grade', p.cbc_grade,
        'format', p.format,
        'saved_at', si.created_at
      )
      order by si.created_at desc
    ),
    '[]'::jsonb
  )
  into v_result
  from (
    select vsi.publication_id, vsi.created_at
    from public.vibe_saved_items vsi
    where vsi.viewer_id = v_viewer_id
      and vsi.chapter_id is null
    order by vsi.created_at desc
    limit v_limit
  ) si
  join public.vibe_publications p on p.id = si.publication_id
  where (p.status = 'published' or p.author_id = v_viewer_id) and public.post_secondary_publication_visible(p.id);

  return jsonb_build_object('ok', true, 'items', v_result);
end;
$function$;

-- record_reading_progress
CREATE OR REPLACE FUNCTION public.record_reading_progress(publication_id_input uuid, chapter_id_input uuid, progress_percent_input integer, position_input jsonb DEFAULT NULL::jsonb, reset_input boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_viewer_id uuid := auth.uid();
  v_chapter public.vibe_chapters%rowtype;
  v_publication public.vibe_publications%rowtype;
  v_viewer_is_author boolean := false;
  v_pricing_type text;
  v_free_chapter_count integer := 0;
  v_can_read boolean := false;
  v_clamped_percent integer;
  v_existing_percent integer;
  v_new_percent integer;
  v_completion_threshold constant integer := 90;
  v_result public.vibe_reading_progress%rowtype;
begin
  if v_viewer_id is null then
    return jsonb_build_object('ok', false, 'reason', 'auth_required');
  end if;
  if publication_id_input is null or chapter_id_input is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_input');
  end if;
  if progress_percent_input is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_progress');
  end if;

  v_clamped_percent := greatest(0, least(100, progress_percent_input));

  select * into v_chapter from public.vibe_chapters where id = chapter_id_input;
  if not found then return jsonb_build_object('ok', false, 'reason', 'chapter_not_found'); end if;
  if v_chapter.publication_id <> publication_id_input then
    return jsonb_build_object('ok', false, 'reason', 'chapter_publication_mismatch');
  end if;

  select * into v_publication from public.vibe_publications where id = publication_id_input and public.post_secondary_publication_visible(id);
  if not found then return jsonb_build_object('ok', false, 'reason', 'publication_not_found'); end if;

  v_viewer_is_author := v_viewer_id = v_publication.author_id;
  if v_publication.status <> 'published' and not v_viewer_is_author then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  v_pricing_type := coalesce(v_publication.pricing->>'type', 'free');
  v_free_chapter_count := case
    when jsonb_typeof(v_publication.pricing->'freeChapters') = 'number'
    then greatest(0, (v_publication.pricing->>'freeChapters')::integer)
    else 0 end;

  v_can_read := v_viewer_is_author
    or (v_pricing_type in ('free', 'donation') and v_chapter.status in ('published', 'locked'))
    or (v_pricing_type = 'freemium' and v_chapter.status in ('published', 'locked') and v_chapter.number <= v_free_chapter_count);

  if not v_can_read then return jsonb_build_object('ok', false, 'reason', 'not_entitled'); end if;

  select progress_percent into v_existing_percent
  from public.vibe_reading_progress
  where viewer_id = v_viewer_id and publication_id = publication_id_input and chapter_id = chapter_id_input;

  if reset_input then v_new_percent := v_clamped_percent;
  else v_new_percent := greatest(coalesce(v_existing_percent, 0), v_clamped_percent);
  end if;

  insert into public.vibe_reading_progress as vrp(
    viewer_id, publication_id, chapter_id, progress_percent, reading_position,
    started_at, last_read_at, completed_at, updated_at
  ) values(
    v_viewer_id, publication_id_input, chapter_id_input, v_new_percent, position_input,
    now(), now(), case when v_new_percent >= v_completion_threshold then now() else null end, now()
  )
  on conflict(viewer_id, publication_id, chapter_id) do update set
    progress_percent = v_new_percent,
    reading_position = coalesce(position_input, vrp.reading_position),
    last_read_at = now(),
    completed_at = case
      when v_new_percent >= v_completion_threshold then coalesce(vrp.completed_at, now())
      when reset_input then null
      else vrp.completed_at end,
    updated_at = now()
  returning * into v_result;

  return jsonb_build_object('ok', true, 'progress_percent', v_result.progress_percent,
    'completed_at', v_result.completed_at, 'last_read_at', v_result.last_read_at);
end;
$function$;

-- record_story_reading_progress
CREATE OR REPLACE FUNCTION public.record_story_reading_progress(publication_id_input uuid, chapter_id_input uuid, progress_percent_input integer, position_input jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_viewer uuid := auth.uid();
  v_publication public.vibe_publications%rowtype;
  v_chapter public.vibe_chapters%rowtype;
  v_input_percent integer;
  v_old_percent integer;
  v_new_percent integer;
  v_old_position jsonb;
  v_new_position jsonb;
  v_block_id text;
  v_final_block text;
begin
  if v_viewer is null then
    return jsonb_build_object('ok',false,'reason','auth_required');
  end if;
  if publication_id_input is null or chapter_id_input is null
      or progress_percent_input is null or progress_percent_input not between 0 and 100
      or jsonb_typeof(position_input) is distinct from 'object' then
    return jsonb_build_object('ok',false,'reason','invalid_input');
  end if;
  v_input_percent := progress_percent_input;
  v_block_id := nullif(btrim(position_input->>'block_id'),'');
  if v_block_id is null
      or jsonb_typeof(position_input->'scroll_percent') is distinct from 'number'
      or (position_input->>'scroll_percent')::numeric <> v_input_percent then
    return jsonb_build_object('ok',false,'reason','invalid_position');
  end if;

  select * into v_publication from public.vibe_publications
    where id=publication_id_input and status='published' and public.post_secondary_publication_visible(id);
  if not found
      or v_publication.format not in ('ebook','vibechronicles')
      or not (v_publication.format='vibechronicles'
         or coalesce(nullif(btrim(v_publication.series_name),''),'') <> ''
         or lower(coalesce(v_publication.genre,'')) in ('fiction','children','romance','thriller','fantasy','mystery','adventure')
         or (
           v_publication.format='ebook'
           and lower(coalesce(v_publication.genre,''))='self_help'
           and btrim(coalesce(v_publication.publication_name,''))='VibeSchool Originals'
           and 'VibeSchool Originals'=any(coalesce(v_publication.tags,ARRAY[]::text[]))
           and not coalesce(v_publication.cbc_aligned,false)
         ))
      or coalesce(v_publication.pricing->>'type','') <> 'free' then
    return jsonb_build_object('ok',false,'reason','not_entitled');
  end if;

  select * into v_chapter from public.vibe_chapters
    where id=chapter_id_input and publication_id=publication_id_input and status='published';
  if not found then
    return jsonb_build_object('ok',false,'reason','chapter_not_found');
  end if;
  if not exists (
    select 1 from jsonb_array_elements(
      case when jsonb_typeof(v_chapter.blocks)='array' then v_chapter.blocks else '[]'::jsonb end
    ) b where b->>'id'=v_block_id
  ) then
    return jsonb_build_object('ok',false,'reason','block_not_found');
  end if;
  if v_input_percent>=90 then
    select b->>'id' into v_final_block
    from jsonb_array_elements(
      case when jsonb_typeof(v_chapter.blocks)='array' then v_chapter.blocks else '[]'::jsonb end
    ) with ordinality x(b,ord)
    where nullif(b->>'id','') is not null
    order by ord desc limit 1;
    if v_final_block is distinct from v_block_id then
      return jsonb_build_object('ok',false,'reason','completion_evidence_required');
    end if;
  end if;

  select progress_percent,reading_position into v_old_percent,v_old_position
    from public.vibe_reading_progress
    where viewer_id=v_viewer and publication_id=publication_id_input and chapter_id=chapter_id_input;
  v_new_percent := greatest(coalesce(v_old_percent,0),v_input_percent);
  -- The progress bar keeps the furthest point; Resume always uses the latest paragraph,
  -- including when a reader intentionally revisits an earlier part of the chapter.
  v_new_position := position_input;

  insert into public.vibe_reading_progress as rp (
    viewer_id,publication_id,chapter_id,progress_percent,reading_position,
    started_at,last_read_at,completed_at,updated_at
  ) values (
    v_viewer,publication_id_input,chapter_id_input,v_new_percent,v_new_position,
    now(),now(),case when v_new_percent>=90 then now() else null end,now()
  )
  on conflict (viewer_id,publication_id,chapter_id) do update set
    progress_percent=v_new_percent,
    reading_position=v_new_position,
    last_read_at=now(),
    completed_at=case when v_new_percent>=90 then coalesce(rp.completed_at,now()) else rp.completed_at end,
    updated_at=now();

  return jsonb_build_object('ok',true,'progress_percent',v_new_percent);
end;
$function$;

-- student_get_vibelearn_workstation
CREATE OR REPLACE FUNCTION public.student_get_vibelearn_workstation()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_student_id uuid;
  v_class_id uuid;
  v_class_name text;
  v_subjects jsonb;
  v_continue jsonb;
  v_practice jsonb;
  v_assigned jsonb;
  v_twin jsonb := '{}'::jsonb;
  v_twin_summary jsonb := '{}'::jsonb;
  v_now jsonb;
  v_learning jsonb := '{}'::jsonb;
  v_adaptation jsonb := '{}'::jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select s.id, coalesce(sc.class_id, s.class_id), c.name
  into v_student_id, v_class_id, v_class_name
  from public.students s
  left join public.student_classes sc on sc.student_id = s.id and sc.is_current = true
  left join public.classes c on c.id = coalesce(sc.class_id, s.class_id)
  where s.profile_id = v_user_id and s.deleted_at is null
  order by sc.joined_at desc nulls last
  limit 1;

  if v_student_id is null then raise exception 'Student profile not found'; end if;

  select coalesce(jsonb_agg(row_to_json(q)::jsonb order by q.name), '[]'::jsonb)
  into v_subjects
  from (
    select distinct subj.id, subj.name,
      (select count(*)::int from public.vibelearn_content vc where vc.status = 'published' and vc.subject_id = subj.id) as resource_count
    from public.subjects subj
    where exists (select 1 from public.teacher_classes tc where tc.class_id = v_class_id and tc.subject_id = subj.id)
       or exists (select 1 from public.vibelearn_content vc where vc.status = 'published' and vc.subject_id = subj.id)
  ) q;

  select coalesce(jsonb_agg(jsonb_build_object(
    'publication_id', rp.publication_id,
    'chapter_id', rp.chapter_id,
    'title', p.title,
    'chapter_title', ch.title,
    'progress_percent', rp.progress_percent,
    'last_read_at', rp.last_read_at,
    'action_url', '/read/textbook/' || rp.publication_id::text
  ) order by rp.last_read_at desc), '[]'::jsonb)
  into v_continue
  from public.vibe_reading_progress rp
  join public.vibe_publications p on p.id = rp.publication_id and p.status = 'published' and public.post_secondary_publication_visible(p.id)
  left join public.vibe_chapters ch on ch.id = rp.chapter_id
  where rp.viewer_id = v_user_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'subject', q.subject,
    'question_count', q.question_count,
    'action_url', '/student/vibelearn/practice?subject=' || lower(replace(q.subject,' ','-'))
  ) order by q.question_count desc), '[]'::jsonb)
  into v_practice
  from (
    select subject::text as subject, count(*)::int as question_count
    from public.exam_question_bank
    where status = 'published'
    group by subject
    order by count(*) desc
    limit 8
  ) q;

  select coalesce(jsonb_agg(jsonb_build_object(
    'assignment_id', aa.id,
    'title', ad.title,
    'assessment_type', ad.assessment_type,
    'subject_id', ad.subject_id,
    'subject_name', subj.name,
    'closes_at', aa.closes_at,
    'action_url', '/student/assessment/' || aa.id::text
  ) order by aa.closes_at asc nulls last), '[]'::jsonb)
  into v_assigned
  from public.assessment_assignments aa
  join public.assessment_definitions ad on ad.id = aa.assessment_id
  left join public.subjects subj on subj.id = ad.subject_id
  where aa.class_id = v_class_id
    and aa.status = 'published'
    and (aa.opens_at is null or aa.opens_at <= now())
    and (aa.closes_at is null or aa.closes_at >= now());

  begin
    v_twin := coalesce(public.student_get_twin_brain(), '{}'::jsonb);
  exception when others then
    v_twin := '{}'::jsonb;
  end;

  v_now := v_twin #> '{decision,now}';
  v_learning := coalesce(v_twin->'learning', '{}'::jsonb);
  v_adaptation := coalesce(v_twin->'adaptation', '{}'::jsonb);

  v_twin_summary := jsonb_build_object(
    'available', v_twin <> '{}'::jsonb,
    'confidence', coalesce((v_twin->>'confidence')::numeric, 0),
    'now', coalesce(v_now, 'null'::jsonb),
    'next', coalesce(v_twin #> '{decision,next}', '[]'::jsonb),
    'mastery', jsonb_build_object(
      'outcome_count', coalesce(jsonb_array_length(coalesce(v_twin #> '{mastery,outcomes}', '[]'::jsonb)), 0),
      'average_effective_mastery', v_twin #> '{prediction,average_effective_mastery}',
      'average_forgetting_risk', coalesce(v_twin #> '{prediction,average_forgetting_risk}', '0'::jsonb)
    ),
    'evidence', jsonb_build_object(
      'competency_evidence_count', coalesce(v_twin #> '{evidence,competency_evidence_count}', '0'::jsonb),
      'learning_event_count', coalesce(v_twin #> '{evidence,learning_event_count}', '0'::jsonb),
      'task_receipt_count', coalesce(v_twin #> '{evidence,task_receipt_count}', '0'::jsonb),
      'verified_calibration_count', coalesce(v_twin #> '{evidence,verified_calibration_count}', '0'::jsonb)
    ),
    'learning', jsonb_build_object(
      'policy', v_learning->'policy',
      'unresolved_exposures', coalesce(v_learning->'unresolved_exposures', '0'::jsonb),
      'learned_interventions', coalesce(v_learning->'learned_interventions', '[]'::jsonb)
    ),
    'adaptation', jsonb_build_object(
      'policy_version', coalesce(v_adaptation->'policy_version', '0'::jsonb),
      'strategy', v_adaptation #> '{decision,strategy}',
      'difficulty', v_adaptation #> '{decision,difficulty}',
      'reason', v_adaptation #> '{decision,reason}'
    ),
    'guardrails', jsonb_build_object(
      'uses_verified_evidence', true,
      'must_abstain_when_evidence_is_insufficient', true,
      'teacher_authority_first', true,
      'twin_does_not_create_marks_or_verified_completion', true
    )
  );

  return jsonb_build_object(
    'student_id', v_student_id,
    'class_id', v_class_id,
    'class_name', v_class_name,
    'subjects', v_subjects,
    'continue_learning', v_continue,
    'practice_by_subject', v_practice,
    'assigned_assessments', v_assigned,
    'twin', v_twin_summary,
    'tutor_policy', jsonb_build_object(
      'default_mode', 'off',
      'allowed_actions', jsonb_build_array('hint','explain_simply','show_example','explain_mistake','translate','read_aloud'),
      'blocked_in_timed_assessment', true,
      'answer_reveal_requires_escalation', true,
      'ai_share_target_percent', 10
    )
  );
end;
$function$;

-- submit_quiz_answer
CREATE OR REPLACE FUNCTION public.submit_quiz_answer(p_question_id uuid, p_option_id text)
 RETURNS TABLE(is_correct boolean, explanation text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  return query
  select q.correct_option_id = p_option_id, q.explanation
  from public.quiz_questions q
  join public.topics t on t.id = q.topic_id
  join public.modules m on m.id = t.module_id
  join public.courses c on c.id = m.course_id
  where public.post_secondary_public_enabled() and q.id = p_question_id
    and t.content_status = 'published'
    and c.status = 'live'
    and exists (
      select 1 from jsonb_array_elements(q.options) opt
      where opt->>'id' = p_option_id
    );
end;
$function$;

-- toggle_publication_save
CREATE OR REPLACE FUNCTION public.toggle_publication_save(p_publication_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_viewer_id uuid := auth.uid();
  v_publication public.vibe_publications%rowtype;
  v_deleted_count integer;
begin
  if v_viewer_id is null then
    return jsonb_build_object(
      'ok', false,
      'reason', 'auth_required',
      'saved', false
    );
  end if;

  select *
  into v_publication
  from public.vibe_publications
  where id = p_publication_id and public.post_secondary_publication_visible(id);

  if not found then
    return jsonb_build_object(
      'ok', false,
      'reason', 'publication_not_found',
      'saved', false
    );
  end if;

  if v_publication.status <> 'published' then
    return jsonb_build_object(
      'ok', false,
      'reason', 'not_entitled',
      'saved', false
    );
  end if;

  -- READ-005B saves the publication itself rather than chapter content.
  -- A published publication is saveable. Chapter-level entitlement remains
  -- enforced by get_vibetextbook_reader and record_reading_progress.
  delete from public.vibe_workspace_items
  where viewer_id = v_viewer_id
    and publication_id = p_publication_id
    and item_type = 'publication_save';

  get diagnostics v_deleted_count = row_count;

  if v_deleted_count > 0 then
    return jsonb_build_object(
      'ok', true,
      'reason', null,
      'saved', false,
      'publication_id', p_publication_id
    );
  end if;

  insert into public.vibe_workspace_items (
    viewer_id,
    item_type,
    publication_id,
    chapter_id,
    payload
  )
  values (
    v_viewer_id,
    'publication_save',
    p_publication_id,
    null,
    '{}'::jsonb
  )
  on conflict (
    viewer_id,
    publication_id
  )
  where item_type = 'publication_save'
  do nothing;

  return jsonb_build_object(
    'ok', true,
    'reason', null,
    'saved', true,
    'publication_id', p_publication_id
  );
end;
$function$;

-- toggle_saved_publication
CREATE OR REPLACE FUNCTION public.toggle_saved_publication(publication_id_input uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_viewer_id uuid := auth.uid();
  v_publication public.vibe_publications%rowtype;
  v_existing_id uuid;
begin
  if v_viewer_id is null then
    return jsonb_build_object('ok', false, 'reason', 'auth_required');
  end if;

  if publication_id_input is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_input');
  end if;

  select * into v_publication
  from public.vibe_publications
  where id = publication_id_input and public.post_secondary_publication_visible(id);

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'publication_not_found');
  end if;

  -- Same visibility rule as the reader: published, or the author viewing
  -- their own draft/archived work.
  if v_publication.status <> 'published'
     and v_publication.author_id <> v_viewer_id then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  select id into v_existing_id
  from public.vibe_saved_items
  where viewer_id = v_viewer_id
    and publication_id = publication_id_input
    and chapter_id is null;

  if v_existing_id is not null then
    delete from public.vibe_saved_items where id = v_existing_id;
    return jsonb_build_object('ok', true, 'saved', false);
  end if;

  insert into public.vibe_saved_items (viewer_id, publication_id, chapter_id)
  values (v_viewer_id, publication_id_input, null);

  return jsonb_build_object('ok', true, 'saved', true);
end;
$function$;

-- Explicitly mirror the live legacy RPC execution boundary on a fresh reconstruction.
revoke all on function public.get_saved_publications(integer) from public, anon, authenticated, service_role;
grant execute on function public.get_saved_publications(integer) to authenticated, service_role;
revoke all on function public.toggle_saved_publication(uuid) from public, anon, authenticated, service_role;
grant execute on function public.toggle_saved_publication(uuid) to authenticated, service_role;

-- Transactional fail-closed assertions; run before considering the release complete.
do $assert$
begin
  if public.post_secondary_public_enabled() then raise exception 'post-secondary gate must start closed'; end if;
  if public.post_secondary_publication_visible('51f1052d-2f59-46bb-9186-c1a7937d203a') or public.post_secondary_publication_visible('c0b2a83f-d726-4eed-812e-7d79f57497df') then
    raise exception 'CPA originals must be muted';
  end if;
  if not public.post_secondary_publication_visible('00000000-0000-0000-0000-000000000001'::uuid) then
    raise exception 'school textbook discovery must remain available';
  end if;
end $assert$;
