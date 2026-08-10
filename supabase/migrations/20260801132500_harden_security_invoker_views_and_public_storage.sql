begin;

do $$
declare
  v_view text;
begin
  foreach v_view in array array[
    'funhub_leaderboard_national','funhub_leaderboard_school',
    'exam_topic_analytics','exam_bank_health','v_trial_balance',
    'v_invoice_aging','v_budget_vs_actual','v_project_summary',
    'v_approvals_queue','student_accessible_resources','vibelearn_leaderboard'
  ] loop
    if to_regclass('public.' || v_view) is not null then
      execute format(
        'alter view public.%I set (security_invoker = true)',
        v_view
      );
    else
      raise notice 'View %.% absent; skipping security-invoker hardening',
        'public', v_view;
    end if;
  end loop;
end;
$$;

drop policy if exists "Public read vibe covers" on storage.objects;
drop policy if exists "vibe_publication_covers_public_read" on storage.objects;
drop policy if exists "vibe_publication_images_public_read" on storage.objects;
drop policy if exists "Public can read" on storage.objects;

commit;
