begin;

-- Some of these views pre-date the tracked migration chain and may be absent
-- on a clean rebuild. Harden every legacy view that exists without fabricating
-- missing historical objects solely to satisfy this security migration.
do $hardening$
declare
  view_name text;
begin
  foreach view_name in array array[
    'funhub_leaderboard_national',
    'funhub_leaderboard_school',
    'exam_topic_analytics',
    'exam_bank_health',
    'v_trial_balance',
    'v_invoice_aging',
    'v_budget_vs_actual',
    'v_project_summary',
    'v_approvals_queue',
    'student_accessible_resources',
    'vibelearn_leaderboard'
  ]
  loop
    if to_regclass(format('public.%I', view_name)) is not null then
      execute format('alter view public.%I set (security_invoker = true)', view_name);
    end if;
  end loop;
end
$hardening$;

drop policy if exists "Public read vibe covers" on storage.objects;
drop policy if exists "vibe_publication_covers_public_read" on storage.objects;
drop policy if exists "vibe_publication_images_public_read" on storage.objects;
drop policy if exists "Public can read" on storage.objects;

commit;
