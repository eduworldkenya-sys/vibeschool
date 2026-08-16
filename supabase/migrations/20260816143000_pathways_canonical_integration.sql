-- VibeSchool Pathways canonical integration.
-- Additive only. Reuses public.schools, canonical public.subjects rows and public.students.
-- No production activation or school identity mutation is performed by this migration.

begin;

create table public.pathway_sources (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('official_portal','official_document','institution_verified','professional_body','vibeschool_editorial')),
  source_name text not null,
  source_url text,
  source_reference text,
  observed_at timestamptz not null default now(),
  effective_from date,
  effective_to date,
  status text not null default 'active' check (status in ('active','superseded','withdrawn')),
  is_public boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.pathway_sources enable row level security;
revoke all on table public.pathway_sources from public, anon, authenticated;
grant select on table public.pathway_sources to anon, authenticated;
grant select, insert, update, delete on table public.pathway_sources to service_role;
create policy pathway_sources_public_read on public.pathway_sources for select to anon, authenticated using (is_public and status <> 'withdrawn');
-- authorization-test: public provenance only; all client writes denied.

create table public.pathways (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  official_code text,
  name text not null,
  short_name text,
  plain_language_summary text not null default '',
  status text not null default 'draft' check (status in ('draft','published','superseded','retired')),
  source_id uuid not null references public.pathway_sources(id),
  effective_from date,
  effective_to date,
  version integer not null default 1 check (version > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.pathways enable row level security;
revoke all on table public.pathways from public, anon, authenticated;
grant select on table public.pathways to anon, authenticated;
grant select, insert, update, delete on table public.pathways to service_role;
create policy pathways_public_read on public.pathways for select to anon, authenticated using (status = 'published');

create table public.pathway_tracks (
  id uuid primary key default gen_random_uuid(),
  pathway_id uuid not null references public.pathways(id) on delete cascade,
  slug text not null,
  official_code text,
  name text not null,
  plain_language_summary text not null default '',
  status text not null default 'draft' check (status in ('draft','published','superseded','retired')),
  source_id uuid not null references public.pathway_sources(id),
  effective_from date,
  effective_to date,
  version integer not null default 1 check (version > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(pathway_id, slug, version)
);
alter table public.pathway_tracks enable row level security;
revoke all on table public.pathway_tracks from public, anon, authenticated;
grant select on table public.pathway_tracks to anon, authenticated;
grant select, insert, update, delete on table public.pathway_tracks to service_role;
create policy pathway_tracks_public_read on public.pathway_tracks for select to anon, authenticated using (
  status = 'published' and exists (select 1 from public.pathways p where p.id = pathway_id and p.status = 'published')
);

create table public.pathway_subject_combinations (
  id uuid primary key default gen_random_uuid(),
  pathway_id uuid not null references public.pathways(id),
  track_id uuid references public.pathway_tracks(id),
  official_code text,
  slug text not null,
  display_name text not null,
  status text not null default 'draft' check (status in ('draft','published','superseded','retired')),
  source_id uuid not null references public.pathway_sources(id),
  effective_from date,
  effective_to date,
  version integer not null default 1 check (version > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(pathway_id, slug, version)
);
alter table public.pathway_subject_combinations enable row level security;
revoke all on table public.pathway_subject_combinations from public, anon, authenticated;
grant select on table public.pathway_subject_combinations to anon, authenticated;
grant select, insert, update, delete on table public.pathway_subject_combinations to service_role;
create policy pathway_combinations_public_read on public.pathway_subject_combinations for select to anon, authenticated using (
  status = 'published' and exists (select 1 from public.pathways p where p.id = pathway_id and p.status = 'published')
);

-- Canonical subject identities are the existing public.subjects rows whose
-- global_subject_id is null. The trigger prevents a Pathways national fact from
-- accidentally binding to a school-local subject row.
create table public.pathway_combination_subjects (
  combination_id uuid not null references public.pathway_subject_combinations(id) on delete cascade,
  canonical_subject_id uuid not null references public.subjects(id),
  subject_order smallint not null default 1 check (subject_order > 0),
  requirement_role text not null default 'selected' check (requirement_role in ('selected','core','supporting')),
  source_id uuid not null references public.pathway_sources(id),
  created_at timestamptz not null default now(),
  primary key(combination_id, canonical_subject_id)
);
alter table public.pathway_combination_subjects enable row level security;
revoke all on table public.pathway_combination_subjects from public, anon, authenticated;
grant select on table public.pathway_combination_subjects to anon, authenticated;
grant select, insert, update, delete on table public.pathway_combination_subjects to service_role;
create policy pathway_combination_subjects_public_read on public.pathway_combination_subjects for select to anon, authenticated using (
  exists (select 1 from public.pathway_subject_combinations c where c.id = combination_id and c.status = 'published')
);

create or replace function public.pathways_assert_canonical_subject()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
begin
  if not exists (
    select 1 from public.subjects s
    where s.id = new.canonical_subject_id and s.global_subject_id is null
  ) then
    raise exception 'pathways_subject_must_be_canonical';
  end if;
  return new;
end;
$function$;
revoke all on function public.pathways_assert_canonical_subject() from public, anon, authenticated;
grant execute on function public.pathways_assert_canonical_subject() to service_role;
create trigger pathways_combination_subject_canonical_guard
before insert or update of canonical_subject_id on public.pathway_combination_subjects
for each row execute function public.pathways_assert_canonical_subject();

create table public.pathway_careers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  career_family text,
  plain_language_summary text not null default '',
  status text not null default 'draft' check (status in ('draft','published','superseded','retired')),
  source_id uuid not null references public.pathway_sources(id),
  source_basis text not null default 'guidance' check (source_basis in ('official','professional_requirement','guidance')),
  effective_from date,
  effective_to date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.pathway_careers enable row level security;
revoke all on table public.pathway_careers from public, anon, authenticated;
grant select on table public.pathway_careers to anon, authenticated;
grant select, insert, update, delete on table public.pathway_careers to service_role;
create policy pathway_careers_public_read on public.pathway_careers for select to anon, authenticated using (status = 'published');

create table public.pathway_career_links (
  career_id uuid not null references public.pathway_careers(id) on delete cascade,
  pathway_id uuid not null references public.pathways(id) on delete cascade,
  track_id uuid references public.pathway_tracks(id),
  relationship_type text not null default 'relevant' check (relationship_type in ('relevant','common_route','required_by_source')),
  explanation text not null default '',
  source_id uuid not null references public.pathway_sources(id),
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  created_at timestamptz not null default now(),
  primary key(career_id, pathway_id, relationship_type)
);
alter table public.pathway_career_links enable row level security;
revoke all on table public.pathway_career_links from public, anon, authenticated;
grant select on table public.pathway_career_links to anon, authenticated;
grant select, insert, update, delete on table public.pathway_career_links to service_role;
create policy pathway_career_links_public_read on public.pathway_career_links for select to anon, authenticated using (
  exists (select 1 from public.pathway_careers c where c.id = career_id and c.status = 'published')
  and exists (select 1 from public.pathways p where p.id = pathway_id and p.status = 'published')
);

create table public.pathway_school_offerings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  pathway_id uuid not null references public.pathways(id),
  track_id uuid references public.pathway_tracks(id),
  combination_id uuid references public.pathway_subject_combinations(id),
  offering_status text not null default 'observed' check (offering_status in ('observed','verified','superseded','withdrawn')),
  source_id uuid not null references public.pathway_sources(id),
  observed_at timestamptz not null default now(),
  verified_at timestamptz,
  effective_from date,
  effective_to date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(school_id, pathway_id, combination_id, source_id),
  check ((offering_status = 'verified' and verified_at is not null) or offering_status <> 'verified')
);
alter table public.pathway_school_offerings enable row level security;
revoke all on table public.pathway_school_offerings from public, anon, authenticated;
grant select on table public.pathway_school_offerings to anon, authenticated;
grant select, insert, update, delete on table public.pathway_school_offerings to service_role;
create policy pathway_school_offerings_public_read on public.pathway_school_offerings for select to anon, authenticated using (
  offering_status = 'verified' and verified_at is not null
  and exists (select 1 from public.pathways p where p.id = pathway_id and p.status = 'published')
);

create table public.student_pathway_decisions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  pathway_id uuid not null references public.pathways(id),
  decision_type text not null check (decision_type in ('quick_check_saved','adopted','changed','reviewed')),
  evidence_snapshot jsonb not null default '{}'::jsonb,
  input_fingerprint text not null,
  rule_version text not null,
  idempotency_key text not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  unique(student_id, idempotency_key)
);
alter table public.student_pathway_decisions enable row level security;
revoke all on table public.student_pathway_decisions from public, anon, authenticated;
grant select on table public.student_pathway_decisions to authenticated;
grant select, insert, update, delete on table public.student_pathway_decisions to service_role;
create policy student_pathway_decisions_own_read on public.student_pathway_decisions for select to authenticated using (
  exists (select 1 from public.students s where s.id = student_id and s.profile_id = (select auth.uid()) and s.deleted_at is null)
);

create table public.student_pathway_passports (
  student_id uuid primary key references public.students(id) on delete cascade,
  adopted_pathway_id uuid not null references public.pathways(id),
  source_decision_id uuid not null references public.student_pathway_decisions(id),
  evidence_type text not null default 'quick_check' check (evidence_type in ('quick_check','learner_choice','guided_review')),
  evidence_snapshot jsonb not null default '{}'::jsonb,
  rule_version text not null,
  adopted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.student_pathway_passports enable row level security;
revoke all on table public.student_pathway_passports from public, anon, authenticated;
grant select on table public.student_pathway_passports to authenticated;
grant select, insert, update, delete on table public.student_pathway_passports to service_role;
create policy student_pathway_passports_own_read on public.student_pathway_passports for select to authenticated using (
  exists (select 1 from public.students s where s.id = student_id and s.profile_id = (select auth.uid()) and s.deleted_at is null)
);

create index pathway_tracks_pathway_idx on public.pathway_tracks(pathway_id, status);
create index pathway_combinations_pathway_idx on public.pathway_subject_combinations(pathway_id, track_id, status);
create index pathway_combination_subjects_subject_idx on public.pathway_combination_subjects(canonical_subject_id);
create index pathway_career_links_pathway_idx on public.pathway_career_links(pathway_id, career_id);
create index pathway_school_offerings_school_idx on public.pathway_school_offerings(school_id, offering_status);
create index pathway_school_offerings_combination_idx on public.pathway_school_offerings(combination_id, offering_status);
create index student_pathway_decisions_student_created_idx on public.student_pathway_decisions(student_id, created_at desc);

create or replace function public.student_adopt_pathway_quick_check(
  p_pathway_slug text,
  p_answers jsonb,
  p_scores jsonb,
  p_rule_version text,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  caller uuid := auth.uid();
  learner public.students%rowtype;
  chosen public.pathways%rowtype;
  decision public.student_pathway_decisions%rowtype;
  fingerprint text;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if p_pathway_slug is null or length(trim(p_pathway_slug)) = 0 then raise exception 'pathway_required'; end if;
  if p_rule_version is null or length(trim(p_rule_version)) = 0 or length(p_rule_version) > 80 then raise exception 'invalid_rule_version'; end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 or length(p_idempotency_key) > 128 then raise exception 'invalid_idempotency_key'; end if;
  if pg_column_size(coalesce(p_answers, '{}'::jsonb)) > 16384 then raise exception 'answers_too_large'; end if;
  if pg_column_size(coalesce(p_scores, '{}'::jsonb)) > 4096 then raise exception 'scores_too_large'; end if;

  select * into learner from public.students where profile_id = caller and deleted_at is null order by created_at asc limit 1;
  if not found then raise exception 'learner_identity_not_found'; end if;

  select * into chosen from public.pathways where slug = lower(trim(p_pathway_slug)) and status = 'published' limit 1;
  if not found then raise exception 'published_pathway_not_found'; end if;

  fingerprint := encode(digest(
    convert_to(jsonb_build_object(
      'pathway_slug', chosen.slug,
      'answers', coalesce(p_answers,'{}'::jsonb),
      'scores', coalesce(p_scores,'{}'::jsonb),
      'rule_version', trim(p_rule_version)
    )::text, 'UTF8'), 'sha256'), 'hex');

  select * into decision from public.student_pathway_decisions
  where student_id = learner.id and idempotency_key = p_idempotency_key
  for update;

  if found then
    if decision.input_fingerprint <> fingerprint or decision.pathway_id <> chosen.id then
      raise exception 'idempotency_replay_mismatch';
    end if;
  else
    insert into public.student_pathway_decisions(
      student_id, pathway_id, decision_type, evidence_snapshot, input_fingerprint,
      rule_version, idempotency_key, created_by
    ) values (
      learner.id, chosen.id, 'quick_check_saved',
      jsonb_build_object(
        'evidence_class','learner_supplied_quick_check',
        'answers',coalesce(p_answers,'{}'::jsonb),
        'scores',coalesce(p_scores,'{}'::jsonb),
        'disclaimer','Early VibeSchool guidance; not an official placement decision.'
      ), fingerprint, trim(p_rule_version), p_idempotency_key, caller
    ) returning * into decision;
  end if;

  insert into public.student_pathway_passports(
    student_id, adopted_pathway_id, source_decision_id,
    evidence_type, evidence_snapshot, rule_version, adopted_at, updated_at
  ) values (
    learner.id, chosen.id, decision.id, 'quick_check',
    jsonb_build_object('evidence_class','learner_supplied_quick_check','scores',coalesce(p_scores,'{}'::jsonb)),
    trim(p_rule_version), decision.created_at, now()
  )
  on conflict (student_id) do update set
    adopted_pathway_id = excluded.adopted_pathway_id,
    source_decision_id = excluded.source_decision_id,
    evidence_type = excluded.evidence_type,
    evidence_snapshot = excluded.evidence_snapshot,
    rule_version = excluded.rule_version,
    adopted_at = excluded.adopted_at,
    updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'student_id', learner.id,
    'pathway_id', chosen.id,
    'pathway_slug', chosen.slug,
    'pathway_name', chosen.name,
    'decision_id', decision.id,
    'saved_at', decision.created_at,
    'replayed', decision.created_at < now() - interval '1 millisecond'
  );
end;
$function$;
revoke all on function public.student_adopt_pathway_quick_check(text,jsonb,jsonb,text,text) from public, anon;
grant execute on function public.student_adopt_pathway_quick_check(text,jsonb,jsonb,text,text) to authenticated;

create or replace function public.student_get_pathway_passport()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select coalesce((
    select jsonb_build_object(
      'student_id', pp.student_id,
      'pathway_id', p.id,
      'pathway_slug', p.slug,
      'pathway_name', p.name,
      'summary', p.plain_language_summary,
      'evidence_type', pp.evidence_type,
      'evidence_snapshot', pp.evidence_snapshot,
      'rule_version', pp.rule_version,
      'adopted_at', pp.adopted_at,
      'reviewed_at', pp.reviewed_at,
      'updated_at', pp.updated_at
    )
    from public.student_pathway_passports pp
    join public.students s on s.id = pp.student_id and s.deleted_at is null
    join public.pathways p on p.id = pp.adopted_pathway_id
    where s.profile_id = auth.uid()
    limit 1
  ), 'null'::jsonb);
$function$;
revoke all on function public.student_get_pathway_passport() from public, anon;
grant execute on function public.student_get_pathway_passport() to authenticated;

create or replace function public.pathways_search_public_schools(
  p_query text default null,
  p_county text default null,
  p_pathway_slug text default null,
  p_combination_slug text default null,
  p_limit integer default 30
) returns table(
  school_id uuid,
  school_name text,
  county text,
  sub_county text,
  school_category text,
  ownership_type text,
  gender_type text,
  accommodation_type text,
  cluster text,
  knec_code text,
  pathway_slug text,
  pathway_name text,
  combination_slug text,
  combination_name text,
  offering_verified_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  with eligible as (
    select
      s.id school_id, s.name::text school_name, s.county::text county,
      s.sub_county::text sub_county, s.school_category::text school_category,
      s.ownership_type, s.gender_type, s.accommodation_type, s.cluster,
      s.knec_code::text knec_code, p.slug pathway_slug, p.name pathway_name,
      c.slug combination_slug, c.display_name combination_name, o.verified_at offering_verified_at
    from public.schools s
    left join public.pathway_school_offerings o
      on o.school_id = s.id and o.offering_status = 'verified' and o.verified_at is not null
    left join public.pathways p on p.id = o.pathway_id and p.status = 'published'
    left join public.pathway_subject_combinations c on c.id = o.combination_id and c.status = 'published' and c.pathway_id = o.pathway_id
    where s.deleted_at is null and s.status = 'active'
      and (p_query is null or trim(p_query) = '' or lower(s.name) like '%' || lower(trim(p_query)) || '%')
      and (p_county is null or trim(p_county) = '' or lower(coalesce(s.county,'')) = lower(trim(p_county)))
      and ((p_pathway_slug is null and p_combination_slug is null) or (
        o.id is not null
        and (p_pathway_slug is null or p.slug = lower(trim(p_pathway_slug)))
        and (p_combination_slug is null or c.slug = lower(trim(p_combination_slug)))
      ))
  )
  select distinct on (e.school_id, e.pathway_slug, e.combination_slug)
    e.school_id, e.school_name, e.county, e.sub_county, e.school_category,
    e.ownership_type, e.gender_type, e.accommodation_type, e.cluster,
    e.knec_code, e.pathway_slug, e.pathway_name, e.combination_slug,
    e.combination_name, e.offering_verified_at
  from eligible e
  order by e.school_id, e.pathway_slug nulls last, e.combination_slug nulls last,
           e.offering_verified_at desc nulls last, e.school_name
  limit greatest(1, least(coalesce(p_limit,30),50));
$function$;
revoke all on function public.pathways_search_public_schools(text,text,text,text,integer) from public;
grant execute on function public.pathways_search_public_schools(text,text,text,text,integer) to anon, authenticated;

insert into public.pathway_sources (
  id, source_type, source_name, source_url, source_reference,
  observed_at, status, is_public, metadata
) values (
  'bdb736d5-fc4f-4f42-aec8-7cda7f4b0091'::uuid,
  'official_portal',
  'Kenya Ministry of Education Grade 10 School & Pathway Selection System',
  'https://selection.education.go.ke/about',
  'Grade 10 School & Pathway Selection System — About',
  '2026-08-16T00:00:00Z'::timestamptz,
  'active', true,
  jsonb_build_object('authority','Ministry of Education','jurisdiction','Kenya','cohort_scope','Grade 9 to Senior School transition')
) on conflict (id) do nothing;

insert into public.pathways (
  id, slug, name, short_name, plain_language_summary, status, source_id, version, metadata
) values
  ('34476b83-1aad-4f94-a958-c2996311079e'::uuid, 'stem', 'STEM', 'STEM', 'Science, technology, engineering and mathematics pathway.', 'published', 'bdb736d5-fc4f-4f42-aec8-7cda7f4b0091'::uuid, 1, jsonb_build_object('fact_type','official_normalized')),
  ('d9a19fd7-4f15-45de-9131-f0de50c376a0'::uuid, 'social-sciences', 'Social Sciences', 'Social Sciences', 'Social sciences pathway.', 'published', 'bdb736d5-fc4f-4f42-aec8-7cda7f4b0091'::uuid, 1, jsonb_build_object('fact_type','official_normalized')),
  ('74d3d667-e0a1-4b48-8904-31203208d139'::uuid, 'arts-and-sports-science', 'Arts & Sports Science', 'Arts & Sports', 'Arts and sports pathway.', 'published', 'bdb736d5-fc4f-4f42-aec8-7cda7f4b0091'::uuid, 1, jsonb_build_object('fact_type','official_normalized'))
on conflict (id) do nothing;

commit;
