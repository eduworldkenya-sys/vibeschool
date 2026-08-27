-- Schools V2: trust, profile completeness and governed school-claim foundation.
-- Claim requests never mutate canonical school records automatically.
-- authorization-test: public.school_profile_claim_requests

create table if not exists public.school_profile_claim_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  role_at_school text not null,
  evidence_note text,
  contact_phone text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','withdrawn')),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_profile_claim_requests_pending_has_no_review
    check (status <> 'pending' or (reviewed_at is null and reviewed_by is null))
);

create unique index if not exists school_profile_claim_requests_one_open
  on public.school_profile_claim_requests(school_id, requested_by)
  where status = 'pending';

alter table public.school_profile_claim_requests enable row level security;

revoke all on table public.school_profile_claim_requests from public, anon, authenticated;
grant select, insert on table public.school_profile_claim_requests to authenticated;

create policy "claimants can read own school claims"
  on public.school_profile_claim_requests for select
  to authenticated
  using (requested_by = auth.uid());

create policy "claimants can create own school claims"
  on public.school_profile_claim_requests for insert
  to authenticated
  with check (
    requested_by = auth.uid()
    and status = 'pending'
    and reviewed_at is null
    and reviewed_by is null
  );

create or replace function public.submit_school_profile_claim_v1(
  p_school_id uuid,
  p_role_at_school text,
  p_evidence_note text default null,
  p_contact_phone text default null
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if length(trim(coalesce(p_role_at_school,''))) < 2 then raise exception 'role_required'; end if;
  if not exists(
    select 1
    from public.schools s
    where s.id = p_school_id
      and coalesce(to_jsonb(s)->>'deleted_at', '') = ''
  ) then
    raise exception 'school_not_found';
  end if;

  insert into public.school_profile_claim_requests(
    school_id, requested_by, role_at_school, evidence_note, contact_phone,
    status, reviewed_at, reviewed_by
  )
  values(
    p_school_id, auth.uid(), trim(p_role_at_school),
    nullif(trim(coalesce(p_evidence_note,'')),''),
    nullif(trim(coalesce(p_contact_phone,'')),''),
    'pending', null, null
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_school_profile_claim_v1(uuid,text,text,text) from public, anon;
grant execute on function public.submit_school_profile_claim_v1(uuid,text,text,text) to authenticated;

create or replace function public.schools_profile_trust_public_v1(p_school_id uuid)
returns table(
  school_id uuid,
  verified_claim_count bigint,
  profile_completeness integer,
  trust_state text,
  last_verified_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  with s as (
    select
      s.id,
      to_jsonb(s) as doc
    from public.schools s
    where s.id = p_school_id
      and coalesce(to_jsonb(s)->>'deleted_at', '') = ''
  ), o as (
    select
      count(*) filter (
        where verified_at is not null
          and verification_state = 'verified'
      )::bigint as n,
      max(verified_at) filter (
        where verification_state = 'verified'
      ) as last_verified
    from public.pathway_school_offerings
    where school_id = p_school_id
  ), c as (
    select
      s.id,
      (
        case when nullif(trim(coalesce(s.doc->>'name','')),'') is not null then 1 else 0 end +
        case when nullif(trim(coalesce(s.doc->>'county','')),'') is not null then 1 else 0 end +
        case when nullif(trim(coalesce(s.doc->>'sub_county','')),'') is not null then 1 else 0 end +
        case when nullif(trim(coalesce(s.doc->>'school_category','')),'') is not null then 1 else 0 end +
        case when nullif(trim(coalesce(s.doc->>'ownership_type','')),'') is not null then 1 else 0 end +
        case when nullif(trim(coalesce(s.doc->>'gender_type','')),'') is not null then 1 else 0 end +
        case when nullif(trim(coalesce(s.doc->>'accommodation_type','')),'') is not null then 1 else 0 end +
        case when nullif(trim(coalesce(s.doc->>'knec_code','')),'') is not null then 1 else 0 end +
        case when nullif(trim(coalesce(s.doc->>'phone','')),'') is not null then 1 else 0 end +
        case when nullif(trim(coalesce(s.doc->>'postal_address','')),'') is not null then 1 else 0 end +
        case when nullif(trim(coalesce(s.doc->>'motto','')),'') is not null then 1 else 0 end +
        case when nullif(trim(coalesce(s.doc->>'vision','')),'') is not null then 1 else 0 end +
        case when nullif(trim(coalesce(s.doc->>'logo_url','')),'') is not null then 1 else 0 end +
        case when nullif(trim(coalesce(s.doc->>'established_year','')),'') is not null then 1 else 0 end
      ) as populated_fields
    from s
  )
  select
    c.id,
    o.n,
    least(100, round((c.populated_fields::numeric / 14) * 100)::integer),
    case when o.n > 0 then 'verified_claims' else 'canonical_identity' end,
    o.last_verified
  from c cross join o;
$$;

revoke all on function public.schools_profile_trust_public_v1(uuid) from public;
grant execute on function public.schools_profile_trust_public_v1(uuid) to anon, authenticated;
