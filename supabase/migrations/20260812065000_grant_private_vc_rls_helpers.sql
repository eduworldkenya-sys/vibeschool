begin;

grant execute on function private.vc_user_is_thread_participant(uuid) to authenticated;
grant execute on function private.vc_user_is_thread_admin(uuid) to authenticated;

commit;
