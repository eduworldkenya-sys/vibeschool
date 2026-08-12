begin;

revoke execute on function public.ce_ingest_released_mark_competency() from public;
revoke execute on function public.ce_refresh_mastery_trigger() from public;
revoke execute on function public.fn_invitation_attempt(text, boolean) from public;
revoke execute on function public.fn_notify_signup_provisioning_failures() from public;
revoke execute on function public.hq_derive_product_signal() from public;
revoke execute on function public.increment_view_count(uuid) from public;
revoke execute on function public.increment_view_count(uuid, uuid) from public;
revoke execute on function public.student_get_twin_state() from public;
revoke execute on function public.student_get_twin_tutor_context() from public;

commit;
