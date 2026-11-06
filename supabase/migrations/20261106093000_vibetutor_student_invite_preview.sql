-- Read-only, token-scoped preview. Possession of a link is not acceptance.
-- Only the signed-in learner can see the tutor's public listing name; no student
-- identities, contact details or school records are returned.
begin;
create or replace function public.vibetutor_preview_student_invite(p_token uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_tutor text; v_status text;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if not exists (select 1 from public.students s where s.profile_id = auth.uid() and s.deleted_at is null)
    then raise exception 'An active learner account is required'; end if;
  select t.display_name, i.status into v_tutor, v_status
    from public.vibetutor_student_invitations i
    join public.vibetutor_tutors t on t.profile_id = i.tutor_id
    where i.token = p_token;
  if v_tutor is null or v_status <> 'open' then
    return jsonb_build_object('available', false);
  end if;
  return jsonb_build_object('available', true, 'tutor', v_tutor);
end $$;
revoke all on function public.vibetutor_preview_student_invite(uuid) from public, anon;
grant execute on function public.vibetutor_preview_student_invite(uuid) to authenticated;
commit;
