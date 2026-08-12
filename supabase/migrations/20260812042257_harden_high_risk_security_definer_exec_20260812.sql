begin;

revoke execute on function public.ce_ingest_released_mark_competency() from anon;
revoke execute on function public.ce_refresh_mastery_trigger() from anon;
revoke execute on function public.fn_invitation_attempt(text, boolean) from anon;
revoke execute on function public.fn_notify_signup_provisioning_failures() from anon;
revoke execute on function public.hq_data_api_product_gate() from anon;
revoke execute on function public.hq_derive_product_signal() from anon;
revoke execute on function public.increment_publication_reads(uuid, uuid) from anon;
revoke execute on function public.increment_view_count(uuid) from anon;
revoke execute on function public.increment_view_count(uuid, uuid) from anon;
revoke execute on function public.student_get_twin_state() from anon;
revoke execute on function public.student_get_twin_tutor_context() from anon;

commit;
