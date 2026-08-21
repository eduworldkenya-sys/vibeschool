begin;

-- HQ Workroom Operating System: least-privilege human coordination, truthful
-- lifecycle, persona/tenant impact and founder-only consequential decisions.

alter table public.hq_work_items
  add column if not exists assignee_id uuid references auth.users(id) on delete set null,
  add column if not exists affected_persona text,
  add column if not exists tenant_id uuid,
  add column if not exists desired_outcome text,
  add column if not exists next_action text,
  add column if not exists blocker text,
  add column if not exists risk_class smallint not null default 1 check (risk_class between 0 and 3),
  add column if not exists authority_required text not null default 'workroom.coordinate',
  add column if not exists evidence_status text not null default 'missing' check (evidence_status in ('missing','partial','ready','verified','failed')),
  add column if not exists delivery_status text not null default 'not_started' check (delivery_status in ('not_started','in_delivery','delivered','confirmed','failed')),
  add column if not exists blocked_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists version bigint not null default 1;

alter table public.hq_work_items drop constraint if exists hq_work_items_status_check;
alter table public.hq_work_items add constraint hq_work_items_status_check check(status in(
  'open','assigned','in_progress','blocked','waiting_evidence','waiting_approval','verifying','failed','delivered','resolved','cancelled'
));

create index if not exists hq_work_items_assignee_active_idx on public.hq_work_items(assignee_id,status,updated_at desc)
  where status not in ('resolved','cancelled');
create index if not exists hq_work_items_attention_idx on public.hq_work_items(priority,status,due_at,updated_at desc)
  where status not in ('resolved','cancelled');
create index if not exists hq_work_items_persona_active_idx on public.hq_work_items(affected_persona,status,updated_at desc)
  where affected_persona is not null and status not in ('resolved','cancelled');

create or replace function public.hq_workroom_has_permission(p_permission text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(
    select 1 from public.hq_human_members hm
    where hm.profile_id=auth.uid() and hm.status='active'
      and (hm.access_expires_at is null or hm.access_expires_at>now())
      and (hm.role='founder' or p_permission=any(coalesce(hm.permissions,array[]::text[])))
  );
$$;
revoke all on function public.hq_workroom_has_permission(text) from public,anon,authenticated;
grant execute on function public.hq_workroom_has_permission(text) to service_role;

create or replace function public.hq_workroom_require(p_permission text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null or not public.hq_workroom_has_permission(p_permission) then
    raise exception 'workroom_permission_denied:%',p_permission using errcode='42501';
  end if;
end $$;
revoke all on function public.hq_workroom_require(text) from public,anon,authenticated;
grant execute on function public.hq_workroom_require(text) to service_role;

-- Existing active non-founder operators gain coordination, never founder authority.
update public.hq_human_members
set permissions=(select array_agg(distinct p order by p) from unnest(
  coalesce(permissions,array[]::text[]) || array['workroom.view','workroom.update','workroom.coordinate','workroom.verify']
) p), updated_at=clock_timestamp()
where status='active' and role in ('partner_admin','hq_admin');

delete from public.platform_owners po using public.hq_human_members hm
where po.profile_id=hm.profile_id and po.note='hq_partner_admin' and hm.role<>'founder';

create or replace function public.hq_workroom_actor_context()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare hm public.hq_human_members%rowtype;
begin
  perform public.hq_workroom_require('workroom.view');
  select * into hm from public.hq_human_members where profile_id=auth.uid();
  return jsonb_build_object(
    'profile_id',hm.profile_id,'display_name',nullif(btrim(coalesce(hm.display_name,'')),''),
    'role',hm.role,'title',hm.title,'department',hm.department,
    'permissions',hm.permissions,
    'can_coordinate',hm.role='founder' or 'workroom.coordinate'=any(hm.permissions),
    'can_verify',hm.role='founder' or 'workroom.verify'=any(hm.permissions),
    'can_authorize',hm.role='founder' or 'workroom.authorize'=any(hm.permissions),
    'can_cancel',hm.role='founder' or 'workroom.cancel'=any(hm.permissions),
    'is_founder',hm.role='founder'
  );
end $$;

create or replace function public.hq_workroom_list(p_view text default 'attention',p_department text default null,p_limit int default 300)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_actor jsonb; v_items jsonb; v_counts jsonb;
begin
  perform public.hq_workroom_require('workroom.view');
  v_actor:=public.hq_workroom_actor_context();
  select coalesce(jsonb_agg(to_jsonb(x) order by x.attention_rank,x.updated_at desc),'[]'::jsonb) into v_items
  from (
    select w.*,
      case when w.status in('failed','blocked') or w.verification_status='failed' then 0
           when w.priority='critical' then 1 when w.due_at<now() then 2
           when w.status='waiting_approval' then 3 when w.assignee_id is null then 4
           when w.evidence_status in('missing','partial') then 5 else 6 end attention_rank
    from public.hq_work_items w
    where (p_department is null or w.department_key=p_department)
      and case p_view
        when 'my_work' then w.assignee_id=auth.uid() and w.status not in('resolved','cancelled')
        when 'founder_decisions' then w.status='waiting_approval' and w.authority_required in('workroom.authorize','founder.approve')
        when 'journeys' then w.affected_persona in('school_admin','teacher','student','parent') and w.status not in('resolved','cancelled')
        when 'active' then w.status not in('resolved','cancelled')
        when 'closed' then w.status in('resolved','cancelled')
        else w.status in('failed','blocked','waiting_approval') or w.priority in('critical','high') or w.due_at<now() or w.assignee_id is null or w.evidence_status in('missing','partial')
      end
    limit greatest(1,least(coalesce(p_limit,300),500))
  ) x;
  select jsonb_build_object(
    'active',count(*) filter(where status not in('resolved','cancelled')),
    'mine',count(*) filter(where assignee_id=auth.uid() and status not in('resolved','cancelled')),
    'blocked',count(*) filter(where status in('blocked','failed')),
    'waiting_approval',count(*) filter(where status='waiting_approval'),
    'overdue',count(*) filter(where due_at<now() and status not in('resolved','cancelled')),
    'unassigned',count(*) filter(where assignee_id is null and status not in('resolved','cancelled')),
    'journeys_at_risk',count(*) filter(where affected_persona in('school_admin','teacher','student','parent') and status not in('resolved','cancelled'))
  ) into v_counts from public.hq_work_items;
  return jsonb_build_object('actor',v_actor,'counts',v_counts,'items',v_items,'generated_at',clock_timestamp());
end $$;

create or replace function public.hq_workroom_assign(p_work_item_id uuid,p_assignee_id uuid,p_next_action text,p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.hq_work_items%rowtype;
begin
  perform public.hq_workroom_require('workroom.coordinate');
  if char_length(btrim(coalesce(p_next_action,''))) not between 3 and 1000 then raise exception 'workroom_next_action_required'; end if;
  if not exists(select 1 from public.hq_human_members where profile_id=p_assignee_id and status='active' and (access_expires_at is null or access_expires_at>now())) then raise exception 'workroom_assignee_not_active'; end if;
  select * into w from public.hq_work_items where id=p_work_item_id for update;
  if not found then raise exception 'workroom_item_not_found'; end if;
  if w.version<>p_expected_version then raise exception 'workroom_stale_item'; end if;
  if w.status in('resolved','cancelled') then raise exception 'workroom_closed_item'; end if;
  update public.hq_work_items set assignee_id=p_assignee_id,owner_id=p_assignee_id,status=case when status='open' then 'assigned' else status end,
    next_action=btrim(p_next_action),updated_at=clock_timestamp(),version=version+1 where id=p_work_item_id;
  insert into public.hq_work_item_updates(work_item_id,update_type,body,actor_id,metadata)
  values(p_work_item_id,'handoff','Assigned accountable work: '||btrim(p_next_action),auth.uid(),jsonb_build_object('assignee_id',p_assignee_id));
  return public.hq_workroom_get_item(p_work_item_id);
end $$;

create or replace function public.hq_workroom_act(p_work_item_id uuid,p_action text,p_reason text,p_expected_version bigint default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.hq_work_items%rowtype; v_message text; v_permission text;
begin
  if p_action not in('start','block','resume','submit_evidence','submit_for_approval','authorize','request_correction','accept_verified','mark_delivered','confirm_delivery','cancel') then raise exception 'workroom_invalid_action'; end if;
  v_permission:=case when p_action in('authorize','accept_verified') then 'workroom.authorize'
    when p_action='cancel' then 'workroom.cancel' when p_action='request_correction' then 'workroom.verify' else 'workroom.coordinate' end;
  perform public.hq_workroom_require(v_permission);
  if char_length(btrim(coalesce(p_reason,''))) not between 3 and 2000 then raise exception 'workroom_reason_required'; end if;
  select * into w from public.hq_work_items where id=p_work_item_id for update;
  if not found then raise exception 'workroom_item_not_found'; end if;
  if p_expected_version is not null and w.version<>p_expected_version then raise exception 'workroom_stale_item'; end if;
  if w.status in('resolved','cancelled') then raise exception 'workroom_closed_item'; end if;
  if p_action='start' and w.status not in('open','assigned') then raise exception 'workroom_transition_denied'; end if;
  if p_action='block' and w.status not in('assigned','in_progress','waiting_evidence','verifying') then raise exception 'workroom_transition_denied'; end if;
  if p_action='resume' and w.status not in('blocked','failed') then raise exception 'workroom_transition_denied'; end if;
  if p_action='submit_evidence' and w.status not in('in_progress','waiting_evidence','failed') then raise exception 'workroom_transition_denied'; end if;
  if p_action='submit_for_approval' and w.status not in('in_progress','verifying','delivered') then raise exception 'workroom_transition_denied'; end if;
  if p_action in('authorize','accept_verified') and w.status<>'waiting_approval' then raise exception 'workroom_transition_denied'; end if;
  if p_action='accept_verified' and coalesce(w.verification_status,'pending') not in('verified','not_required') then raise exception 'workroom_verification_required'; end if;
  if p_action='mark_delivered' and w.status not in('in_progress','verifying') then raise exception 'workroom_transition_denied'; end if;
  if p_action='confirm_delivery' and w.status<>'delivered' then raise exception 'workroom_transition_denied'; end if;

  update public.hq_work_items set
    status=case p_action when 'start' then 'in_progress' when 'block' then 'blocked' when 'resume' then 'in_progress'
      when 'submit_evidence' then 'verifying' when 'submit_for_approval' then 'waiting_approval' when 'authorize' then 'in_progress'
      when 'request_correction' then 'failed' when 'accept_verified' then 'resolved' when 'mark_delivered' then 'delivered'
      when 'confirm_delivery' then 'resolved' when 'cancel' then 'cancelled' end,
    owner_id=coalesce(owner_id,auth.uid()),assignee_id=coalesce(assignee_id,auth.uid()),acted_at=clock_timestamp(),
    blocker=case when p_action='block' then btrim(p_reason) when p_action='resume' then null else blocker end,
    blocked_at=case when p_action='block' then clock_timestamp() when p_action='resume' then null else blocked_at end,
    evidence_status=case when p_action='submit_evidence' then 'ready' when p_action='request_correction' then 'failed' when p_action='accept_verified' then 'verified' else evidence_status end,
    verification_status=case when p_action='request_correction' then 'failed' else verification_status end,
    delivery_status=case when p_action='mark_delivered' then 'delivered' when p_action='confirm_delivery' then 'confirmed' else delivery_status end,
    delivered_at=case when p_action='mark_delivered' then clock_timestamp() else delivered_at end,
    resolved_at=case when p_action in('accept_verified','confirm_delivery') then clock_timestamp() else resolved_at end,
    approval_required=case when p_action='submit_for_approval' then true else approval_required end,
    action_taken=coalesce(action_taken,'{}'::jsonb)||jsonb_build_object('last_action',p_action,'acted_by',auth.uid(),'reason',btrim(p_reason),'at',clock_timestamp()),
    updated_at=clock_timestamp(),version=version+1 where id=p_work_item_id;
  v_message:=replace(initcap(replace(p_action,'_',' ')),'  ',' ')||': '||btrim(p_reason);
  insert into public.hq_work_item_updates(work_item_id,update_type,body,actor_id,metadata)
  values(p_work_item_id,case when p_action in('authorize','accept_verified') then 'approval' when p_action='request_correction' then 'correction' else 'status' end,v_message,auth.uid(),jsonb_build_object('action',p_action,'permission',v_permission));
  return public.hq_workroom_get_item(p_work_item_id);
end $$;

create or replace function public.hq_workroom_get_item(p_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  perform public.hq_workroom_require('workroom.view');
  select jsonb_build_object('actor',public.hq_workroom_actor_context(),'item',to_jsonb(w),
    'updates',coalesce((select jsonb_agg(to_jsonb(u) order by u.created_at) from public.hq_work_item_updates u where u.work_item_id=w.id),'[]'::jsonb),
    'links',coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at desc) from public.hq_work_item_links l where l.work_item_id=w.id),'[]'::jsonb),
    'runs',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from (select id,lane_key,worker_id,trigger_type,status,authority_result,execution_evidence,started_at,completed_at,created_at from public.hq_workforce_runs where work_item_id=w.id order by created_at desc limit 25)r),'[]'::jsonb),
    'handoffs',coalesce((select jsonb_agg(to_jsonb(h) order by h.created_at desc) from (select id,handoff_key,from_lane_key,to_lane_key,from_worker_id,to_worker_id,reason,status,violation_code,created_at,accepted_at,completed_at from public.hq_workforce_handoffs where work_item_id=w.id order by created_at desc limit 25)h),'[]'::jsonb)
  ) into v_result from public.hq_work_items w where w.id=p_id;
  if v_result is null then raise exception 'workroom_item_not_found'; end if;
  return v_result;
end $$;

create or replace function public.hq_workroom_add_update(p_work_item_id uuid,p_update_type text,p_body text,p_metadata jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  perform public.hq_workroom_require('workroom.update');
  if p_update_type not in('note','question','answer','evidence','handoff','status','approval','correction') then raise exception 'workroom_invalid_update_type'; end if;
  if char_length(btrim(coalesce(p_body,''))) not between 1 and 10000 then raise exception 'workroom_invalid_update_body'; end if;
  if jsonb_typeof(coalesce(p_metadata,'{}'::jsonb))<>'object' then raise exception 'workroom_invalid_metadata'; end if;
  if not exists(select 1 from public.hq_work_items where id=p_work_item_id and status not in('resolved','cancelled')) then raise exception 'workroom_item_not_active'; end if;
  insert into public.hq_work_item_updates(work_item_id,update_type,body,actor_id,metadata) values(p_work_item_id,p_update_type,btrim(p_body),auth.uid(),coalesce(p_metadata,'{}'::jsonb)) returning id into v_id;
  update public.hq_work_items set updated_at=clock_timestamp(),version=version+1 where id=p_work_item_id;
  return v_id;
end $$;

create or replace function public.hq_workroom_add_link(p_work_item_id uuid,p_link_type text,p_label text,p_url text,p_metadata jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  perform public.hq_workroom_require('workroom.update');
  if p_link_type not in('github_issue','github_pull_request','github_branch','github_commit','supabase_migration','artifact','evidence','runbook') then raise exception 'workroom_invalid_link_type'; end if;
  if char_length(btrim(coalesce(p_label,''))) not between 1 and 240 or coalesce(p_url,'')!~'^https://' then raise exception 'workroom_invalid_link'; end if;
  if p_link_type like 'github_%' and p_url!~'^https://github\\.com/' then raise exception 'workroom_invalid_github_link'; end if;
  if not exists(select 1 from public.hq_work_items where id=p_work_item_id and status not in('resolved','cancelled')) then raise exception 'workroom_item_not_active'; end if;
  insert into public.hq_work_item_links(work_item_id,link_type,label,url,metadata,added_by) values(p_work_item_id,p_link_type,btrim(p_label),p_url,coalesce(p_metadata,'{}'::jsonb),auth.uid()) on conflict(work_item_id,url) do nothing returning id into v_id;
  if v_id is null then raise exception 'workroom_evidence_link_already_exists'; end if;
  update public.hq_work_items set updated_at=clock_timestamp(),version=version+1 where id=p_work_item_id;
  return v_id;
end $$;

-- Read and mutation RPC grants remain authenticated, with authorization enforced inside each function.
revoke all on function public.hq_workroom_actor_context(),public.hq_workroom_list(text,text,int),public.hq_workroom_assign(uuid,uuid,text,bigint),public.hq_workroom_act(uuid,text,text,bigint),public.hq_workroom_get_item(uuid),public.hq_workroom_add_update(uuid,text,text,jsonb),public.hq_workroom_add_link(uuid,text,text,text,jsonb) from public,anon;
grant execute on function public.hq_workroom_actor_context(),public.hq_workroom_list(text,text,int),public.hq_workroom_assign(uuid,uuid,text,bigint),public.hq_workroom_act(uuid,text,text,bigint),public.hq_workroom_get_item(uuid),public.hq_workroom_add_update(uuid,text,text,jsonb),public.hq_workroom_add_link(uuid,text,text,text,jsonb) to authenticated;
drop function if exists public.hq_workroom_act(uuid,text,text);

-- Direct table reads follow the same view permission; writes remain RPC-only.
drop policy if exists hq_work_items_owner_select on public.hq_work_items;
create policy hq_work_items_hq_view on public.hq_work_items for select to authenticated using(public.hq_workroom_has_permission('workroom.view'));
drop policy if exists hq_work_item_updates_owner_select on public.hq_work_item_updates;
create policy hq_work_item_updates_hq_view on public.hq_work_item_updates for select to authenticated using(public.hq_workroom_has_permission('workroom.view'));
drop policy if exists hq_work_item_links_owner_select on public.hq_work_item_links;
create policy hq_work_item_links_hq_view on public.hq_work_item_links for select to authenticated using(public.hq_workroom_has_permission('workroom.view'));

commit;
