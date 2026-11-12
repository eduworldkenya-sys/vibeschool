-- P0: source-to-database curriculum identity reconciliation. Additive and fail closed.
-- Stable existing IDs must never be regenerated or deleted.
-- authority: KICD Grade 4 Mathematics (regular revised 2024), 2.6 Time, printed pp. 32-33.
-- authorization-test: public.vs_curriculum_package_gate / version promotion trigger.
begin;

-- access: owner-only public.vs_curriculum_package_scopes
-- authorization-test: public.vs_curriculum_package_scopes scripts/sql/p0_grade4_time_identity_audit.sql
create table if not exists public.vs_curriculum_package_scopes (
  package_id text primary key check (btrim(package_id) <> ''),
  sub_strand_id uuid not null references public.cbc_strands(id) on delete restrict,
  source_url text not null check (source_url like 'https://%'),
  source_edition text not null check (btrim(source_edition) <> ''),
  source_section text not null check (btrim(source_section) <> ''),
  source_checked_on date not null,
  source_reviewer_kind text not null,
  resource_key_prefix text not null unique check (btrim(resource_key_prefix) <> ''),
  required_outcomes integer not null check (required_outcomes > 0),
  required_resources integer not null check (required_resources > 0),
  created_at timestamptz not null default now()
);
-- access: owner-only public.vs_curriculum_source_requirements
-- authorization-test: public.vs_curriculum_source_requirements scripts/sql/p0_grade4_time_identity_audit.sql
create table if not exists public.vs_curriculum_source_requirements (
  package_id text not null references public.vs_curriculum_package_scopes(package_id) on delete restrict,
  requirement_code text not null check (btrim(requirement_code) <> ''),
  source_locator text not null check (btrim(source_locator) <> ''),
  original_intent_summary text not null check (btrim(original_intent_summary) <> ''),
  primary key (package_id, requirement_code)
);
-- access: owner-only public.vs_curriculum_manuscript_aliases
-- authorization-test: public.vs_curriculum_manuscript_aliases scripts/sql/p0_grade4_time_identity_audit.sql
create table if not exists public.vs_curriculum_manuscript_aliases (
  package_id text not null,
  manuscript_alias text not null check (btrim(manuscript_alias) <> ''),
  requirement_code text not null,
  primary key (package_id, manuscript_alias),
  foreign key (package_id, requirement_code)
    references public.vs_curriculum_source_requirements(package_id, requirement_code)
    on delete restrict
);
-- access: owner-only public.vs_curriculum_alias_outcomes
-- authorization-test: public.vs_curriculum_alias_outcomes scripts/sql/p0_grade4_time_identity_audit.sql
create table if not exists public.vs_curriculum_alias_outcomes (
  package_id text not null,
  manuscript_alias text not null,
  outcome_id uuid not null references public.curriculum_learning_outcomes(id) on delete restrict,
  primary key (package_id, manuscript_alias, outcome_id),
  unique (package_id, outcome_id),
  foreign key (package_id, manuscript_alias)
    references public.vs_curriculum_manuscript_aliases(package_id, manuscript_alias)
    on delete restrict
);
-- access: owner-only public.vs_curriculum_resource_aliases
-- authorization-test: public.vs_curriculum_resource_aliases scripts/sql/p0_grade4_time_identity_audit.sql
create table if not exists public.vs_curriculum_resource_aliases (
  package_id text not null,
  resource_id uuid not null references public.learning_resources(id) on delete restrict,
  manuscript_alias text not null,
  primary key (package_id, resource_id, manuscript_alias),
  foreign key (package_id, manuscript_alias)
    references public.vs_curriculum_manuscript_aliases(package_id, manuscript_alias)
    on delete restrict
);
create index if not exists vs_curriculum_resource_aliases_resource_idx
  on public.vs_curriculum_resource_aliases(resource_id, package_id);

-- Canonical reconciliation ledgers are migration-managed; no public/client/API writes.
alter table public.vs_curriculum_package_scopes enable row level security;
alter table public.vs_curriculum_source_requirements enable row level security;
alter table public.vs_curriculum_manuscript_aliases enable row level security;
alter table public.vs_curriculum_alias_outcomes enable row level security;
alter table public.vs_curriculum_resource_aliases enable row level security;
revoke all on public.vs_curriculum_package_scopes from public, anon, authenticated, service_role;
revoke all on public.vs_curriculum_source_requirements from public, anon, authenticated, service_role;
revoke all on public.vs_curriculum_manuscript_aliases from public, anon, authenticated, service_role;
revoke all on public.vs_curriculum_alias_outcomes from public, anon, authenticated, service_role;
revoke all on public.vs_curriculum_resource_aliases from public, anon, authenticated, service_role;

create or replace function public.vs_curriculum_package_gate(p_package_id text)
returns jsonb language plpgsql stable security invoker set search_path = ''
as $gate$
declare
  p public.vs_curriculum_package_scopes%rowtype;
  errors text[] := array[]::text[];
  requirement_count integer := 0;
  resource_count integer := 0;
begin
  select * into p from public.vs_curriculum_package_scopes
    where package_id = p_package_id;
  if not found then
    return jsonb_build_object('state','BLOCKED_CURRICULUM_RECONCILIATION',
      'package_id',p_package_id,'blockers',jsonb_build_array('unregistered_package'));
  end if;

  select count(*) into requirement_count from public.vs_curriculum_source_requirements
    where package_id=p_package_id;
  if requirement_count <> p.required_outcomes then
    errors := array_append(errors,'source_requirement_count_mismatch');
  end if;

  if exists (
    select 1 from public.vs_curriculum_source_requirements req
    where req.package_id=p_package_id
      and not exists (
        select 1 from public.vs_curriculum_manuscript_aliases a
        join public.vs_curriculum_alias_outcomes ao
          on ao.package_id=a.package_id and ao.manuscript_alias=a.manuscript_alias
        where a.package_id=req.package_id and a.requirement_code=req.requirement_code)
  ) then errors := array_append(errors,'unresolved_kicd_requirement'); end if;

  if exists (
    select 1 from public.vs_curriculum_manuscript_aliases a
    where a.package_id=p_package_id and not exists (
      select 1 from public.vs_curriculum_alias_outcomes ao
      where ao.package_id=a.package_id and ao.manuscript_alias=a.manuscript_alias)
  ) then errors := array_append(errors,'unresolved_manuscript_alias'); end if;

  if exists (
    select 1 from public.vs_curriculum_alias_outcomes ao
    join public.vs_curriculum_manuscript_aliases a
      on a.package_id=ao.package_id and a.manuscript_alias=ao.manuscript_alias
    join public.vs_curriculum_source_requirements req
      on req.package_id=a.package_id and req.requirement_code=a.requirement_code
    left join public.curriculum_learning_outcomes o on o.id=ao.outcome_id
    where ao.package_id=p_package_id
      and (o.id is null or o.sub_strand_id is distinct from p.sub_strand_id
           or o.status <> 'active'
           or o.source_locator is distinct from req.source_locator
           or nullif(btrim(o.outcome_code),'') is null)
  ) then errors := array_append(errors,'outcome_identity_or_locator_invalid'); end if;

  select count(*) into resource_count
  from public.learning_resources r
  where left(r.canonical_key,length(p.resource_key_prefix))=p.resource_key_prefix;

  if resource_count <> p.required_resources then
    errors := array_append(errors,'resource_count_mismatch');
  end if;

  if exists (
    select 1 from public.learning_resources r
    where left(r.canonical_key,length(p.resource_key_prefix))=p.resource_key_prefix
      and (r.sub_strand_id is distinct from p.sub_strand_id
        or r.status <> 'active' or r.owner_type <> 'platform'
        or r.source_type <> 'platform_authored'
        or not exists (
          select 1 from public.vs_curriculum_resource_aliases ra
          where ra.package_id=p_package_id and ra.resource_id=r.id))
  ) then errors := array_append(errors,'resource_scope_or_alias_missing'); end if;

  if exists (
    select 1 from public.vs_curriculum_resource_aliases ra
    join public.learning_resources r on r.id=ra.resource_id
    where ra.package_id=p_package_id
      and (left(r.canonical_key,length(p.resource_key_prefix))<>p.resource_key_prefix
        or r.sub_strand_id is distinct from p.sub_strand_id)
  ) then errors := array_append(errors,'cross_scope_resource_alias'); end if;

  if exists (
    select 1 from public.vs_curriculum_manuscript_aliases a
    where a.package_id=p_package_id and not exists (
      select 1 from public.vs_curriculum_resource_aliases ra
      where ra.package_id=a.package_id and ra.manuscript_alias=a.manuscript_alias)
  ) then errors := array_append(errors,'required_outcome_not_taught'); end if;

  return jsonb_build_object(
    'state',case when cardinality(errors)=0 then 'PASS'
      else 'BLOCKED_CURRICULUM_RECONCILIATION' end,
    'package_id',p_package_id,
    'source_url',p.source_url,'source_section',p.source_section,
    'outcomes_expected',p.required_outcomes,'outcomes_reconciled',requirement_count,
    'resources_expected',p.required_resources,'resources_found',resource_count,
    'blockers',to_jsonb(errors)
  );
end
$gate$;
revoke all on function public.vs_curriculum_package_gate(text)
  from public, anon, authenticated, service_role;
grant execute on function public.vs_curriculum_package_gate(text) to service_role;

-- This is a database transition gate, not a report-only check.
-- Existing immutable certified versions remain unchanged. Future promotions
-- must contain manuscript aliases that exactly match canonical resource links.
create or replace function public.vs_guard_curriculum_version_promotion()
returns trigger language plpgsql security invoker set search_path = ''
as $guard$
declare
  r public.learning_resources%rowtype;
  v_package_id text;
  state jsonb;
  expected_aliases jsonb;
  submitted_aliases jsonb;
begin
  if new.lifecycle_status not in ('verified','certified') then return new; end if;
  if tg_op='UPDATE' and old.lifecycle_status is not distinct from new.lifecycle_status then
    return new;
  end if;

  select * into r from public.learning_resources where id=new.resource_id;
  if not found then
    raise exception using errcode='23503',message='VS_CURRICULUM_RESOURCE_NOT_FOUND';
  end if;
  if r.owner_type is distinct from 'platform'
    or r.source_type is distinct from 'platform_authored' then return new; end if;

  v_package_id := nullif(btrim(coalesce(new.provenance->>'package_id','')),'');
  if v_package_id is null then
    raise exception using errcode='23514',
      message='VS_CURRICULUM_PACKAGE_ID_REQUIRED';
  end if;

  state := public.vs_curriculum_package_gate(v_package_id);
  if state->>'state' <> 'PASS' then
    raise exception using errcode='23514',
      message='BLOCKED_CURRICULUM_RECONCILIATION',detail=state::text;
  end if;

  if not exists (
    select 1 from public.vs_curriculum_package_scopes p
    where p.package_id=v_package_id and p.sub_strand_id=r.sub_strand_id
      and left(r.canonical_key,length(p.resource_key_prefix))=p.resource_key_prefix
  ) then
    raise exception using errcode='23514',
      message='VS_CURRICULUM_RESOURCE_PACKAGE_MISMATCH';
  end if;

  select coalesce(jsonb_agg(alias order by alias),'[]'::jsonb)
    into expected_aliases
  from (
    select distinct ra.manuscript_alias as alias
    from public.vs_curriculum_resource_aliases ra
    where ra.package_id=v_package_id and ra.resource_id=r.id
  ) linked;

  if jsonb_typeof(new.payload->'curriculum_outcome_aliases') is distinct from 'array' then
    raise exception using errcode='23514',
      message='VS_CURRICULUM_VERSION_ALIASES_REQUIRED';
  end if;
  select coalesce(jsonb_agg(alias order by alias),'[]'::jsonb)
    into submitted_aliases
  from (
    select distinct value as alias
    from jsonb_array_elements_text(new.payload->'curriculum_outcome_aliases')
  ) submitted;

  if expected_aliases is distinct from submitted_aliases
    or jsonb_array_length(new.payload->'curriculum_outcome_aliases')
       <> jsonb_array_length(submitted_aliases) then
    raise exception using errcode='23514',
      message='VS_CURRICULUM_VERSION_ALIASES_MISMATCH',
      detail=jsonb_build_object('expected',expected_aliases,'submitted',submitted_aliases)::text;
  end if;
  return new;
end
$guard$;
revoke all on function public.vs_guard_curriculum_version_promotion()
  from public, anon, authenticated, service_role;
drop trigger if exists vs_guard_curriculum_version_promotion on public.learning_resource_versions;
create trigger vs_guard_curriculum_version_promotion
before insert or update of lifecycle_status on public.learning_resource_versions
for each row execute function public.vs_guard_curriculum_version_promotion();

-- Grade 4 Time: use the seven actual previously created UUIDs. Never rewrite them.
insert into public.vs_curriculum_package_scopes (
  package_id,sub_strand_id,source_url,source_edition,source_section,source_checked_on,
  source_reviewer_kind,resource_key_prefix,required_outcomes,required_resources
) values (
  'VS-G04-MA-2.6-TIME-20261111',
  'e975dcc6-32a9-4274-a2a3-3d19e409cf5c',
  'https://kicd.ac.ke/wp-content/uploads/2024/02/GRADE.4.MATHEMATICS.pdf',
  'Grade 4 Mathematics revised 2024, regular design',
  'Measurement 2.6 Time; printed pages 32-33',
  '2026-11-12','AI-assisted source comparison, not KICD endorsement or independent review',
  'vs:g4:mathematics:time:learner:lesson:',7,10
) on conflict (package_id) do nothing;

insert into public.vs_curriculum_source_requirements
  (package_id, requirement_code, source_locator, original_intent_summary)
values
  ('VS-G04-MA-2.6-TIME-20261111','a','2.6 Time; p.32; outcome a','Read/tell a.m. and p.m. time'),
  ('VS-G04-MA-2.6-TIME-20261111','b','2.6 Time; p.32; outcome b','Estimate a.m. and p.m. time'),
  ('VS-G04-MA-2.6-TIME-20261111','c','2.6 Time; p.32; outcome c','Convert time units'),
  ('VS-G04-MA-2.6-TIME-20261111','d','2.6 Time; p.32; outcome d','Record hours-and-minutes durations'),
  ('VS-G04-MA-2.6-TIME-20261111','e','2.6 Time; p.32; outcome e','Work out time durations'),
  ('VS-G04-MA-2.6-TIME-20261111','f','2.6 Time; pp.32-33; outcome f','Tell and record with a digital clock'),
  ('VS-G04-MA-2.6-TIME-20261111','g','2.6 Time; p.33; outcome g','Appreciate time in daily activities')
on conflict (package_id,requirement_code) do nothing;

-- Only attach verified locators; keep the original seven identity UUIDs/text/codes
-- unchanged, including split concept rows for c and e.
update public.curriculum_learning_outcomes o set source_locator = case o.id
  when 'e98a2b3e-937c-4c7e-810b-185ebe760198' then '2.6 Time; p.32; outcome a'
  when '908e90f3-95f3-4947-9f11-1e60a3e1e9ee' then '2.6 Time; p.32; outcome b'
  when '1ae5195f-517a-4aa9-ac41-23591cc409f9' then '2.6 Time; p.32; outcome c'
  when 'ea07b06d-2a19-4c92-b40d-69837d2db6f7' then '2.6 Time; p.32; outcome c'
  when '1731d589-7878-4754-8312-2be9ef773c4d' then '2.6 Time; p.32; outcome d'
  when 'e85f5ad8-5e30-4bf8-9b58-66587436b553' then '2.6 Time; p.32; outcome e'
  when '12417afc-b4a3-44ab-a597-70daa7a4fbcd' then '2.6 Time; p.32; outcome e'
  else o.source_locator end
where o.sub_strand_id='e975dcc6-32a9-4274-a2a3-3d19e409cf5c'
  and o.id in (
    'e98a2b3e-937c-4c7e-810b-185ebe760198',
    '908e90f3-95f3-4947-9f11-1e60a3e1e9ee',
    '1ae5195f-517a-4aa9-ac41-23591cc409f9',
    'ea07b06d-2a19-4c92-b40d-69837d2db6f7',
    '1731d589-7878-4754-8312-2be9ef773c4d',
    'e85f5ad8-5e30-4bf8-9b58-66587436b553',
    '12417afc-b4a3-44ab-a597-70daa7a4fbcd'
  )
  and o.source_locator is null;

-- KICD's separate f and g requirements were absent from the database.
-- Deterministic new IDs make the backfill repeatable; no existing identity is replaced.
insert into public.curriculum_learning_outcomes
  (id,sub_strand_id,outcome_text,outcome_code,source_type,source_ref,source_locator,status)
select '89d44daf-65c7-5e1f-bb80-1ab8ee83bf42'::uuid,
  'e975dcc6-32a9-4274-a2a3-3d19e409cf5c'::uuid,
  'Use a digital clock to tell and record the time of activities',
  'VS-G4-MA-2.6-08','official',
  'https://kicd.ac.ke/wp-content/uploads/2024/02/GRADE.4.MATHEMATICS.pdf',
  '2.6 Time; pp.32-33; outcome f','active'
where not exists (
  select 1 from public.curriculum_learning_outcomes
  where id='89d44daf-65c7-5e1f-bb80-1ab8ee83bf42'
     or outcome_code='VS-G4-MA-2.6-08'
);
insert into public.curriculum_learning_outcomes
  (id,sub_strand_id,outcome_text,outcome_code,source_type,source_ref,source_locator,status)
select '925db8c1-6448-522e-af72-4f147783d2de'::uuid,
  'e975dcc6-32a9-4274-a2a3-3d19e409cf5c'::uuid,
  'Explain the importance of time in daily activities',
  'VS-G4-MA-2.6-09','official',
  'https://kicd.ac.ke/wp-content/uploads/2024/02/GRADE.4.MATHEMATICS.pdf',
  '2.6 Time; p.33; outcome g','active'
where not exists (
  select 1 from public.curriculum_learning_outcomes
  where id='925db8c1-6448-522e-af72-4f147783d2de'
     or outcome_code='VS-G4-MA-2.6-09'
);

insert into public.vs_curriculum_manuscript_aliases
  (package_id,manuscript_alias,requirement_code)
values
  ('VS-G04-MA-2.6-TIME-20261111','VS-G04-MA-T-A','a'),
  ('VS-G04-MA-2.6-TIME-20261111','VS-G04-MA-T-B','b'),
  ('VS-G04-MA-2.6-TIME-20261111','VS-G04-MA-T-C','c'),
  ('VS-G04-MA-2.6-TIME-20261111','VS-G04-MA-T-D','d'),
  ('VS-G04-MA-2.6-TIME-20261111','VS-G04-MA-T-E','e'),
  ('VS-G04-MA-2.6-TIME-20261111','VS-G04-MA-T-F','f'),
  ('VS-G04-MA-2.6-TIME-20261111','VS-G04-MA-T-G','g')
on conflict (package_id,manuscript_alias) do nothing;

insert into public.vs_curriculum_alias_outcomes
  (package_id,manuscript_alias,outcome_id)
values
  ('VS-G04-MA-2.6-TIME-20261111','VS-G04-MA-T-A','e98a2b3e-937c-4c7e-810b-185ebe760198'),
  ('VS-G04-MA-2.6-TIME-20261111','VS-G04-MA-T-B','908e90f3-95f3-4947-9f11-1e60a3e1e9ee'),
  ('VS-G04-MA-2.6-TIME-20261111','VS-G04-MA-T-C','1ae5195f-517a-4aa9-ac41-23591cc409f9'),
  ('VS-G04-MA-2.6-TIME-20261111','VS-G04-MA-T-C','ea07b06d-2a19-4c92-b40d-69837d2db6f7'),
  ('VS-G04-MA-2.6-TIME-20261111','VS-G04-MA-T-D','1731d589-7878-4754-8312-2be9ef773c4d'),
  ('VS-G04-MA-2.6-TIME-20261111','VS-G04-MA-T-E','e85f5ad8-5e30-4bf8-9b58-66587436b553'),
  ('VS-G04-MA-2.6-TIME-20261111','VS-G04-MA-T-E','12417afc-b4a3-44ab-a597-70daa7a4fbcd'),
  ('VS-G04-MA-2.6-TIME-20261111','VS-G04-MA-T-F','89d44daf-65c7-5e1f-bb80-1ab8ee83bf42'),
  ('VS-G04-MA-2.6-TIME-20261111','VS-G04-MA-T-G','925db8c1-6448-522e-af72-4f147783d2de')
on conflict (package_id,manuscript_alias,outcome_id) do nothing;

-- Pre-existing immutable version payloads are not edited. The external
-- manifest's lesson -> alias links are persisted against stable resource IDs.
with lesson_aliases(lesson_order,alias) as (
  values
  (1,'VS-G04-MA-T-A'),(1,'VS-G04-MA-T-G'),
  (2,'VS-G04-MA-T-A'),(2,'VS-G04-MA-T-F'),
  (3,'VS-G04-MA-T-B'),(3,'VS-G04-MA-T-G'),
  (4,'VS-G04-MA-T-C'),(5,'VS-G04-MA-T-C'),
  (6,'VS-G04-MA-T-D'),(6,'VS-G04-MA-T-F'),(6,'VS-G04-MA-T-G'),
  (7,'VS-G04-MA-T-D'),(7,'VS-G04-MA-T-E'),
  (8,'VS-G04-MA-T-E'),(8,'VS-G04-MA-T-C'),
  (9,'VS-G04-MA-T-E'),(9,'VS-G04-MA-T-G'),
  (10,'VS-G04-MA-T-A'),(10,'VS-G04-MA-T-B'),(10,'VS-G04-MA-T-C'),
  (10,'VS-G04-MA-T-D'),(10,'VS-G04-MA-T-E'),(10,'VS-G04-MA-T-F'),(10,'VS-G04-MA-T-G')
)
insert into public.vs_curriculum_resource_aliases(package_id,resource_id,manuscript_alias)
select 'VS-G04-MA-2.6-TIME-20261111',r.id,l.alias
from lesson_aliases l
join public.learning_resources r
  on r.canonical_key='vs:g4:mathematics:time:learner:lesson:'||
    lpad(l.lesson_order::text,2,'0')
on conflict (package_id,resource_id,manuscript_alias) do nothing;

-- Retain the existing reader response and permission contract, adding one
-- canonical reconciliation check to fail closed if the package becomes invalid.
create or replace function public.vs_public_grade4_math_time_learner_lessons()
returns table (
  resource_version_id uuid, title text, unit_id text,
  asset_kind text, body text, lesson_order integer
)
language sql stable security definer set search_path = ''
as $reader$
  select
    v.id,
    r.title::text,
    split_part(b.source_ref, '#', 2)::text,
    r.asset_kind::text,
    coalesce(nullif(v.payload->>'content_text', ''), nullif(v.payload->>'body', ''))::text,
    case when r.canonical_key ~ ':lesson:[0-9]{2}$'
      then substring(r.canonical_key from ':lesson:([0-9]{2})$')::integer
      else 0 end
  from public.learning_resources r
  join public.learning_resource_versions v on v.resource_id = r.id
  join public.cbc_strands s on s.id = r.sub_strand_id
  join public.grade4_mathematics_reader_bindings b
    on b.sub_strand_id = s.id and b.status = 'active'
  where r.owner_type = 'platform'
    and r.source_type = 'platform_authored'
    and r.grade = 'Grade 4'
    and r.subject = 'Mathematics'
    and r.sub_strand_id is not null
    and s.grade = 'Grade 4'
    and s.name = 'Measurement'
    and s.sub_strand = 'Time'
    and b.source_ref = 'VS-CUR-G04-MA-2026#2.6'
    and r.status = 'active'
    and r.visibility = 'public'
    and r.asset_kind = 'learner_notes'
    and r.canonical_key like 'vs:g4:mathematics:time:learner:lesson:%'
    and v.lifecycle_status = 'certified'
    and v.certified_at is not null
    and v.rights_status in ('cleared', 'not_applicable')
    and v.payload->>'source_edition' = 'learner'
    and v.payload->>'schema' = 'vibeschool.originals.lesson-content.v1'
    and length(coalesce(v.payload->>'content_text', v.payload->>'body', '')) > 0
    and (public.vs_curriculum_package_gate('VS-G04-MA-2.6-TIME-20261111')->>'state')='PASS'
    and public.fn_learning_resource_visible(r.id)
  order by 6, r.canonical_key
  limit 20;
$reader$;
revoke all on function public.vs_public_grade4_math_time_learner_lessons()
  from public,anon,authenticated;
grant execute on function public.vs_public_grade4_math_time_learner_lessons()
  to anon,authenticated;

-- Fail the migration atomically if the source ledger is unresolved.
do $audit$
declare g jsonb;
begin
  g := public.vs_curriculum_package_gate('VS-G04-MA-2.6-TIME-20261111');
  if g->>'state' <> 'PASS' then
    raise exception 'P0_GRADE4_TIME_RECONCILIATION_FAILED: %',g;
  end if;
  if (select count(*) from public.vs_public_grade4_math_time_learner_lessons())<>10 then
    raise exception 'P0_GRADE4_TIME_READER_NOT_TEN_AFTER_GATE';
  end if;
end
$audit$;
comment on function public.vs_curriculum_package_gate(text) is
  'P0 KICD source/alias/stable-outcome reconciliation; any missing or cross-scope link blocks publication.';
comment on function public.vs_guard_curriculum_version_promotion() is
  'P0 fail-closed trigger for platform authored resource promotion; require an explicitly reconciled package and matching manuscript aliases.';
commit;
