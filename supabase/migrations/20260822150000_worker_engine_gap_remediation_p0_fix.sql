-- P0 production repair: PostgreSQL make_interval(hours => numeric) is invalid.
-- Preserve fractional-hour SLA support without changing the control contract.
create or replace function public.hq_workforce_escalate_waiting_approvals(
  p_after_hours numeric default 24
) returns integer
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  r record;
  v_level integer;
  v_count integer := 0;
  v_fingerprint text;
begin
  if coalesce(p_after_hours,24) <= 0 then
    raise exception 'approval_escalation_window_invalid';
  end if;

  for r in
    select id,department_key,priority,title,summary,created_at,due_at,evidence
    from public.hq_work_items
    where status='waiting_approval'
      and approval_required=true
      and created_at < clock_timestamp() - (p_after_hours * interval '1 hour')
    order by case priority when 'critical' then 1 when 'high' then 2 when 'normal' then 3 else 4 end,
             created_at asc
  loop
    v_level := greatest(1,coalesce((r.evidence->>'approval_escalation_level')::integer,0)+1);

    update public.hq_work_items
    set evidence = coalesce(evidence,'{}'::jsonb) || jsonb_build_object(
      'approval_escalation_level',v_level,
      'approval_escalated_at',clock_timestamp(),
      'approval_escalation_reason','approval_required exceeded configured SLA',
      'approval_escalation_owner','founder'
    ),
    updated_at=clock_timestamp()
    where id=r.id;

    v_fingerprint := 'workforce:approval-escalation:' || r.id::text;
    perform public.hq_upsert_notification(
      v_fingerprint,
      'workforce',
      case when r.priority='critical' then 'critical' else 'warning' end,
      case when r.priority='critical' then 'critical' else 'action_required' end,
      'Approval is overdue: ' || r.title,
      coalesce(r.summary,'Work is waiting for human approval.') ||
        ' Approval has exceeded the ' || p_after_hours || '-hour SLA; escalation level ' || v_level || '.',
      '/hq',
      'Review approval',
      'hq_work_item',
      r.id::text,
      jsonb_build_object(
        'work_item_id',r.id,
        'department',r.department_key,
        'priority',r.priority,
        'approval_escalation_level',v_level,
        'due_at',r.due_at,
        'created_at',r.created_at
      )
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
