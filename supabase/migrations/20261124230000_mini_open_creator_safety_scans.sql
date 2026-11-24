-- Mini Lessons open creator publishing: automatic safety screening, not HQ approval.
-- NON-ACTIVATING. Publishing stays gated by MINI_LESSONS_OPEN_PUBLISHING_ENABLED on the trusted API.
-- authorization-test: public.mini_safety_scans - service-only RLS, no client reads or writes.
create table if not exists public.mini_safety_scans (
 target text not null check (target in ('mini','request','comment')),
 target_id uuid not null,
 owner_id uuid not null references public.profiles(id) on delete cascade,
 attempts integer not null default 1 check (attempts between 1 and 3),
 lease_until timestamptz not null,
 verdict text not null default 'scanning' check (verdict in ('scanning','approved','rejected','unavailable')),
 reason text,
 model text,
 checked_at timestamptz,
 created_at timestamptz not null default now(),
 primary key(target,target_id)
);
alter table public.mini_safety_scans enable row level security;
revoke all on public.mini_safety_scans from public,anon,authenticated;

-- Only a trusted server may lease an item for scanning. A duplicate request cannot
-- create parallel scans, and failed/timeout scans can be retried at most 3 times.
create or replace function public.mini_safety_claim(
 p_target text,p_id uuid,p_owner uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_claimed text;
begin
 if p_target not in ('mini','request','comment') or p_id is null or p_owner is null then
   raise exception 'Invalid safety scan target';
 end if;
 insert into public.mini_safety_scans(target,target_id,owner_id,lease_until)
 values(p_target,p_id,p_owner,now()+interval '90 seconds')
 on conflict(target,target_id) do update
  set attempts=public.mini_safety_scans.attempts+1,
      verdict='scanning', lease_until=now()+interval '90 seconds'
  where public.mini_safety_scans.owner_id=excluded.owner_id
    and public.mini_safety_scans.verdict in ('scanning','unavailable')
    and public.mini_safety_scans.lease_until<now()
    and public.mini_safety_scans.attempts<3
 returning verdict into v_claimed;
 return v_claimed is not null;
end; $$;
revoke all on function public.mini_safety_claim(text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.mini_safety_claim(text,uuid,uuid) to service_role;
-- A trusted screening endpoint must be able to re-check eligibility and parent request
-- without expanding ordinary creator roles or granting content approval to browsers.
grant execute on function public.mini_creator_can_submit(uuid) to service_role;
grant execute on function public.mini_request_available(uuid) to service_role;

-- The scan log is an audit trail, not a queue for HQ approval.
-- Existing author-submitted rows remain private until a server-side scan approves them.
-- No public client gains access to UPDATE the content's status.
-- Automatic safety takedown on concentrated reports is independent of HQ.
create or replace function public.mini_report_safety_hold()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_reports integer;
begin
 if new.reason not in ('unsafe','spam') then return new; end if;
 select count(*) into v_reports from public.mini_reports r
   where r.mini_id=new.mini_id and r.reason in ('unsafe','spam')
     and r.created_at>now()-interval '7 days';
 if v_reports>=5 then
   update public.mini_lessons set status='hidden',
      moderation_note='Temporarily hidden after safety reports',
      updated_at=now()
   where id=new.mini_id and status='approved';
 end if;
 return new;
end; $$;
drop trigger if exists mini_report_safety_hold on public.mini_reports;
create trigger mini_report_safety_hold after insert on public.mini_reports
for each row execute function public.mini_report_safety_hold();

-- Open requests have the same community-report capability as photo-based Minis.
-- authorization-test: public.mini_request_reports - reporter-only, active-account bound, no public user disclosure.
create table if not exists public.mini_request_reports (
 request_id uuid not null references public.mini_requests(id) on delete cascade,
 reporter_id uuid not null references public.profiles(id) on delete cascade,
 reason text not null check (reason in ('unsafe','spam','harassment','personal_information','other')),
 created_at timestamptz not null default now(),
 primary key(request_id,reporter_id)
);
create index if not exists mini_request_reports_created_idx on public.mini_request_reports(reporter_id,created_at desc);
alter table public.mini_request_reports enable row level security;
revoke all on public.mini_request_reports from public,anon,authenticated;
grant select on public.mini_request_reports to authenticated;
grant insert(request_id,reporter_id,reason) on public.mini_request_reports to authenticated;

create policy mini_request_reports_owner_read on public.mini_request_reports
 for select to authenticated using(reporter_id=(select auth.uid()));
create policy mini_request_reports_owner_create on public.mini_request_reports
 for insert to authenticated with check(reporter_id=(select auth.uid())
 and public.mini_active_account(reporter_id)
 and public.mini_request_available(request_id));

create or replace function public.mini_request_report_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_count int;
begin
 if new.reporter_id is distinct from (select auth.uid()) then
   raise exception 'Report identity mismatch' using errcode='42501';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.reporter_id::text||':mini_request_report',0));
 select count(*) into v_count from public.mini_request_reports
 where reporter_id=new.reporter_id and created_at>now()-interval '24 hours';
 if v_count>=20 then raise exception 'Daily report limit reached';end if;
 return new;
end; $$;
drop trigger if exists mini_request_reports_guard on public.mini_request_reports;
create trigger mini_request_reports_guard before insert on public.mini_request_reports
 for each row execute function public.mini_request_report_guard();

-- Hide only after the RLS INSERT check has passed. Avoid flipping visibility
-- in BEFORE INSERT where the policy's approved-request check could invalidate
-- the same report and roll back the automatic safety hold.
create or replace function public.mini_request_report_safety_hold()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_count integer;
begin
 if new.reason not in ('unsafe','spam','harassment','personal_information') then return new;end if;
 select count(*) into v_count from public.mini_request_reports
 where request_id=new.request_id and reason in ('unsafe','spam','harassment','personal_information')
 and created_at>now()-interval '7 days';
 if v_count>=5 then
   update public.mini_requests set status='hidden',
     moderation_note='Temporarily hidden after community safety reports',
     updated_at=now()
   where id=new.request_id and status='approved';
 end if;
 return new;
end; $$;
drop trigger if exists mini_request_report_safety_hold on public.mini_request_reports;
create trigger mini_request_report_safety_hold after insert on public.mini_request_reports
 for each row execute function public.mini_request_report_safety_hold();

comment on table public.mini_safety_scans is 'Automated pre-publication safety scan audit, no HQ approval workflow; deny direct user access.';
comment on function public.mini_report_safety_hold() is 'Fail-safe community report hold; reported content is hidden without requiring HQ manual approval.';
