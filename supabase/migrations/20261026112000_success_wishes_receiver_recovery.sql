-- Per-recipient recovery requires both a student-specific secret and control of the registered phone.
alter table public.success_wish_receivers
  add column if not exists recovery_secret_hash text;
alter table public.success_wish_receivers
  add constraint success_wish_receivers_recovery_hash_check
  check (recovery_secret_hash is null or recovery_secret_hash ~ '^[a-f0-9]{64}$');
-- Atomic OTP attempt consumption prevents races from bypassing 5-attempt limit.
create or replace function public.success_wish_consume_receiver_challenge(
  p_challenge uuid, p_receiver uuid, p_digest text
) returns boolean
language plpgsql security invoker set search_path=public as $$
declare was_valid boolean;
begin
  update public.success_wish_receiver_challenges
  set attempts = attempts + 1,
      consumed_at = case when code_hash = p_digest then now() else null end
  where id = p_challenge and receiver_id = p_receiver
    and consumed_at is null and expires_at > now() and attempts < 5
  returning (consumed_at is not null) into was_valid;
  return coalesce(was_valid, false);
end;
$$;
revoke all on function public.success_wish_consume_receiver_challenge(uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.success_wish_consume_receiver_challenge(uuid,uuid,text)
  to service_role;
