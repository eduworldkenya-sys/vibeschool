begin;

alter view public.funhub_leaderboard_national set (security_invoker = true);
alter view public.funhub_leaderboard_school set (security_invoker = true);
alter view public.exam_topic_analytics set (security_invoker = true);
alter view public.exam_bank_health set (security_invoker = true);
alter view public.v_trial_balance set (security_invoker = true);
alter view public.v_invoice_aging set (security_invoker = true);
alter view public.v_budget_vs_actual set (security_invoker = true);
alter view public.v_project_summary set (security_invoker = true);
alter view public.v_approvals_queue set (security_invoker = true);
alter view public.student_accessible_resources set (security_invoker = true);
alter view public.vibelearn_leaderboard set (security_invoker = true);

drop policy if exists "Public read vibe covers" on storage.objects;
drop policy if exists "vibe_publication_covers_public_read" on storage.objects;
drop policy if exists "vibe_publication_images_public_read" on storage.objects;
drop policy if exists "Public can read" on storage.objects;

commit;
