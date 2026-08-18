-- HQ Notifications R2 active-window ordering closure.
-- The Signal Center hides resolved rows; therefore active signals must always sort
-- ahead of resolved history before the RPC limit is applied.

begin;

create or replace function public.hq_list_notifications(p_limit integer default 60)
returns table(
  id uuid,
  category text,
  severity text,
  notification_class text,
  title text,
  body text,
  route text,
  action_label text,
  status text,
  occurrence_count integer,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  acknowledged_at timestamptz,
  source_type text,
  source_id text,
  metadata jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path=public
as $$
begin
  perform public.hq_assert_owner();
  return query
  select
    n.id,n.category,n.severity,n.notification_class,n.title,n.body,n.route,n.action_label,
    n.status,n.occurrence_count,n.first_seen_at,n.last_seen_at,n.acknowledged_at,
    n.source_type,n.source_id,n.metadata,n.created_at
  from public.hq_notifications n
  order by
    case when n.status='resolved' then 1 else 0 end,
    case n.notification_class
      when 'critical' then 0
      when 'action_required' then 1
      when 'important' then 2
      else 3
    end,
    case when n.status='unread' then 0 else 1 end,
    n.last_seen_at desc
  limit greatest(1,least(coalesce(p_limit,60),200));
end;
$$;

revoke all on function public.hq_list_notifications(integer) from public,anon;
grant execute on function public.hq_list_notifications(integer) to authenticated;

commit;
