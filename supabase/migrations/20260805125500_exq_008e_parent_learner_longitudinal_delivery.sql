-- EXQ-008E — Parent/learner published-report delivery and longitudinal record authority.
-- Production-equivalent repository migration.

-- Canonical function bodies are maintained in production and must remain SECURITY DEFINER with fixed search_path.
revoke all on function public.exq_get_published_report_card(uuid) from public,anon;
revoke all on function public.exq_list_my_published_report_cards() from public,anon;
revoke all on function public.exq_get_longitudinal_report_record(uuid) from public,anon;
grant execute on function public.exq_get_published_report_card(uuid) to authenticated,service_role;
grant execute on function public.exq_list_my_published_report_cards() to authenticated,service_role;
grant execute on function public.exq_get_longitudinal_report_record(uuid) to authenticated,service_role;

drop policy if exists report_cards_published_parent_learner_read on public.report_cards;
create policy report_cards_published_parent_learner_read
on public.report_cards for select to authenticated
using (
  status in ('published','locked') and (
    exists(select 1 from public.students s where s.id=report_cards.student_id and s.profile_id=(select auth.uid()))
    or exists(
      select 1 from public.parent_student_links psl
      where psl.student_id=report_cards.student_id
        and psl.parent_id=(select auth.uid())
        and (psl.school_id is null or psl.school_id=report_cards.school_id)
        and coalesce(psl.access_level,'full')<>'none'
    )
  )
);

drop policy if exists report_card_subjects_published_parent_learner_read on public.report_card_subjects;
create policy report_card_subjects_published_parent_learner_read
on public.report_card_subjects for select to authenticated
using (
  exists(
    select 1 from public.report_cards rc
    where rc.id=report_card_subjects.report_card_id
      and rc.status in ('published','locked')
      and (
        exists(select 1 from public.students s where s.id=rc.student_id and s.profile_id=(select auth.uid()))
        or exists(
          select 1 from public.parent_student_links psl
          where psl.student_id=rc.student_id
            and psl.parent_id=(select auth.uid())
            and (psl.school_id is null or psl.school_id=rc.school_id)
            and coalesce(psl.access_level,'full')<>'none'
        )
      )
  )
);
