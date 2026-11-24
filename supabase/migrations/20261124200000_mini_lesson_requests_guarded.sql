-- Mini Lesson requests: publicly anonymous questions, multiple independently moderated answers.
-- Additive only. Not a production activation instruction.
-- authorization-test: public.mini_requests - owner only Data API SELECT, all public discovery via redacted RPC
-- authorization-test: public.mini_request_supports - self-only SELECT and mutations; no other supporter identities
-- authorization-test: public.mini_lessons.request_id - adult owner may attach only to an approved request
-- All status changes reviewed through service_role and verified HQ permissions.
create table if not exists public.mini_requests (
 id uuid primary key default gen_random_uuid(),
 requester_id uuid not null references public.profiles(id) on delete cascade,
 question text not null check (
   char_length(btrim(question)) between 12 and 240
   and question !~* 'https?://|www\.|[[:alnum:]_.+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}'
   and question !~ '(^|[^0-9])(\+?254|0)[17][0-9]{8}([^0-9]|$)'
 ),
 tags text[] not null check (public.mini_tags_valid(tags)),
 status text not null default 'pending' check (status in ('pending','approved','rejected','hidden')),
 moderation_note text check (moderation_note is null or char_length(moderation_note) <= 500),
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists mini_requests_public_idx on public.mini_requests(created_at desc) where status='approved';
create index if not exists mini_requests_tags_idx on public.mini_requests using gin(tags) where status='approved';
create index if not exists mini_requests_owner_idx on public.mini_requests(requester_id,created_at desc);

create table if not exists public.mini_request_supports (
 request_id uuid not null references public.mini_requests(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(request_id,user_id)
);
create index if not exists mini_request_support_owner_idx on public.mini_request_supports(user_id,created_at desc);

-- A post points to at most one source request; each question may receive many approved Minis.
alter table public.mini_lessons add column if not exists request_id uuid references public.mini_requests(id) on delete set null;
create index if not exists mini_answers_by_request_idx on public.mini_lessons(request_id,published_at desc)
 where status='approved' and request_id is not null;

create or replace function public.mini_request_available(p_request uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(select 1 from public.mini_requests r where r.id=p_request and r.status='approved');
$$;
revoke all on function public.mini_request_available(uuid) from public,anon,authenticated;
grant execute on function public.mini_request_available(uuid) to authenticated;

-- Tighten the existing owner INSERT/UPDATE policies for request references.
drop policy if exists mini_owner_create on public.mini_lessons;
create policy mini_owner_create on public.mini_lessons for insert to authenticated
with check (creator_id=(select auth.uid()) and status in ('draft','pending')
 and public.mini_creator_can_submit(creator_id)
 and (cover_path is null or split_part(cover_path,'/',1)=creator_id::text)
 and (request_id is null or public.mini_request_available(request_id)));
drop policy if exists mini_owner_edit_unpublished on public.mini_lessons;
create policy mini_owner_edit_unpublished on public.mini_lessons for update to authenticated
using (creator_id=(select auth.uid()) and status in ('draft','pending'))
with check (creator_id=(select auth.uid()) and status in ('draft','pending')
 and public.mini_creator_can_submit(creator_id)
 and (cover_path is null or split_part(cover_path,'/',1)=creator_id::text)
 and (request_id is null or public.mini_request_available(request_id)));
grant insert(request_id),update(request_id) on public.mini_lessons to authenticated;

alter table public.mini_requests enable row level security;
alter table public.mini_request_supports enable row level security;
revoke all on public.mini_requests from public,anon,authenticated;
revoke all on public.mini_request_supports from public,anon,authenticated;
grant select on public.mini_requests to authenticated;
grant insert(requester_id,question,tags) on public.mini_requests to authenticated;
grant delete on public.mini_requests to authenticated;
grant select,delete on public.mini_request_supports to authenticated;
grant insert(request_id,user_id) on public.mini_request_supports to authenticated;

create policy mini_requests_owner_read on public.mini_requests for select to authenticated
using (requester_id=(select auth.uid()));
create policy mini_requests_owner_create on public.mini_requests for insert to authenticated
with check (requester_id=(select auth.uid()) and status='pending' and public.mini_active_account(requester_id));
create policy mini_requests_owner_delete_pending on public.mini_requests for delete to authenticated
using (requester_id=(select auth.uid()) and status='pending');
create policy mini_support_read_own on public.mini_request_supports for select to authenticated
using (user_id=(select auth.uid()));
create policy mini_support_write_own on public.mini_request_supports for insert to authenticated
with check (user_id=(select auth.uid()) and public.mini_active_account(user_id)
 and user_id <> (select r.requester_id from public.mini_requests r where r.id=request_id)
 and public.mini_request_available(request_id));
create policy mini_support_delete_own on public.mini_request_supports for delete to authenticated
using (user_id=(select auth.uid()));

-- Count and expose only moderated requests. Never expose requester_id or supporter_ids.
create or replace function public.mini_public_requests(p_limit integer default 40)
returns table(id uuid,question text,tags text[],supporters bigint,explanations bigint,created_at timestamptz)
language sql stable security definer set search_path=''
as $$
 select r.id,r.question,r.tags,
   (1+(select count(*) from public.mini_request_supports s where s.request_id=r.id))::bigint,
   (select count(*) from public.mini_lessons m
      where m.request_id=r.id and m.status='approved' and public.mini_creator_public(m.creator_id))::bigint,
   r.created_at
 from public.mini_requests r
 where r.status='approved'
 order by r.created_at desc
 limit least(greatest(coalesce(p_limit,40),1),100);
$$;
revoke all on function public.mini_public_requests(integer) from public,anon,authenticated;
grant execute on function public.mini_public_requests(integer) to anon,authenticated;

-- Requests by the caller only, including private pending status and answer counts.
create or replace function public.mini_my_requests(p_limit integer default 30)
returns table(id uuid,question text,tags text[],status text,explanations bigint,created_at timestamptz)
language sql stable security invoker set search_path=''
as $$
 select r.id,r.question,r.tags,r.status,
 (select count(*) from public.mini_lessons m
  where m.request_id=r.id and m.status='approved')::bigint,r.created_at
 from public.mini_requests r where r.requester_id=(select auth.uid())
 order by r.created_at desc
 limit least(greatest(coalesce(p_limit,30),1),50);
$$;
revoke all on function public.mini_my_requests(integer) from public,anon,authenticated;
grant execute on function public.mini_my_requests(integer) to authenticated;

-- Concurrent submissions from the same user are serialized before rate checking.
create or replace function public.mini_guard_request_rate()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_actor uuid; v_total integer; v_max integer; v_table text;
begin
 if tg_table_name='mini_requests' then
   v_actor:=new.requester_id; v_max:=5; v_table:='mini_requests';
 else
   v_actor:=new.user_id; v_max:=30; v_table:='mini_request_supports';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||':'||v_table,0));
 if tg_table_name='mini_requests' then
   select count(*) into v_total from public.mini_requests
    where requester_id=v_actor and created_at>now()-interval '24 hours';
 else
   select count(*) into v_total from public.mini_request_supports
    where user_id=v_actor and created_at>now()-interval '24 hours';
 end if;
 if v_total>=v_max then raise exception 'Daily Mini request limit reached' using errcode='P0001'; end if;
 return new;
end; $$;
drop trigger if exists mini_request_rate_guard on public.mini_requests;
create trigger mini_request_rate_guard before insert on public.mini_requests
for each row execute function public.mini_guard_request_rate();
drop trigger if exists mini_support_rate_guard on public.mini_request_supports;
create trigger mini_support_rate_guard before insert on public.mini_request_supports
for each row execute function public.mini_guard_request_rate();

-- The review path is callable only from a service-role server that has verified
-- the human actor's JWT and HQ role. The SQL independently repeats that permission check.
create or replace function public.mini_review_request(
 p_actor uuid,p_id uuid,p_decision text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_member record; v_item public.mini_requests%rowtype; v_before jsonb; v_after jsonb;
begin
 select role,status,permissions,access_expires_at,revoked_at,suspended_at into v_member
 from public.hq_human_members where profile_id=p_actor;
 if not found or v_member.status<>'active'
   or v_member.revoked_at is not null or v_member.suspended_at is not null
   or (v_member.access_expires_at is not null and v_member.access_expires_at<=now())
   or not (v_member.role='founder' or 'content.approve'=any(v_member.permissions)) then
   raise exception 'HQ request review authority denied';
 end if;
 if p_decision not in ('approved','rejected','hidden') then
   raise exception 'Invalid review decision';
 end if;
 if p_decision in ('rejected','hidden') and char_length(btrim(coalesce(p_reason,'')))<8 then
   raise exception 'Review reason required';
 end if;
 select * into v_item from public.mini_requests where id=p_id for update;
 if not found then raise exception 'Request not found'; end if;
 if v_item.requester_id=p_actor then raise exception 'Request owner cannot self-review'; end if;
 if v_item.status not in ('pending','approved') then raise exception 'Request not reviewable'; end if;
 if p_decision='approved' and v_item.status<>'pending' then raise exception 'Request already reviewed'; end if;
 v_before:=jsonb_build_object('status',v_item.status);
 update public.mini_requests set status=p_decision,moderation_note=nullif(btrim(p_reason),''),
  reviewed_at=now(),updated_at=now() where id=p_id;
 v_after:=jsonb_build_object('status',p_decision,'target','request','request_id',p_id,'reason',p_reason);
 insert into public.hq_human_audit_log(actor_id,target_id,action,before_state,after_state,source,request_id)
 values(p_actor,v_item.requester_id,'mini.request.reviewed',v_before,v_after,'human',gen_random_uuid());
 return v_after;
end; $$;
revoke all on function public.mini_review_request(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.mini_review_request(uuid,uuid,text,text) to service_role;

comment on table public.mini_requests is 'Only approved requests are publicly exposed, with requester identity removed by redacted RPC.';
comment on table public.mini_request_supports is 'Private interest signals. No public supporter identity exposure or child profiling.';
