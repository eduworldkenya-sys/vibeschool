begin;

-- HQ Workroom: structured, auditable coordination attached to real company work.
-- Conversation is deliberately not a free-standing chat stream. Every update and
-- evidence link belongs to an hq_work_item and is owner-authorized at the RPC edge.

create table if not exists public.hq_work_item_updates (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references public.hq_work_items(id) on delete cascade,
  update_type text not null check (update_type in (
    'note','question','answer','evidence','handoff','status','approval','correction','system'
  )),
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  actor_id uuid references public.profiles(id) on delete set null,
  worker_id uuid references public.hq_workforce_workers(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create table if not exists public.hq_work_item_links (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references public.hq_work_items(id) on delete cascade,
  link_type text not null check (link_type in (
    'github_issue','github_pull_request','github_branch','github_commit',
    'supabase_migration','artifact','evidence','runbook'
  )),
  label text not null check (char_length(btrim(label)) between 1 and 240),
  url text not null check (url ~ '^https://'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (work_item_id, url)
);

create index if not exists hq_work_item_updates_item_created_idx
  on public.hq_work_item_updates(work_item_id, created_at desc);
create index if not exists hq_work_item_links_item_created_idx
  on public.hq_work_item_links(work_item_id, created_at desc);

alter table public.hq_work_item_updates enable row level security;
alter table public.hq_work_item_links enable row level security;
revoke all on public.hq_work_item_updates, public.hq_work_item_links from anon, authenticated;

drop policy if exists hq_work_item_updates_owner_select on public.hq_work_item_updates;
create policy hq_work_item_updates_owner_select
  on public.hq_work_item_updates for select to authenticated
  using ((select public.is_platform_owner()));

drop policy if exists hq_work_item_links_owner_select on public.hq_work_item_links;
create policy hq_work_item_links_owner_select
  on public.hq_work_item_links for select to authenticated
  using ((select public.is_platform_owner()));

create or replace function public.hq_workroom_block_update_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'HQ workroom history is append-only';
end;
$$;

drop trigger if exists trg_hq_work_item_updates_immutable on public.hq_work_item_updates;
create trigger trg_hq_work_item_updates_immutable
before update or delete on public.hq_work_item_updates
for each row execute function public.hq_workroom_block_update_delete();

create or replace function public.hq_workroom_get_item(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  perform public.hq_assert_owner();

  select jsonb_build_object(
    'item', to_jsonb(w),
    'updates', coalesce((
      select jsonb_agg(to_jsonb(u) order by u.created_at asc)
      from public.hq_work_item_updates u
      where u.work_item_id = w.id
    ), '[]'::jsonb),
    'links', coalesce((
      select jsonb_agg(to_jsonb(l) order by l.created_at desc)
      from public.hq_work_item_links l
      where l.work_item_id = w.id
    ), '[]'::jsonb),
    'runs', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.created_at desc)
      from (
        select id, lane_key, worker_id, trigger_type, status, authority_result,
               execution_evidence, started_at, completed_at, created_at
        from public.hq_workforce_runs
        where work_item_id = w.id
        order by created_at desc
        limit 25
      ) r
    ), '[]'::jsonb),
    'handoffs', coalesce((
      select jsonb_agg(to_jsonb(h) order by h.created_at desc)
      from (
        select id, handoff_key, from_lane_key, to_lane_key, from_worker_id,
               to_worker_id, reason, status, violation_code, created_at,
               accepted_at, completed_at
        from public.hq_workforce_handoffs
        where work_item_id = w.id
        order by created_at desc
        limit 25
      ) h
    ), '[]'::jsonb)
  ) into v_result
  from public.hq_work_items w
  where w.id = p_id;

  if v_result is null then raise exception 'Work item not found'; end if;
  return v_result;
end;
$$;

create or replace function public.hq_workroom_add_update(
  p_work_item_id uuid,
  p_update_type text,
  p_body text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.hq_assert_owner();
  if p_update_type not in ('note','question','answer','evidence','handoff','status','approval','correction') then
    raise exception 'Invalid update type';
  end if;
  if char_length(btrim(coalesce(p_body,''))) not between 1 and 10000 then
    raise exception 'Update body must contain 1 to 10000 characters';
  end if;
  if jsonb_typeof(coalesce(p_metadata,'{}'::jsonb)) <> 'object' then
    raise exception 'Update metadata must be an object';
  end if;
  if not exists (select 1 from public.hq_work_items where id = p_work_item_id) then
    raise exception 'Work item not found';
  end if;

  insert into public.hq_work_item_updates(work_item_id, update_type, body, actor_id, metadata)
  values (p_work_item_id, p_update_type, btrim(p_body), auth.uid(), coalesce(p_metadata,'{}'::jsonb))
  returning id into v_id;

  update public.hq_work_items set updated_at = now() where id = p_work_item_id;
  return v_id;
end;
$$;

create or replace function public.hq_workroom_add_link(
  p_work_item_id uuid,
  p_link_type text,
  p_label text,
  p_url text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.hq_assert_owner();
  if p_link_type not in ('github_issue','github_pull_request','github_branch','github_commit','supabase_migration','artifact','evidence','runbook') then
    raise exception 'Invalid link type';
  end if;
  if char_length(btrim(coalesce(p_label,''))) not between 1 and 240 then raise exception 'Invalid link label'; end if;
  if coalesce(p_url,'') !~ '^https://' then raise exception 'Evidence links must use HTTPS'; end if;
  if p_link_type like 'github_%' and p_url !~ '^https://github\.com/' then
    raise exception 'GitHub links must use github.com';
  end if;
  if not exists (select 1 from public.hq_work_items where id = p_work_item_id) then raise exception 'Work item not found'; end if;

  insert into public.hq_work_item_links(work_item_id, link_type, label, url, metadata, added_by)
  values (p_work_item_id, p_link_type, btrim(p_label), p_url, coalesce(p_metadata,'{}'::jsonb), auth.uid())
  on conflict (work_item_id, url) do update set label = excluded.label, metadata = excluded.metadata
  returning id into v_id;

  update public.hq_work_items set updated_at = now() where id = p_work_item_id;
  return v_id;
end;
$$;

create or replace function public.hq_workroom_act(
  p_work_item_id uuid,
  p_action text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.hq_work_items%rowtype;
  v_message text;
begin
  perform public.hq_assert_owner();
  if p_action not in ('start','submit_for_approval','authorize','request_correction','accept_verified','cancel') then
    raise exception 'Invalid workroom action';
  end if;
  if char_length(btrim(coalesce(p_reason,''))) not between 3 and 2000 then
    raise exception 'Record a reason of at least 3 characters';
  end if;

  select * into v_item from public.hq_work_items where id = p_work_item_id for update;
  if not found then raise exception 'Work item not found'; end if;
  if v_item.status in ('resolved','cancelled') then raise exception 'Closed work cannot be changed'; end if;

  case p_action
    when 'start' then
      update public.hq_work_items set status='in_progress', owner_id=coalesce(owner_id,auth.uid()), acted_at=now(), updated_at=now() where id=p_work_item_id;
      v_message := 'Work started: ' || btrim(p_reason);
    when 'submit_for_approval' then
      update public.hq_work_items set status='waiting_approval', approval_required=true, updated_at=now() where id=p_work_item_id;
      v_message := 'Submitted for owner approval: ' || btrim(p_reason);
    when 'authorize' then
      if v_item.status <> 'waiting_approval' then raise exception 'Only waiting work can be authorized'; end if;
      update public.hq_work_items set status='in_progress', owner_id=coalesce(owner_id,auth.uid()), acted_at=now(), action_taken=coalesce(action_taken,'{}'::jsonb)||jsonb_build_object('owner_authorized_at',now(),'owner_authorization_reason',btrim(p_reason)), updated_at=now() where id=p_work_item_id;
      v_message := 'Owner authorized the next step: ' || btrim(p_reason);
    when 'request_correction' then
      update public.hq_work_items set status='in_progress', verification_status='failed', verification_evidence=coalesce(verification_evidence,'{}'::jsonb)||jsonb_build_object('correction_requested_at',now(),'reason',btrim(p_reason)), updated_at=now() where id=p_work_item_id;
      v_message := 'Correction requested: ' || btrim(p_reason);
    when 'accept_verified' then
      if v_item.status <> 'waiting_approval' then raise exception 'Only work waiting for approval can be accepted'; end if;
      if coalesce(v_item.verification_status,'pending') not in ('verified','not_required') then raise exception 'Work must be verified before it can be accepted and closed'; end if;
      update public.hq_work_items set status='resolved', owner_id=coalesce(owner_id,auth.uid()), acted_at=now(), resolved_at=now(), action_taken=coalesce(action_taken,'{}'::jsonb)||jsonb_build_object('owner_accepted_at',now(),'owner_acceptance_reason',btrim(p_reason)), updated_at=now() where id=p_work_item_id;
      v_message := 'Verified result accepted and closed: ' || btrim(p_reason);
    when 'cancel' then
      update public.hq_work_items set status='cancelled', owner_id=coalesce(owner_id,auth.uid()), acted_at=now(), action_taken=coalesce(action_taken,'{}'::jsonb)||jsonb_build_object('cancelled_at',now(),'reason',btrim(p_reason)), updated_at=now() where id=p_work_item_id;
      v_message := 'Work cancelled: ' || btrim(p_reason);
  end case;

  insert into public.hq_work_item_updates(work_item_id, update_type, body, actor_id, metadata)
  values (
    p_work_item_id,
    case when p_action in ('authorize','accept_verified') then 'approval' when p_action='request_correction' then 'correction' else 'status' end,
    v_message,
    auth.uid(),
    jsonb_build_object('action',p_action)
  );

  return public.hq_workroom_get_item(p_work_item_id);
end;
$$;

revoke all on function public.hq_workroom_block_update_delete() from public, anon, authenticated;
revoke all on function public.hq_workroom_get_item(uuid) from public, anon;
revoke all on function public.hq_workroom_add_update(uuid,text,text,jsonb) from public, anon;
revoke all on function public.hq_workroom_add_link(uuid,text,text,text,jsonb) from public, anon;
revoke all on function public.hq_workroom_act(uuid,text,text) from public, anon;
grant execute on function public.hq_workroom_get_item(uuid) to authenticated;
grant execute on function public.hq_workroom_add_update(uuid,text,text,jsonb) to authenticated;
grant execute on function public.hq_workroom_add_link(uuid,text,text,text,jsonb) to authenticated;
grant execute on function public.hq_workroom_act(uuid,text,text) to authenticated;

comment on table public.hq_work_item_updates is 'Append-only HQ workroom history. Every update belongs to a real company work item.';
comment on table public.hq_work_item_links is 'Typed evidence and delivery links attached to HQ work items.';

commit;
