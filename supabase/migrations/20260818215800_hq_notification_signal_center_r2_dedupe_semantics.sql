-- HQ Notifications R2 dedupe semantics closure.
-- Periodic scans must not manufacture fresh occurrences, freshness, or unread state when evidence is unchanged.

begin;

create or replace function public.hq_upsert_notification(
  p_fingerprint text,
  p_category text,
  p_severity text,
  p_notification_class text,
  p_title text,
  p_body text,
  p_route text default null,
  p_action_label text default null,
  p_source_type text default null,
  p_source_id text default null,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id uuid;
begin
  if nullif(btrim(p_fingerprint),'') is null then
    raise exception 'notification fingerprint required' using errcode='22023';
  end if;
  if p_severity not in ('info','success','warning','critical') then
    raise exception 'invalid notification severity' using errcode='22023';
  end if;
  if p_notification_class not in ('digest','important','action_required','critical') then
    raise exception 'invalid notification class' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_fingerprint,0));

  select id into v_id
  from public.hq_notifications
  where fingerprint=p_fingerprint
    and status <> 'resolved'
  order by created_at desc
  limit 1
  for update;

  if v_id is null then
    insert into public.hq_notifications(
      category,severity,notification_class,title,body,route,status,metadata,
      source_type,source_id,fingerprint,occurrence_count,first_seen_at,last_seen_at,
      action_label
    ) values (
      p_category,p_severity,p_notification_class,p_title,coalesce(p_body,''),p_route,'unread',
      coalesce(p_metadata,'{}'::jsonb),p_source_type,p_source_id,p_fingerprint,1,now(),now(),
      p_action_label
    )
    returning id into v_id;
  else
    update public.hq_notifications
    set
      category=p_category,
      severity=p_severity,
      notification_class=p_notification_class,
      title=p_title,
      body=coalesce(p_body,''),
      route=p_route,
      source_type=coalesce(p_source_type,source_type),
      source_id=coalesce(p_source_id,source_id),
      action_label=coalesce(p_action_label,action_label),
      occurrence_count=occurrence_count+
        case when coalesce(metadata,'{}'::jsonb) is distinct from coalesce(p_metadata,'{}'::jsonb) then 1 else 0 end,
      last_seen_at=case
        when coalesce(metadata,'{}'::jsonb) is distinct from coalesce(p_metadata,'{}'::jsonb) then now()
        else last_seen_at
      end,
      status=case
        when p_notification_class in ('critical','action_required')
          and coalesce(metadata,'{}'::jsonb) is distinct from coalesce(p_metadata,'{}'::jsonb)
          then 'unread'
        else status
      end,
      metadata=coalesce(metadata,'{}'::jsonb) || coalesce(p_metadata,'{}'::jsonb)
    where id=v_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.hq_upsert_notification(text,text,text,text,text,text,text,text,text,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.hq_upsert_notification(text,text,text,text,text,text,text,text,text,text,jsonb)
  to service_role;

commit;
