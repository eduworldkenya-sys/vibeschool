-- HQ Workforce named-team operating layer.
-- Owner-only founder assignment + human-readable proof surfaces. NON-ACTIVATING.
-- access: service-only public.hq_workforce_founder_assignments
-- authorization-test: public.hq_workforce_founder_assignments denies anon/authenticated direct access.

create table if not exists public.hq_workforce_founder_assignments (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references public.hq_work_items(id) on delete cascade,
  worker_key text not null references public.hq_workforce_workers(worker_key) on update cascade on delete restrict,
  note text,
  status text not null default 'assigned' check(status in ('assigned','working','waiting_review','blocked','completed','cancelled')),
  assigned_by uuid not null default auth.uid(),
  assigned_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  verification jsonb not null default '{}'::jsonb,
  unique(work_item_id)
);

alter table public.hq_workforce_founder_assignments enable row level security;
revoke all on public.hq_workforce_founder_assignments from public,anon,authenticated;
grant select,insert,update on public.hq_workforce_founder_assignments to service_role;

create or replace function public.hq_workforce_assign_work_item(
  p_work_item_id uuid,
  p_worker_key text,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  w public.hq_workforce_workers%rowtype;
  wi public.hq_work_items%rowtype;
  a public.hq_workforce_founder_assignments%rowtype;
begin
  perform public.hq_assert_owner();
  select * into w from public.hq_workforce_workers where worker_key=p_worker_key;
  if not found then raise exception 'worker_not_found'; end if;
  if w.status not in ('active','probation','restricted') then raise exception 'worker_not_assignable:%',w.status; end if;
  select * into wi from public.hq_work_items where id=p_work_item_id for update;
  if not found then raise exception 'work_item_not_found'; end if;
  if wi.status in ('resolved','cancelled') then raise exception 'work_item_closed'; end if;

  insert into public.hq_workforce_founder_assignments(work_item_id,worker_key,note,status,assigned_by)
  values(p_work_item_id,p_worker_key,nullif(trim(p_note),''),'assigned',auth.uid())
  on conflict(work_item_id) do update set
    worker_key=excluded.worker_key,
    note=excluded.note,
    status='assigned',
    assigned_by=auth.uid(),
    assigned_at=clock_timestamp(),
    updated_at=clock_timestamp(),
    completed_at=null,
    verification='{}'::jsonb
  returning * into a;

  update public.hq_work_items
  set status=case when status='open' then 'in_progress' else status end,
      route='worker:'||p_worker_key,
      updated_at=clock_timestamp()
  where id=p_work_item_id;

  return jsonb_build_object('assignment',to_jsonb(a),'consequential_execution',false,'authority_transfer',false);
end $$;

create or replace function public.hq_workforce_update_founder_assignment(
  p_assignment_id uuid,
  p_status text,
  p_verification jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare a public.hq_workforce_founder_assignments%rowtype;
begin
  perform public.hq_assert_owner();
  if p_status not in ('assigned','working','waiting_review','blocked','completed','cancelled') then raise exception 'invalid_assignment_status'; end if;
  select * into a from public.hq_workforce_founder_assignments where id=p_assignment_id for update;
  if not found then raise exception 'assignment_not_found'; end if;

  update public.hq_workforce_founder_assignments set
    status=p_status,
    verification=case when p_status='completed' then coalesce(p_verification,'{}'::jsonb) else verification end,
    updated_at=clock_timestamp(),
    completed_at=case when p_status='completed' then clock_timestamp() else null end
  where id=p_assignment_id returning * into a;

  update public.hq_work_items set
    status=case p_status when 'waiting_review' then 'waiting_approval' when 'completed' then 'resolved' when 'cancelled' then 'cancelled' else 'in_progress' end,
    updated_at=clock_timestamp(),
    resolved_at=case when p_status='completed' then clock_timestamp() else resolved_at end
  where id=a.work_item_id;

  return jsonb_build_object('assignment',to_jsonb(a),'consequential_execution',false,'authority_transfer',false);
end $$;

create or replace function public.hq_workforce_named_team_snapshot(p_recent_limit integer default 80)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare lim integer:=greatest(1,least(coalesce(p_recent_limit,80),200));
begin
  perform public.hq_assert_owner();
  return jsonb_build_object(
    'assignments',coalesce((select jsonb_agg(to_jsonb(x) order by x.updated_at desc) from (
      select a.id,a.work_item_id,a.worker_key,a.note,a.status,a.assigned_at,a.updated_at,a.completed_at,a.verification,
             w.title as technical_title,wi.title as work_title,wi.summary as work_summary,wi.priority,wi.department_key,wi.approval_required
      from public.hq_workforce_founder_assignments a
      join public.hq_workforce_workers w on w.worker_key=a.worker_key
      join public.hq_work_items wi on wi.id=a.work_item_id
      order by a.updated_at desc limit lim
    ) x),'[]'::jsonb),
    'collaborations',coalesce((select jsonb_agg(to_jsonb(x) order by x.updated_at desc) from (
      select c.id,c.objective_id,c.plan_id,c.plan_step_id,c.from_worker_key,c.to_worker_key,c.collaboration_type,c.status,c.authority_transfer,c.evidence,c.created_at,c.updated_at
      from public.hq_workforce_collaborations c
      order by c.updated_at desc limit lim
    ) x),'[]'::jsonb),
    'identity_registry',coalesce((select jsonb_agg(jsonb_build_object(
      'worker_key',w.worker_key,'title',w.title,'status',w.status,'department_key',w.department_key,'manager_worker_key',w.manager_worker_key,
      'permanent',w.status in ('active','probation','restricted'),'updated_at',w.updated_at
    ) order by w.worker_key) from public.hq_workforce_workers w),'[]'::jsonb)
  );
end $$;

revoke all on function public.hq_workforce_assign_work_item(uuid,text,text) from public,anon;
revoke all on function public.hq_workforce_update_founder_assignment(uuid,text,jsonb) from public,anon;
revoke all on function public.hq_workforce_named_team_snapshot(integer) from public,anon;
grant execute on function public.hq_workforce_assign_work_item(uuid,text,text) to authenticated;
grant execute on function public.hq_workforce_update_founder_assignment(uuid,text,jsonb) to authenticated;
grant execute on function public.hq_workforce_named_team_snapshot(integer) to authenticated;

-- Preserve fail-closed runtime posture: this migration must never activate execution.
do $$ declare ec public.hq_workforce_engine_contract%rowtype; begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 or ec.runtime_max_risk<>0 then
    raise exception 'named_team_layer_must_not_activate_runtime';
  end if;
end $$;
