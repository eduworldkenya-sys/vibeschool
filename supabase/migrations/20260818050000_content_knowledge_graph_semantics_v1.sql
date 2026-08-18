begin;

-- VibeSchool Content Knowledge Graph v1
--
-- KICD curriculum authority remains anchored in curriculum_learning_outcomes,
-- curriculum hierarchy, competencies and existing outcome links. This layer
-- adds VibeSchool semantic structure (concepts/skills, aliases, relationships
-- and misconceptions) without relabelling derived editorial knowledge as
-- official curriculum truth.
--
-- Raw graph tables are company-side publishing intelligence. Public and learner
-- surfaces use explicit projections/RPCs instead of direct Data API access.
-- authorization-test: public.curriculum_concepts
-- authorization-test: public.curriculum_concept_aliases
-- authorization-test: public.curriculum_outcome_concepts
-- authorization-test: public.curriculum_concept_relations
-- authorization-test: public.curriculum_misconceptions
-- authorization-test: public.curriculum_misconception_outcomes
-- authorization-test: public.learning_product_concept_links
-- authorization-test: public.learning_product_misconception_links
-- access: service-only public.curriculum_concepts
-- access: service-only public.curriculum_concept_aliases
-- access: service-only public.curriculum_outcome_concepts
-- access: service-only public.curriculum_concept_relations
-- access: service-only public.curriculum_misconceptions
-- access: service-only public.curriculum_misconception_outcomes
-- access: service-only public.learning_product_concept_links
-- access: service-only public.learning_product_misconception_links

create table if not exists public.curriculum_concepts (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete restrict,
  concept_key text not null unique,
  title text not null,
  description text,
  semantic_type text not null default 'concept',
  authority_class text not null default 'editorial_derived',
  source_ref text,
  status text not null default 'draft',
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint curriculum_concepts_key_check check (concept_key ~ '^[a-z0-9][a-z0-9._-]{2,119}$'),
  constraint curriculum_concepts_title_check check (btrim(title) <> ''),
  constraint curriculum_concepts_semantic_type_check check (semantic_type in (
    'concept','skill','procedure','principle','representation','strategy'
  )),
  constraint curriculum_concepts_authority_class_check check (authority_class in (
    'official_term','editorial_derived','research_supported','observed_pattern'
  )),
  constraint curriculum_concepts_status_check check (status in ('draft','active','retired')),
  constraint curriculum_concepts_active_verified_check check (
    status <> 'active'
    or (
      verified_by is not null
      and verified_at is not null
      and nullif(btrim(coalesce(source_ref,'')),'') is not null
    )
  )
);

create index if not exists curriculum_concepts_subject_status_idx
  on public.curriculum_concepts(subject_id,status,title);

create table if not exists public.curriculum_concept_aliases (
  id uuid primary key default gen_random_uuid(),
  concept_id uuid not null references public.curriculum_concepts(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  locale text not null default 'en-KE',
  alias_type text not null default 'search_term',
  created_at timestamptz not null default now(),
  constraint curriculum_concept_aliases_alias_check check (btrim(alias) <> ''),
  constraint curriculum_concept_aliases_locale_check check (btrim(locale) <> ''),
  constraint curriculum_concept_aliases_type_check check (alias_type in (
    'synonym','abbreviation','search_term','alternate_spelling'
  )),
  unique(concept_id,locale,normalized_alias)
);

create index if not exists curriculum_concept_aliases_normalized_idx
  on public.curriculum_concept_aliases(normalized_alias);

create table if not exists public.curriculum_outcome_concepts (
  outcome_id uuid not null references public.curriculum_learning_outcomes(id) on delete cascade,
  concept_id uuid not null references public.curriculum_concepts(id) on delete cascade,
  relationship text not null default 'supporting',
  relevance_weight numeric(5,4) not null default 1.0 check (relevance_weight > 0 and relevance_weight <= 1),
  authority_class text not null default 'editorial_derived',
  source_ref text,
  status text not null default 'draft',
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(outcome_id,concept_id,relationship),
  constraint curriculum_outcome_concepts_relationship_check check (relationship in (
    'primary','supporting','application','assessment_target'
  )),
  constraint curriculum_outcome_concepts_authority_class_check check (authority_class in (
    'official_derived','editorial_derived','research_supported'
  )),
  constraint curriculum_outcome_concepts_status_check check (status in ('draft','active','retired')),
  constraint curriculum_outcome_concepts_active_verified_check check (
    status <> 'active'
    or (
      verified_by is not null
      and verified_at is not null
      and nullif(btrim(coalesce(source_ref,'')),'') is not null
    )
  )
);

create index if not exists curriculum_outcome_concepts_concept_idx
  on public.curriculum_outcome_concepts(concept_id,status,outcome_id);

create table if not exists public.curriculum_concept_relations (
  from_concept_id uuid not null references public.curriculum_concepts(id) on delete cascade,
  to_concept_id uuid not null references public.curriculum_concepts(id) on delete cascade,
  relation_type text not null,
  strength numeric(5,4) not null default 1.0 check (strength > 0 and strength <= 1),
  source_ref text,
  status text not null default 'draft',
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(from_concept_id,to_concept_id,relation_type),
  constraint curriculum_concept_relations_not_self check (from_concept_id <> to_concept_id),
  constraint curriculum_concept_relations_type_check check (relation_type in (
    'prerequisite','part_of','related','contrasts_with'
  )),
  constraint curriculum_concept_relations_status_check check (status in ('draft','active','retired')),
  constraint curriculum_concept_relations_active_verified_check check (
    status <> 'active'
    or (
      verified_by is not null
      and verified_at is not null
      and nullif(btrim(coalesce(source_ref,'')),'') is not null
    )
  )
);

create index if not exists curriculum_concept_relations_to_idx
  on public.curriculum_concept_relations(to_concept_id,relation_type,status);

create table if not exists public.curriculum_misconceptions (
  id uuid primary key default gen_random_uuid(),
  concept_id uuid not null references public.curriculum_concepts(id) on delete cascade,
  misconception_code text not null unique,
  misconception_text text not null,
  correction_text text not null,
  diagnostic_guidance text,
  authority_class text not null default 'editorial_derived',
  source_ref text,
  status text not null default 'draft',
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint curriculum_misconceptions_code_check check (misconception_code ~ '^[a-z0-9][a-z0-9._-]{2,159}$'),
  constraint curriculum_misconceptions_text_check check (btrim(misconception_text) <> ''),
  constraint curriculum_misconceptions_correction_check check (btrim(correction_text) <> ''),
  constraint curriculum_misconceptions_authority_class_check check (authority_class in (
    'editorial_derived','research_supported','observed_pattern'
  )),
  constraint curriculum_misconceptions_status_check check (status in ('draft','active','retired')),
  constraint curriculum_misconceptions_active_verified_check check (
    status <> 'active'
    or (
      verified_by is not null
      and verified_at is not null
      and nullif(btrim(coalesce(source_ref,'')),'') is not null
    )
  )
);

create index if not exists curriculum_misconceptions_concept_status_idx
  on public.curriculum_misconceptions(concept_id,status);

create table if not exists public.curriculum_misconception_outcomes (
  misconception_id uuid not null references public.curriculum_misconceptions(id) on delete cascade,
  outcome_id uuid not null references public.curriculum_learning_outcomes(id) on delete cascade,
  relationship text not null default 'commonly_observed_in',
  relevance_weight numeric(5,4) not null default 1.0 check (relevance_weight > 0 and relevance_weight <= 1),
  source_ref text,
  status text not null default 'draft',
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(misconception_id,outcome_id,relationship),
  constraint curriculum_misconception_outcomes_relationship_check check (relationship in (
    'may_block','diagnostic_target','commonly_observed_in'
  )),
  constraint curriculum_misconception_outcomes_status_check check (status in ('draft','active','retired')),
  constraint curriculum_misconception_outcomes_active_verified_check check (
    status <> 'active'
    or (
      verified_by is not null
      and verified_at is not null
      and nullif(btrim(coalesce(source_ref,'')),'') is not null
    )
  )
);

create index if not exists curriculum_misconception_outcomes_outcome_idx
  on public.curriculum_misconception_outcomes(outcome_id,status,misconception_id);

create table if not exists public.learning_product_concept_links (
  product_id uuid not null references public.learning_products(id) on delete cascade,
  concept_id uuid not null references public.curriculum_concepts(id) on delete restrict,
  relationship text not null default 'supports',
  coverage_weight numeric(5,4) not null default 1.0 check (coverage_weight > 0 and coverage_weight <= 1),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key(product_id,concept_id,relationship),
  constraint learning_product_concept_links_relationship_check check (relationship in (
    'teaches','supports','practises','assesses','remediates','prerequisite'
  ))
);

create index if not exists learning_product_concept_links_concept_idx
  on public.learning_product_concept_links(concept_id,relationship,product_id);

create table if not exists public.learning_product_misconception_links (
  product_id uuid not null references public.learning_products(id) on delete cascade,
  misconception_id uuid not null references public.curriculum_misconceptions(id) on delete restrict,
  relationship text not null default 'addresses',
  coverage_weight numeric(5,4) not null default 1.0 check (coverage_weight > 0 and coverage_weight <= 1),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key(product_id,misconception_id,relationship),
  constraint learning_product_misconception_links_relationship_check check (relationship in (
    'addresses','diagnoses','remediates'
  ))
);

create index if not exists learning_product_misconception_links_misconception_idx
  on public.learning_product_misconception_links(misconception_id,relationship,product_id);

-- The graph is proprietary publishing intelligence. Browser roles do not get
-- raw table access; explicit projections below expose only what a journey needs.
alter table public.curriculum_concepts enable row level security;
alter table public.curriculum_concept_aliases enable row level security;
alter table public.curriculum_outcome_concepts enable row level security;
alter table public.curriculum_concept_relations enable row level security;
alter table public.curriculum_misconceptions enable row level security;
alter table public.curriculum_misconception_outcomes enable row level security;
alter table public.learning_product_concept_links enable row level security;
alter table public.learning_product_misconception_links enable row level security;

revoke all on table public.curriculum_concepts from public,anon,authenticated;
revoke all on table public.curriculum_concept_aliases from public,anon,authenticated;
revoke all on table public.curriculum_outcome_concepts from public,anon,authenticated;
revoke all on table public.curriculum_concept_relations from public,anon,authenticated;
revoke all on table public.curriculum_misconceptions from public,anon,authenticated;
revoke all on table public.curriculum_misconception_outcomes from public,anon,authenticated;
revoke all on table public.learning_product_concept_links from public,anon,authenticated;
revoke all on table public.learning_product_misconception_links from public,anon,authenticated;

grant all on table public.curriculum_concepts to service_role;
grant all on table public.curriculum_concept_aliases to service_role;
grant all on table public.curriculum_outcome_concepts to service_role;
grant all on table public.curriculum_concept_relations to service_role;
grant all on table public.curriculum_misconceptions to service_role;
grant all on table public.curriculum_misconception_outcomes to service_role;
grant all on table public.learning_product_concept_links to service_role;
grant all on table public.learning_product_misconception_links to service_role;

create or replace function public.curriculum_normalize_semantic_term(p_value text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $function$
  select nullif(
    regexp_replace(
      lower(regexp_replace(btrim(coalesce(p_value,'')), '[^[:alnum:]&+.-]+', ' ', 'g')),
      '[[:space:]]+', ' ', 'g'
    ),
    ''
  );
$function$;

revoke all on function public.curriculum_normalize_semantic_term(text) from public,anon,authenticated;
grant execute on function public.curriculum_normalize_semantic_term(text) to service_role;

create or replace function public.curriculum_prepare_concept_alias()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  new.normalized_alias := public.curriculum_normalize_semantic_term(new.alias);
  if new.normalized_alias is null then
    raise exception 'semantic_alias_empty';
  end if;
  return new;
end;
$function$;

revoke all on function public.curriculum_prepare_concept_alias() from public,anon,authenticated;

drop trigger if exists curriculum_prepare_concept_alias on public.curriculum_concept_aliases;
create trigger curriculum_prepare_concept_alias
before insert or update of alias on public.curriculum_concept_aliases
for each row execute function public.curriculum_prepare_concept_alias();

create or replace function public.curriculum_validate_concept_subject()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if not exists (
    select 1
    from public.subjects s
    where s.id = new.subject_id
      and s.school_id is null
      and exists (
        select 1 from public.curriculum c where c.global_subject_id = s.id
      )
  ) then
    raise exception 'concept_requires_canonical_curriculum_subject';
  end if;
  return new;
end;
$function$;

revoke all on function public.curriculum_validate_concept_subject() from public,anon,authenticated;

drop trigger if exists curriculum_validate_concept_subject on public.curriculum_concepts;
create trigger curriculum_validate_concept_subject
before insert or update of subject_id on public.curriculum_concepts
for each row execute function public.curriculum_validate_concept_subject();

create or replace function public.curriculum_validate_outcome_concept_subject()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_concept_subject uuid;
  v_outcome_subject uuid;
begin
  select subject_id into v_concept_subject
  from public.curriculum_concepts
  where id = new.concept_id;

  select c.global_subject_id into v_outcome_subject
  from public.curriculum_learning_outcomes o
  join public.curriculum c on c.id = o.curriculum_id
  where o.id = new.outcome_id;

  if v_concept_subject is null or v_outcome_subject is null
     or v_concept_subject <> v_outcome_subject then
    raise exception 'outcome_concept_subject_mismatch';
  end if;
  return new;
end;
$function$;

revoke all on function public.curriculum_validate_outcome_concept_subject() from public,anon,authenticated;

drop trigger if exists curriculum_validate_outcome_concept_subject on public.curriculum_outcome_concepts;
create trigger curriculum_validate_outcome_concept_subject
before insert or update of outcome_id,concept_id on public.curriculum_outcome_concepts
for each row execute function public.curriculum_validate_outcome_concept_subject();

create or replace function public.curriculum_validate_misconception_outcome_subject()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_concept_subject uuid;
  v_outcome_subject uuid;
begin
  select c.subject_id into v_concept_subject
  from public.curriculum_misconceptions m
  join public.curriculum_concepts c on c.id = m.concept_id
  where m.id = new.misconception_id;

  select c.global_subject_id into v_outcome_subject
  from public.curriculum_learning_outcomes o
  join public.curriculum c on c.id = o.curriculum_id
  where o.id = new.outcome_id;

  if v_concept_subject is null or v_outcome_subject is null
     or v_concept_subject <> v_outcome_subject then
    raise exception 'misconception_outcome_subject_mismatch';
  end if;
  return new;
end;
$function$;

revoke all on function public.curriculum_validate_misconception_outcome_subject() from public,anon,authenticated;

drop trigger if exists curriculum_validate_misconception_outcome_subject on public.curriculum_misconception_outcomes;
create trigger curriculum_validate_misconception_outcome_subject
before insert or update of misconception_id,outcome_id on public.curriculum_misconception_outcomes
for each row execute function public.curriculum_validate_misconception_outcome_subject();

create or replace function public.curriculum_prevent_concept_prerequisite_cycle()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if new.relation_type <> 'prerequisite' or new.status = 'retired' then
    return new;
  end if;

  if exists (
    with recursive reachable(concept_id) as (
      select r.to_concept_id
      from public.curriculum_concept_relations r
      where r.from_concept_id = new.to_concept_id
        and r.relation_type = 'prerequisite'
        and r.status <> 'retired'
        and not (
          r.from_concept_id = new.from_concept_id
          and r.to_concept_id = new.to_concept_id
          and r.relation_type = new.relation_type
        )
      union
      select r.to_concept_id
      from public.curriculum_concept_relations r
      join reachable x on x.concept_id = r.from_concept_id
      where r.relation_type = 'prerequisite'
        and r.status <> 'retired'
    )
    select 1 from reachable where concept_id = new.from_concept_id
  ) then
    raise exception 'concept_prerequisite_cycle';
  end if;

  return new;
end;
$function$;

revoke all on function public.curriculum_prevent_concept_prerequisite_cycle() from public,anon,authenticated;

drop trigger if exists curriculum_prevent_concept_prerequisite_cycle on public.curriculum_concept_relations;
create trigger curriculum_prevent_concept_prerequisite_cycle
before insert or update of from_concept_id,to_concept_id,relation_type,status
on public.curriculum_concept_relations
for each row execute function public.curriculum_prevent_concept_prerequisite_cycle();

-- Existing outcome prerequisites are valuable but currently allow indirect
-- cycles. Harden the canonical graph rather than creating a competing outcome
-- dependency table.
create or replace function public.curriculum_prevent_outcome_prerequisite_cycle()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if exists (
    with recursive reachable(outcome_id) as (
      select p.prerequisite_outcome_id
      from public.curriculum_outcome_prerequisites p
      where p.outcome_id = new.prerequisite_outcome_id
        and not (
          p.outcome_id = new.outcome_id
          and p.prerequisite_outcome_id = new.prerequisite_outcome_id
        )
      union
      select p.prerequisite_outcome_id
      from public.curriculum_outcome_prerequisites p
      join reachable x on x.outcome_id = p.outcome_id
    )
    select 1 from reachable where outcome_id = new.outcome_id
  ) then
    raise exception 'outcome_prerequisite_cycle';
  end if;
  return new;
end;
$function$;

revoke all on function public.curriculum_prevent_outcome_prerequisite_cycle() from public,anon,authenticated;

drop trigger if exists curriculum_prevent_outcome_prerequisite_cycle on public.curriculum_outcome_prerequisites;
create trigger curriculum_prevent_outcome_prerequisite_cycle
before insert or update of outcome_id,prerequisite_outcome_id
on public.curriculum_outcome_prerequisites
for each row execute function public.curriculum_prevent_outcome_prerequisite_cycle();

create or replace function public.curriculum_touch_semantic_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

revoke all on function public.curriculum_touch_semantic_updated_at() from public,anon,authenticated;

drop trigger if exists curriculum_concepts_touch_updated_at on public.curriculum_concepts;
create trigger curriculum_concepts_touch_updated_at
before update on public.curriculum_concepts
for each row execute function public.curriculum_touch_semantic_updated_at();

drop trigger if exists curriculum_outcome_concepts_touch_updated_at on public.curriculum_outcome_concepts;
create trigger curriculum_outcome_concepts_touch_updated_at
before update on public.curriculum_outcome_concepts
for each row execute function public.curriculum_touch_semantic_updated_at();

drop trigger if exists curriculum_concept_relations_touch_updated_at on public.curriculum_concept_relations;
create trigger curriculum_concept_relations_touch_updated_at
before update on public.curriculum_concept_relations
for each row execute function public.curriculum_touch_semantic_updated_at();

drop trigger if exists curriculum_misconceptions_touch_updated_at on public.curriculum_misconceptions;
create trigger curriculum_misconceptions_touch_updated_at
before update on public.curriculum_misconceptions
for each row execute function public.curriculum_touch_semantic_updated_at();

drop trigger if exists curriculum_misconception_outcomes_touch_updated_at on public.curriculum_misconception_outcomes;
create trigger curriculum_misconception_outcomes_touch_updated_at
before update on public.curriculum_misconception_outcomes
for each row execute function public.curriculum_touch_semantic_updated_at();

-- Deterministic, AI-free concept discovery. Only verified active concepts are
-- projected. Raw aliases, provenance and internal graph edges remain private.
create or replace function public.curriculum_search_concepts(
  p_query text,
  p_subject_id uuid default null,
  p_limit integer default 12
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_query text := public.curriculum_normalize_semantic_term(p_query);
  v_limit integer := least(greatest(coalesce(p_limit,12),1),25);
  v_rows jsonb;
begin
  if v_query is null or length(v_query) < 2 then
    return jsonb_build_object('ok',true,'query',v_query,'results','[]'::jsonb);
  end if;

  with matches as (
    select c.id as concept_id,
           case
             when public.curriculum_normalize_semantic_term(c.title) = v_query then 0
             when public.curriculum_normalize_semantic_term(c.title) like v_query || '%' then 10
             when public.curriculum_normalize_semantic_term(c.title) like '%' || v_query || '%' then 20
             else 100
           end as rank_score
    from public.curriculum_concepts c
    where c.status = 'active'
      and c.verified_at is not null
      and (p_subject_id is null or c.subject_id = p_subject_id)
      and public.curriculum_normalize_semantic_term(c.title) like '%' || v_query || '%'
    union all
    select a.concept_id,
           case
             when a.normalized_alias = v_query then 1
             when a.normalized_alias like v_query || '%' then 11
             else 21
           end
    from public.curriculum_concept_aliases a
    join public.curriculum_concepts c on c.id = a.concept_id
    where c.status = 'active'
      and c.verified_at is not null
      and (p_subject_id is null or c.subject_id = p_subject_id)
      and a.normalized_alias like '%' || v_query || '%'
  ), ranked as (
    select concept_id,min(rank_score) as rank_score
    from matches
    group by concept_id
    order by min(rank_score),concept_id
    limit v_limit
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'concept_id',c.id,
      'concept_key',c.concept_key,
      'title',c.title,
      'semantic_type',c.semantic_type,
      'subject_id',c.subject_id,
      'subject',s.name,
      'match_rank',r.rank_score
    ) order by r.rank_score,c.title
  ),'[]'::jsonb)
  into v_rows
  from ranked r
  join public.curriculum_concepts c on c.id = r.concept_id
  join public.subjects s on s.id = c.subject_id;

  return jsonb_build_object('ok',true,'query',v_query,'results',v_rows);
end;
$function$;

revoke all on function public.curriculum_search_concepts(text,uuid,integer) from public;
grant execute on function public.curriculum_search_concepts(text,uuid,integer) to anon,authenticated,service_role;

-- Outcome context is the bridge between KICD-aligned truth and VibeSchool's
-- semantic enrichment. It never exposes draft semantic claims.
create or replace function public.curriculum_get_outcome_semantic_context(p_outcome_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_outcome jsonb;
  v_concepts jsonb;
  v_misconceptions jsonb;
  v_prerequisites jsonb;
begin
  select jsonb_build_object(
    'outcome_id',o.id,
    'outcome_code',o.outcome_code,
    'outcome_text',o.outcome_text,
    'bloom_level',o.bloom_level,
    'difficulty',o.difficulty,
    'competency_tags',o.competency_tags,
    'source_type',o.source_type,
    'source_ref',o.source_ref,
    'curriculum',c.curriculum,
    'grade',c.grade,
    'subject_id',c.global_subject_id,
    'subject',c.subject,
    'strand',c.strand,
    'sub_strand',c.sub_strand,
    'topic',c.topic,
    'term',c.term,
    'week',c.week
  ) into v_outcome
  from public.curriculum_learning_outcomes o
  join public.curriculum c on c.id = o.curriculum_id
  where o.id = p_outcome_id
    and o.status = 'active';

  if v_outcome is null then
    return jsonb_build_object('ok',false,'reason','outcome_not_active');
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'concept_id',cc.id,
      'concept_key',cc.concept_key,
      'title',cc.title,
      'semantic_type',cc.semantic_type,
      'relationship',oc.relationship,
      'relevance_weight',oc.relevance_weight
    ) order by
      case oc.relationship when 'primary' then 0 when 'supporting' then 1 when 'application' then 2 else 3 end,
      cc.title
  ),'[]'::jsonb)
  into v_concepts
  from public.curriculum_outcome_concepts oc
  join public.curriculum_concepts cc on cc.id = oc.concept_id
  where oc.outcome_id = p_outcome_id
    and oc.status = 'active'
    and oc.verified_at is not null
    and cc.status = 'active'
    and cc.verified_at is not null;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'misconception_id',m.id,
      'misconception_code',m.misconception_code,
      'misconception_text',m.misconception_text,
      'correction_text',m.correction_text,
      'relationship',mo.relationship,
      'relevance_weight',mo.relevance_weight
    ) order by m.misconception_code
  ),'[]'::jsonb)
  into v_misconceptions
  from public.curriculum_misconception_outcomes mo
  join public.curriculum_misconceptions m on m.id = mo.misconception_id
  where mo.outcome_id = p_outcome_id
    and mo.status = 'active'
    and mo.verified_at is not null
    and m.status = 'active'
    and m.verified_at is not null;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'outcome_id',p.prerequisite_outcome_id,
      'outcome_code',po.outcome_code,
      'outcome_text',po.outcome_text,
      'minimum_mastery',p.minimum_mastery
    ) order by po.outcome_code nulls last,po.outcome_text
  ),'[]'::jsonb)
  into v_prerequisites
  from public.curriculum_outcome_prerequisites p
  join public.curriculum_learning_outcomes po on po.id = p.prerequisite_outcome_id
  where p.outcome_id = p_outcome_id
    and po.status = 'active';

  return jsonb_build_object(
    'ok',true,
    'outcome',v_outcome,
    'concepts',v_concepts,
    'misconceptions',v_misconceptions,
    'prerequisites',v_prerequisites
  );
end;
$function$;

revoke all on function public.curriculum_get_outcome_semantic_context(uuid) from public;
grant execute on function public.curriculum_get_outcome_semantic_context(uuid) to anon,authenticated,service_role;

-- Deterministic recommendation bridge. No AI, no inferred weakness from missing
-- data, and no recommendation from a single absent signal. Only recorded mastery
-- evidence may trigger a commercial recommendation.
create or replace function public.student_get_learning_product_recommendations(p_limit integer default 5)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_student_id uuid;
  v_limit integer := least(greatest(coalesce(p_limit,5),1),10);
  v_rows jsonb;
begin
  if v_uid is null then
    raise exception 'authentication_required';
  end if;

  select s.id into v_student_id
  from public.students s
  where s.profile_id = v_uid
    and s.deleted_at is null
  order by s.created_at
  limit 1;

  if v_student_id is null then
    raise exception 'learner_identity_not_found';
  end if;

  with weak_outcomes as (
    select m.outcome_id,
           m.mastery_score,
           m.evidence_count,
           greatest(0,100-coalesce(m.mastery_score,0))::numeric as need_weight
    from public.student_outcome_mastery m
    join public.curriculum_learning_outcomes o on o.id = m.outcome_id
    where m.student_id = v_student_id
      and m.mastery_score is not null
      and m.mastery_score < 70
      and m.evidence_count > 0
      and o.status = 'active'
  ), candidate_paths as (
    select l.product_id,
           w.outcome_id,
           w.evidence_count,
           w.mastery_score,
           w.need_weight * l.coverage_weight *
             case l.relationship
               when 'remediates' then 1.20
               when 'practises' then 1.10
               when 'teaches' then 1.00
               when 'supports' then 0.90
               when 'prerequisite' then 0.85
               when 'assesses' then 0.60
               else 0.50
             end as path_score,
           'outcome'::text as match_type
    from weak_outcomes w
    join public.learning_product_curriculum_links l on l.outcome_id = w.outcome_id

    union all

    select l.product_id,
           w.outcome_id,
           w.evidence_count,
           w.mastery_score,
           w.need_weight * oc.relevance_weight * l.coverage_weight *
             case l.relationship
               when 'remediates' then 1.20
               when 'practises' then 1.10
               when 'teaches' then 1.00
               when 'supports' then 0.90
               when 'prerequisite' then 0.85
               when 'assesses' then 0.60
               else 0.50
             end as path_score,
           'concept'::text as match_type
    from weak_outcomes w
    join public.curriculum_outcome_concepts oc
      on oc.outcome_id = w.outcome_id
     and oc.status = 'active'
     and oc.verified_at is not null
    join public.curriculum_concepts c
      on c.id = oc.concept_id
     and c.status = 'active'
     and c.verified_at is not null
    join public.learning_product_concept_links l on l.concept_id = c.id
  ), qualified as (
    select cp.product_id,
           sum(cp.path_score) as score,
           count(distinct cp.outcome_id) as weak_outcome_count,
           sum(cp.evidence_count) as evidence_count,
           min(cp.mastery_score) as lowest_mastery,
           array_agg(distinct cp.match_type order by cp.match_type) as match_types
    from candidate_paths cp
    group by cp.product_id
  ), saleable as (
    select q.*,
           p.sku,
           p.title,
           p.product_type,
           min(o.amount_kes) as price_kes
    from qualified q
    join public.learning_products p
      on p.id = q.product_id
     and p.status = 'active'
     and p.rights_status = 'cleared'
    join public.learning_product_offers o
      on o.product_id = p.id
     and o.status = 'active'
     and o.pricing_model = 'one_time'
     and o.amount_kes is not null
     and o.amount_kes > 0
     and (o.starts_at is null or o.starts_at <= now())
     and (o.ends_at is null or o.ends_at > now())
    group by q.product_id,q.score,q.weak_outcome_count,q.evidence_count,q.lowest_mastery,q.match_types,p.sku,p.title,p.product_type
    order by q.score desc,q.evidence_count desc,p.title
    limit v_limit
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'product_id',s.product_id,
      'sku',s.sku,
      'title',s.title,
      'product_type',s.product_type,
      'price_kes',s.price_kes,
      'score',round(s.score,2),
      'weak_outcome_count',s.weak_outcome_count,
      'evidence_count',s.evidence_count,
      'lowest_mastery',s.lowest_mastery,
      'match_types',s.match_types,
      'reason_code','recorded_outcome_weakness'
    ) order by s.score desc,s.evidence_count desc,s.title
  ),'[]'::jsonb)
  into v_rows
  from saleable s;

  return jsonb_build_object(
    'ok',true,
    'student_id',v_student_id,
    'evidence_policy',jsonb_build_object(
      'requires_recorded_mastery',true,
      'minimum_evidence_count',1,
      'mastery_threshold',70,
      'missing_data_is_not_weakness',true
    ),
    'recommendations',v_rows
  );
end;
$function$;

revoke all on function public.student_get_learning_product_recommendations(integer) from public,anon;
grant execute on function public.student_get_learning_product_recommendations(integer) to authenticated,service_role;

comment on table public.curriculum_concepts is
'Verified semantic concepts/skills layered over canonical curriculum outcomes. Derived semantics retain explicit provenance and are never implicitly KICD-official.';
comment on table public.curriculum_misconceptions is
'Verified misconception knowledge for diagnosis/remediation. Misconceptions are editorial/research/observed knowledge, not automatic curriculum facts.';
comment on function public.student_get_learning_product_recommendations(integer) is
'Deterministic evidence-to-commerce bridge. Recommends only active rights-cleared one-time Learning Products for outcomes with recorded sub-threshold mastery evidence.';

commit;
