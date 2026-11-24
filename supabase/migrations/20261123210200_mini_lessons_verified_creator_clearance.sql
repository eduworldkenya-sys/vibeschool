-- A self-editable profiles.date_of_birth cannot prove adulthood.
-- This separate service-owned clearance is fail-closed. Never auto-create a clearance.
-- Before public commissioning, eligible creators need independent adult verification.
create table if not exists public.mini_creator_clearances (
 profile_id uuid primary key references public.profiles(id) on delete cascade,
 verified_birthdate date not null,
 verified_at timestamptz not null default now(),
 verified_by uuid not null references public.profiles(id) on delete restrict,
 evidence_reference text not null check(char_length(btrim(evidence_reference)) between 12 and 160),
 revoked_at timestamptz,
 constraint mini_clearance_adult_at_verification check (verified_birthdate <= (verified_at::date - interval '18 years')::date)
);
alter table public.mini_creator_clearances enable row level security;
revoke all on public.mini_creator_clearances from public,anon,authenticated;
-- No end-user SELECT/INSERT/UPDATE/DELETE policies: service role only.
create or replace function public.mini_verified_adult(p_user uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists (
  select 1 from public.profiles p
   join public.mini_creator_clearances c on c.profile_id=p.id
  where p.id=p_user and p.account_status::text='active'
   and not p.is_anonymized and c.revoked_at is null
   and c.verified_birthdate <= (current_date - interval '18 years')::date
 );
$$;
revoke all on function public.mini_verified_adult(uuid) from public,anon,authenticated;
grant execute on function public.mini_verified_adult(uuid) to authenticated;

create or replace function public.mini_creator_can_submit(p_user uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select public.mini_verified_adult(p_user) and exists (
  select 1 from public.global_public_profiles gp
  where gp.profile_id=p_user and gp.is_public
 );
$$;
revoke all on function public.mini_creator_can_submit(uuid) from public,anon,authenticated;
grant execute on function public.mini_creator_can_submit(uuid) to authenticated;

create or replace function public.mini_creator_public(p_user uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select public.mini_verified_adult(p_user) and exists (
  select 1 from public.global_public_profiles gp
  where gp.profile_id=p_user and gp.is_public
 );
$$;
revoke all on function public.mini_creator_public(uuid) from public,anon,authenticated;
grant execute on function public.mini_creator_public(uuid) to anon,authenticated;

create or replace function public.mini_adult_signal_allowed(p_user uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select public.mini_verified_adult(p_user);
$$;
revoke all on function public.mini_adult_signal_allowed(uuid) from public,anon,authenticated;
grant execute on function public.mini_adult_signal_allowed(uuid) to authenticated;

-- A verified HQ human can record an independent adult check using service_role only.
-- Actual evidence must be held in the established restricted HQ workflow, not this table.
create or replace function public.mini_record_creator_clearance(
 p_actor uuid,p_creator uuid,p_verified_birthdate date,p_evidence_reference text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_member record; v_before jsonb; v_after jsonb;
begin
 select role,status,permissions,access_expires_at,revoked_at,suspended_at into v_member
 from public.hq_human_members where profile_id=p_actor;
 if not found or v_member.status<>'active' or v_member.revoked_at is not null
  or v_member.suspended_at is not null
  or (v_member.access_expires_at is not null and v_member.access_expires_at<=now())
  or not (v_member.role='founder' or 'content.approve'=any(v_member.permissions)) then
   raise exception 'HQ clearance authority denied';
 end if;
 if p_actor=p_creator then raise exception 'Self-clearance denied'; end if;
 if p_verified_birthdate is null or p_verified_birthdate > (current_date-interval '18 years')::date
  or char_length(btrim(coalesce(p_evidence_reference,''))) not between 12 and 160 then
  raise exception 'Independent adult evidence reference required';
 end if;
 if not exists(select 1 from public.profiles p where p.id=p_creator and p.account_status::text='active'
    and not p.is_anonymized) then raise exception 'Active creator profile required';end if;
 select to_jsonb(c) into v_before from public.mini_creator_clearances c where c.profile_id=p_creator for update;
 insert into public.mini_creator_clearances
   (profile_id,verified_birthdate,verified_by,evidence_reference,verified_at,revoked_at)
 values(p_creator,p_verified_birthdate,p_actor,btrim(p_evidence_reference),now(),null)
 on conflict(profile_id) do update
 set verified_birthdate=excluded.verified_birthdate,verified_by=excluded.verified_by,
 evidence_reference=excluded.evidence_reference,verified_at=now(),revoked_at=null;
 v_after:=jsonb_build_object('verified',true,'creator',p_creator);
 insert into public.hq_human_audit_log(actor_id,target_id,action,before_state,after_state,source,request_id)
 values(p_actor,p_creator,'mini.creator.adult_verified',
  jsonb_build_object('previously_verified',v_before is not null),v_after,'human',gen_random_uuid());
 return v_after;
end; $$;
revoke all on function public.mini_record_creator_clearance(uuid,uuid,date,text) from public,anon,authenticated;
grant execute on function public.mini_record_creator_clearance(uuid,uuid,date,text) to service_role;

comment on table public.mini_creator_clearances is
'Adult creator proof verified by HQ, never inferred from mutable profiles.date_of_birth. No automatic clearances.';
