-- Additive, default-off verified sender identity and persistent candidate blocking.
-- No public sender directory. No direct client access to challenges or tokens.
begin;

create table public.success_wishes_senders (
  id uuid primary key default gen_random_uuid(),
  email_digest text not null unique check (email_digest ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
create table public.success_wishes_sender_challenges (
  email_digest text primary key check (email_digest ~ '^[0-9a-f]{64}$'),
  code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts between 0 and 5),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index success_wishes_challenge_expiry_idx on public.success_wishes_sender_challenges(expires_at);
create table public.success_wishes_sender_sessions (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  sender_id uuid not null references public.success_wishes_senders(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index success_wishes_sender_session_expiry_idx on public.success_wishes_sender_sessions(expires_at);
create table public.success_wishes_blocked_senders (
  inbox_id uuid not null references public.success_wishes_inboxes(id) on delete cascade,
  sender_id uuid not null references public.success_wishes_senders(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(inbox_id,sender_id)
);
alter table public.success_wishes_messages
  add column sender_id uuid references public.success_wishes_senders(id);
create index success_wishes_sender_messages_idx on public.success_wishes_messages(sender_id,inbox_id);

-- access: service-only public.success_wishes_senders
-- authorization-test: public.success_wishes_senders
-- access: service-only public.success_wishes_sender_challenges
-- authorization-test: public.success_wishes_sender_challenges
-- access: service-only public.success_wishes_sender_sessions
-- authorization-test: public.success_wishes_sender_sessions
-- access: service-only public.success_wishes_blocked_senders
-- authorization-test: public.success_wishes_blocked_senders
alter table public.success_wishes_senders enable row level security;
alter table public.success_wishes_sender_challenges enable row level security;
alter table public.success_wishes_sender_sessions enable row level security;
alter table public.success_wishes_blocked_senders enable row level security;
revoke all on public.success_wishes_senders,public.success_wishes_sender_challenges,
  public.success_wishes_sender_sessions,public.success_wishes_blocked_senders
  from public,anon,authenticated;
grant select,insert,update,delete on public.success_wishes_senders,
  public.success_wishes_sender_challenges,public.success_wishes_sender_sessions,
  public.success_wishes_blocked_senders to service_role;

-- Trusted service writes must be attached to a verified sender, and cannot
-- bypass a candidate's active block even under concurrent submissions.
create function public.success_wishes_enforce_sender_block()
returns trigger language plpgsql security invoker set search_path = '' as $sw$
begin
  if new.sender_id is null then
    raise exception 'verified_sender_required' using errcode='23514';
  end if;
  -- Serialize writes per sender+inbox with candidate block RPC.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.inbox_id::text||':'||new.sender_id::text,31537)
  );
  if exists (select 1 from public.success_wishes_blocked_senders b
    where b.inbox_id=new.inbox_id and b.sender_id=new.sender_id) then
    raise exception 'sender_blocked' using errcode='23514';
  end if;
  return new;
end $sw$;
revoke all on function public.success_wishes_enforce_sender_block()
  from public,anon,authenticated;
create trigger success_wishes_verified_sender_guard
before insert or update of sender_id,inbox_id
on public.success_wishes_messages
for each row execute function public.success_wishes_enforce_sender_block();

-- The caller is a trusted server that first verifies the guest inbox session.
-- This function calls the existing school/enrollment/message-action authority
-- and atomically blocks all later messages from the verified sender.
create function public.success_wishes_block_sender(p_inbox_id uuid,p_message_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $sw$
declare v_sender uuid;
begin
  select sender_id into v_sender from public.success_wishes_messages
    where id=p_message_id and inbox_id=p_inbox_id
      and state in ('request','available') and expires_at>now()
    for update;
  if v_sender is null then return false; end if;
  if public.success_wishes_message_action(p_inbox_id,p_message_id,'block',null) is distinct from true
    then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_inbox_id::text||':'||v_sender::text,31537)
  );
  insert into public.success_wishes_blocked_senders(inbox_id,sender_id)
    values(p_inbox_id,v_sender) on conflict do nothing;
  update public.success_wishes_messages set state='blocked'
    where inbox_id=p_inbox_id and sender_id=v_sender and state in ('request','available');
  return true;
end $sw$;
revoke all on function public.success_wishes_block_sender(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.success_wishes_block_sender(uuid,uuid) to service_role;

-- Expired verification material is discarded independently of message content.
create function public.success_wishes_sender_cleanup(p_limit integer default 500)
returns jsonb language plpgsql security invoker set search_path = '' as $sw$
declare a integer; b integer;
begin
  if p_limit is null or p_limit not between 1 and 1000 then raise exception 'invalid_cleanup_limit'; end if;
  with expired as (select email_digest from public.success_wishes_sender_challenges
    where expires_at<=now() or consumed_at<now()-interval '1 hour'
    limit p_limit for update skip locked)
  delete from public.success_wishes_sender_challenges
    where email_digest in(select email_digest from expired);
  get diagnostics a = row_count;
  with expired as (select token_hash from public.success_wishes_sender_sessions
    where expires_at<=now() limit p_limit for update skip locked)
  delete from public.success_wishes_sender_sessions
    where token_hash in(select token_hash from expired);
  get diagnostics b = row_count;
  return jsonb_build_object('challenges_deleted',a,'sessions_deleted',b);
end $sw$;
revoke all on function public.success_wishes_sender_cleanup(integer)
  from public,anon,authenticated;
grant execute on function public.success_wishes_sender_cleanup(integer) to service_role;

-- Optional in disposable CI (pg_cron unavailable); required/verified in live
-- hosting before sender verification may be enabled.
do $sw$
begin
  if exists (select 1 from pg_extension where extname='pg_cron') then
    execute 'select cron.schedule(''success-wishes-sender-expiry'',
      ''*/30 * * * *'', ''select public.success_wishes_sender_cleanup(500);'')';
  end if;
end $sw$;
commit;
