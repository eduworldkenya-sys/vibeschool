-- Pathways current-main reconstruction.
-- Additive only. Reuses canonical schools, subjects, profiles and students.

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
-- authorization-test: public.pathway_sources anon/authenticated read only public non-withdrawn provenance; client writes denied.

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
create policy pathways_public_read on public.pathways for select to anon, authenticated using (status='published');
-- authorization-test: public.pathways anon/authenticated see published pathway facts only; client writes denied.

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
  unique(pathway_id,slug,version)
);
alter table public.pathway_tracks enable row level security;
revoke all on table public.pathway_tracks from public, anon, authenticated;
grant select on table public.pathway_tracks to anon, authenticated;
grant select, insert, update, delete on table public.pathway_tracks to service_role;
create policy pathway_tracks_public_read on public.pathway_tracks for select to anon, authenticated using (status='published' and exists(select 1 from public.pathways p where p.id=pathway_id and p.status='published'));
-- authorization-test: public.pathway_tracks public reads require a published parent pathway; client writes denied.

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
  unique(pathway_id,slug,version)
);
alter table public.pathway_subject_combinations enable row level security;
revoke all on table public.pathway_subject_combinations from public, anon, authenticated;
grant select on table public.pathway_subject_combinations to anon, authenticated;
grant select, insert, update, delete on table public.pathway_subject_combinations to service_role;
create policy pathway_combinations_public_read on public.pathway_subject_combinations for select to anon, authenticated using (status='published' and exists(select 1 from public.pathways p where p.id=pathway_id and p.status='published'));
-- authorization-test: public.pathway_subject_combinations public reads require published combination and pathway; client writes denied.

create table public.pathway_combination_subjects (
  combination_id uuid not null references public.pathway_subject_combinations(id) on delete cascade,
  canonical_subject_id uuid not null references public.subjects(id),
  subject_order smallint not null default 1 check (subject_order>0),
  requirement_role text not null default 'selected' check (requirement_role in ('selected','core','supporting')),
  source_id uuid not null references public.pathway_sources(id),
  created_at timestamptz not null default now(),
  primary key(combination_id,canonical_subject_id)
);
alter table public.pathway_combination_subjects enable row level security;
revoke all on table public.pathway_combination_subjects from public, anon, authenticated;
grant select on table public.pathway_combination_subjects to anon, authenticated;
grant select, insert, update, delete on table public.pathway_combination_subjects to service_role;
create policy pathway_combination_subjects_public_read on public.pathway_combination_subjects for select to anon, authenticated using (exists(select 1 from public.pathway_subject_combinations c where c.id=combination_id and c.status='published'));
-- authorization-test: public.pathway_combination_subjects public reads require a published combination; client writes denied.

create or replace function public.pathways_assert_canonical_subject()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $function$
begin
  if not exists(select 1 from public.subjects s where s.id=new.canonical_subject_id and s.global_subject_id is null) then raise exception 'pathways_subject_must_be_canonical'; end if;
  return new;
end;
$function$;
revoke all on function public.pathways_assert_canonical_subject() from public,anon,authenticated;
grant execute on function public.pathways_assert_canonical_subject() to service_role;
create trigger pathways_combination_subject_canonical_guard before insert or update of canonical_subject_id on public.pathway_combination_subjects for each row execute function public.pathways_assert_canonical_subject();

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
revoke all on table public.pathway_careers from public,anon,authenticated;
grant select on table public.pathway_careers to anon,authenticated;
grant select,insert,update,delete on table public.pathway_careers to service_role;
create policy pathway_careers_public_read on public.pathway_careers for select to anon,authenticated using(status='published');
-- authorization-test: public.pathway_careers public reads require published status; client writes denied.

create table public.pathway_career_links (
  career_id uuid not null references public.pathway_careers(id) on delete cascade,
  pathway_id uuid not null references public.pathways(id) on delete cascade,
  track_id uuid references public.pathway_tracks(id),
  relationship_type text not null default 'relevant' check (relationship_type in ('relevant','common_route','required_by_source')),
  explanation text not null default '',
  source_id uuid not null references public.pathway_sources(id),
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  created_at timestamptz not null default now(),
  primary key(career_id,pathway_id,relationship_type)
);
alter table public.pathway_career_links enable row level security;
revoke all on table public.pathway_career_links from public,anon,authenticated;
grant select on table public.pathway_career_links to anon,authenticated;
grant select,insert,update,delete on table public.pathway_career_links to service_role;
create policy pathway_career_links_public_read on public.pathway_career_links for select to anon,authenticated using(exists(select 1 from public.pathway_careers c where c.id=career_id and c.status='published') and exists(select 1 from public.pathways p where p.id=pathway_id and p.status='published'));
-- authorization-test: public.pathway_career_links public reads require published career and pathway; client writes denied.

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
  unique(school_id,pathway_id,combination_id,source_id),
  check((offering_status='verified' and verified_at is not null) or offering_status<>'verified')
);
alter table public.pathway_school_offerings enable row level security;
revoke all on table public.pathway_school_offerings from public,anon,authenticated;
grant select on table public.pathway_school_offerings to anon,authenticated;
grant select,insert,update,delete on table public.pathway_school_offerings to service_role;
create policy pathway_school_offerings_public_read on public.pathway_school_offerings for select to anon,authenticated using(offering_status='verified' and verified_at is not null and exists(select 1 from public.pathways p where p.id=pathway_id and p.status='published'));
-- authorization-test: public.pathway_school_offerings public reads expose verified offerings only; client writes denied.

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
  unique(student_id,idempotency_key)
);
alter table public.student_pathway_decisions enable row level security;
revoke all on table public.student_pathway_decisions from public,anon,authenticated;
grant select on table public.student_pathway_decisions to authenticated;
grant select,insert,update,delete on table public.student_pathway_decisions to service_role;
create policy student_pathway_decisions_own_read on public.student_pathway_decisions for select to authenticated using(exists(select 1 from public.students s where s.id=student_id and s.profile_id=(select auth.uid()) and s.deleted_at is null));
-- authorization-test: public.student_pathway_decisions learner reads own canonical decisions only; direct writes denied.

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
revoke all on table public.student_pathway_passports from public,anon,authenticated;
grant select on table public.student_pathway_passports to authenticated;
grant select,insert,update,delete on table public.student_pathway_passports to service_role;
create policy student_pathway_passports_own_read on public.student_pathway_passports for select to authenticated using(exists(select 1 from public.students s where s.id=student_id and s.profile_id=(select auth.uid()) and s.deleted_at is null));
-- authorization-test: public.student_pathway_passports learner reads own canonical passport only; direct writes denied.

create table public.parent_pathway_drafts (
  id uuid primary key default gen_random_uuid(),
  parent_profile_id uuid not null references public.profiles(id) on delete cascade,
  pathway_id uuid not null references public.pathways(id),
  evidence_snapshot jsonb not null default '{}'::jsonb,
  rule_version text not null,
  input_fingerprint text not null,
  idempotency_key text not null,
  status text not null default 'active' check(status in ('active','adopted_by_learner','dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(parent_profile_id,idempotency_key)
);
alter table public.parent_pathway_drafts enable row level security;
revoke all on table public.parent_pathway_drafts from public,anon,authenticated;
grant select on table public.parent_pathway_drafts to authenticated;
grant select,insert,update,delete on table public.parent_pathway_drafts to service_role;
create policy parent_pathway_drafts_own_read on public.parent_pathway_drafts for select to authenticated using(parent_profile_id=(select auth.uid()));
-- authorization-test: public.parent_pathway_drafts parent reads only own adult-owned drafts; direct writes denied.

create table public.pathway_source_observations (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.pathway_sources(id),
  observation_kind text not null check(observation_kind in ('pathway','track','subject_combination','career_link','school_offering')),
  external_record_id text not null,
  external_parent_id text,
  observed_label text not null,
  observed_payload jsonb not null default '{}'::jsonb,
  evidence_url text,
  observed_at timestamptz not null default now(),
  content_hash text not null,
  reconciliation_status text not null default 'pending' check(reconciliation_status in ('pending','matched','ambiguous','rejected','superseded')),
  canonical_pathway_id uuid references public.pathways(id),
  canonical_track_id uuid references public.pathway_tracks(id),
  canonical_combination_id uuid references public.pathway_subject_combinations(id),
  canonical_school_id uuid references public.schools(id),
  reconciled_at timestamptz,
  reconciliation_note text,
  created_at timestamptz not null default now(),
  unique(source_id,observation_kind,external_record_id,content_hash)
);
alter table public.pathway_source_observations enable row level security;
revoke all on table public.pathway_source_observations from public,anon,authenticated;
grant select,insert,update,delete on table public.pathway_source_observations to service_role;
-- access: service-only public.pathway_source_observations
-- authorization-test: public.pathway_source_observations anon/authenticated have no table privileges or policies.

create index pathway_tracks_pathway_idx on public.pathway_tracks(pathway_id,status);
create index pathway_combinations_pathway_idx on public.pathway_subject_combinations(pathway_id,track_id,status);
create index pathway_combination_subjects_subject_idx on public.pathway_combination_subjects(canonical_subject_id);
create index pathway_career_links_pathway_idx on public.pathway_career_links(pathway_id,career_id);
create index pathway_school_offerings_school_idx on public.pathway_school_offerings(school_id,offering_status);
create index pathway_school_offerings_combination_idx on public.pathway_school_offerings(combination_id,offering_status);
create index student_pathway_decisions_student_created_idx on public.student_pathway_decisions(student_id,created_at desc);
create index parent_pathway_drafts_parent_status_idx on public.parent_pathway_drafts(parent_profile_id,status,updated_at desc);
create index pathway_source_observations_pending_idx on public.pathway_source_observations(reconciliation_status,observation_kind,observed_at desc);

insert into public.pathway_sources(source_type,source_name,source_url,source_reference,status,is_public)
values('official_portal','Ministry of Education Grade 10 Selection System','https://selection.education.go.ke/','Senior School pathway families','active',true)
on conflict do nothing;

with src as (select id from public.pathway_sources where source_name='Ministry of Education Grade 10 Selection System' order by created_at limit 1)
insert into public.pathways(slug,name,short_name,plain_language_summary,status,source_id)
select x.slug,x.name,x.short_name,x.summary,'published',src.id from src cross join (values
 ('stem','STEM','STEM','Science, technology, engineering and mathematics.'),
 ('social-sciences','Social Sciences','Social Sciences','Social, humanities, language and business-oriented directions.'),
 ('arts-and-sports-science','Arts & Sports Science','Arts & Sports Science','Arts, creative expression and sports-oriented directions.')
) as x(slug,name,short_name,summary)
on conflict(slug) do nothing;

commit;
