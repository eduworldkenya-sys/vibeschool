-- TASK 16: permit exactly one immutable envelope -> activation-event seal.
-- 20260819081200 creates the envelope before its transition-event identity is known.
-- This migration allows only NULL -> non-NULL activation_event_id while the envelope
-- remains otherwise byte-for-byte unchanged and active.

create or replace function public.hq_workforce_guard_runtime_activation_envelope_immutable()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if tg_op='DELETE' then
    raise exception 'runtime_activation_envelope_delete_forbidden';
  end if;

  if old.status='active'
     and old.activation_event_id is null
     and new.activation_event_id is not null
     and old.id=new.id
     and old.owner_id=new.owner_id
     and old.runtime_state_version=new.runtime_state_version
     and old.autonomy_level=new.autonomy_level
     and old.max_risk=new.max_risk
     and old.authority_grant_ids=new.authority_grant_ids
     and old.authority_snapshot=new.authority_snapshot
     and old.policy_snapshot=new.policy_snapshot
     and old.max_concurrency=new.max_concurrency
     and old.max_executions_per_minute=new.max_executions_per_minute
     and old.status=new.status
     and old.activated_at=new.activated_at
     and old.expires_at=new.expires_at
     and old.stopped_at is not distinct from new.stopped_at
     and old.stop_reason is not distinct from new.stop_reason
     and old.evidence=new.evidence then
    return new;
  end if;

  if old.id<>new.id
     or old.activation_event_id is distinct from new.activation_event_id
     or old.owner_id<>new.owner_id
     or old.runtime_state_version<>new.runtime_state_version
     or old.autonomy_level<>new.autonomy_level
     or old.max_risk<>new.max_risk
     or old.authority_grant_ids<>new.authority_grant_ids
     or old.authority_snapshot<>new.authority_snapshot
     or old.policy_snapshot<>new.policy_snapshot
     or old.max_concurrency<>new.max_concurrency
     or old.max_executions_per_minute<>new.max_executions_per_minute
     or old.activated_at<>new.activated_at
     or old.expires_at<>new.expires_at then
    raise exception 'runtime_activation_envelope_governance_fields_immutable';
  end if;

  if old.status<>'active' then
    raise exception 'runtime_activation_envelope_terminal';
  end if;

  if new.status not in ('stopped','global_stopped','expired')
     or new.stopped_at is null
     or char_length(btrim(coalesce(new.stop_reason,'')))<3 then
    raise exception 'runtime_activation_envelope_invalid_close';
  end if;

  return new;
end $$;

revoke all on function public.hq_workforce_guard_runtime_activation_envelope_immutable()
  from public,anon,authenticated,service_role;
