-- Service-only session revocation for HQ Security & Identity.
-- Access tokens already issued remain valid until their normal JWT expiry;
-- refresh tokens and server-side sessions are invalidated immediately.
create or replace function public.hq_service_revoke_user_sessions(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_count integer := 0;
begin
  update auth.refresh_tokens
     set revoked = true
   where user_id = p_user_id::text
      or session_id in (select id from auth.sessions where user_id = p_user_id);

  delete from auth.sessions where user_id = p_user_id;
  get diagnostics v_session_count = row_count;
  return v_session_count;
end;
$$;

revoke all on function public.hq_service_revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.hq_service_revoke_user_sessions(uuid) to service_role;
comment on function public.hq_service_revoke_user_sessions(uuid) is 'Service-role-only Security & Identity control that revokes refresh tokens and deletes active auth sessions for a user.';
