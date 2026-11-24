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

comment on table public.mini_safety_scans is 'Automated pre-publication safety scan audit, no HQ approval workflow; deny direct user access.';
comment on function public.mini_report_safety_hold() is 'Fail-safe community report hold; reported content is hidden without requiring HQ manual approval.';
