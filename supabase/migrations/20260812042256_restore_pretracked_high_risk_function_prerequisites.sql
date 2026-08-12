-- Recovery prerequisite for production functions that existed before the
-- 2026-08-12 explicit EXECUTE hardening migrations but were absent from the
-- repository replay chain. Definitions and effective grants are reconstructed
-- from the production catalog; this migration does not weaken the following
-- security revocations.

create or replace function public.fn_invitation_attempt(p_code text, p_success boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_inv invitations%rowtype;
  v_lock_attempts integer;
  v_lock_minutes integer;
begin
  select value::integer into v_lock_attempts
  from system_config where key = 'invitation_lock_attempts';

  select value::integer into v_lock_minutes
  from system_config where key = 'invitation_lock_minutes';

  if v_lock_attempts is null or v_lock_minutes is null then
    raise exception
      'system_config keys invitation_lock_attempts and invitation_lock_minutes must both be present.';
  end if;

  select * into v_inv
  from invitations
  where code = p_code
  for update;

  if not found then
    return jsonb_build_object('result', 'invalid');
  end if;

  if v_inv.expires_at < now() then
    return jsonb_build_object('result', 'expired');
  end if;

  if v_inv.use_count >= v_inv.max_uses then
    return jsonb_build_object('result', 'exhausted');
  end if;

  if v_inv.locked_until is not null and v_inv.locked_until <= now() then
    update invitations set
      failed_attempts = 0,
      locked_until = null
    where id = v_inv.id
    returning * into v_inv;
  end if;

  if v_inv.locked_until is not null and v_inv.locked_until > now() then
    return jsonb_build_object('result', 'locked', 'locked_until', v_inv.locked_until);
  end if;

  if p_success then
    update invitations set
      use_count = use_count + 1,
      failed_attempts = 0,
      locked_until = null
    where id = v_inv.id;
    return jsonb_build_object('result', 'accepted');
  else
    update invitations set
      failed_attempts = failed_attempts + 1,
      locked_until = case
        when failed_attempts + 1 >= v_lock_attempts
        then now() + (v_lock_minutes || ' minutes')::interval
        else null
      end
    where id = v_inv.id
    returning * into v_inv;

    return jsonb_build_object(
      'result', 'failed',
      'attempts_remaining', greatest(0, v_lock_attempts - v_inv.failed_attempts)
    );
  end if;
end;
$$;

revoke all on function public.fn_invitation_attempt(text, boolean) from public, anon;
grant execute on function public.fn_invitation_attempt(text, boolean) to authenticated, service_role;

create or replace function public.fn_notify_signup_provisioning_failures()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_count int;
  v_sample text;
begin
  select count(*), string_agg(coalesce(email, user_id::text), ', ' order by created_at)
  into v_count, v_sample
  from (
    select email, user_id, created_at
    from public.signup_provisioning_failures
    where notified_at is null
    order by created_at
    limit 10
  ) recent;

  if v_count is null or v_count = 0 then
    return;
  end if;

  insert into public.notifications (id, user_id, title, body, type, created_at)
  select
    gen_random_uuid(),
    '9901f519-d225-4271-a28c-5e7877330e32',
    'Signup provisioning failures detected',
    v_count || ' new account(s) failed profile provisioning and have no role/profile: ' || v_sample
      || '. Check select * from signup_provisioning_failures where notified_at is null.',
    'general',
    now();

  update public.signup_provisioning_failures
  set notified_at = now()
  where notified_at is null;
end;
$$;

revoke all on function public.fn_notify_signup_provisioning_failures() from public, anon, authenticated;
grant execute on function public.fn_notify_signup_provisioning_failures() to service_role;

create or replace function public.hq_derive_product_signal()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_type text;
  v_key text;
  v_pct numeric;
  v_eff numeric;
  v_status text;
begin
  if new.event_type = 'assessment.graded' then
    begin v_pct := (new.metadata->>'percentage')::numeric; exception when others then v_pct := null; end;
    if v_pct is not null and v_pct < 40 then v_type := 'learning.low_score'; end if;
  elsif new.event_type = 'twin.intervention_effect' then
    begin v_eff := (new.metadata->>'effectiveness_score')::numeric; exception when others then v_eff := null; end;
    if v_eff is not null and v_eff < 0.35 then v_type := 'twin.low_effectiveness'; end if;
  elsif new.event_type = 'vibelearn.reading_ended' then
    begin v_pct := coalesce((new.metadata->>'progress_percent')::numeric, 0); exception when others then v_pct := 0; end;
    if v_pct < 20 and coalesce(new.metadata->>'end_reason', '') not in ('completed','complete') then
      v_type := 'vibelearn.abandoned';
    end if;
  elsif new.event_type in ('vibelab.session_status_changed','vibelab.session_completed') then
    v_status := lower(coalesce(new.metadata->>'status',''));
    if v_status in ('failed','error','broken') then v_type := 'vibelab.failed'; end if;
  end if;

  if v_type is not null then
    v_key := 'derived:' || new.id::text || ':' || v_type;
    insert into public.platform_events(
      event_type, actor_id, actor_role, school_id, entity_type, entity_id, metadata, idempotency_key
    ) values (
      v_type, new.actor_id, new.actor_role, new.school_id, new.entity_type, new.entity_id,
      new.metadata || jsonb_build_object('source_event_id', new.id), v_key
    )
    on conflict(idempotency_key) where idempotency_key is not null do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.hq_derive_product_signal() from public, anon, authenticated;
grant execute on function public.hq_derive_product_signal() to service_role;
