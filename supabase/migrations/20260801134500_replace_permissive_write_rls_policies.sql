begin;

-- Duplicate security-hardening step retained for production-ledger/history parity.
-- Harden only relations present in the reconstructed schema.
do $rls$
begin
  if to_regclass('public.curriculum') is not null then
    drop policy if exists curriculum_insert on public.curriculum;
    create policy curriculum_insert on public.curriculum for insert to authenticated
    with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'super_admin')));

    drop policy if exists curriculum_update on public.curriculum;
    create policy curriculum_update on public.curriculum for update to authenticated
    using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'super_admin')))
    with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'super_admin')));
  end if;

  if to_regclass('public.exam_question_bank') is not null then
    drop policy if exists exam_bank_insert on public.exam_question_bank;
    create policy exam_bank_insert on public.exam_question_bank for insert to authenticated
    with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('teacher', 'admin', 'super_admin')));

    drop policy if exists exam_bank_update on public.exam_question_bank;
    create policy exam_bank_update on public.exam_question_bank for update to authenticated
    using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('teacher', 'admin', 'super_admin')))
    with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('teacher', 'admin', 'super_admin')));
  end if;

  if to_regclass('public.exam_sessions') is not null then
    drop policy if exists exam_sessions_insert on public.exam_sessions;
    create policy exam_sessions_insert on public.exam_sessions for insert to anon, authenticated
    with check (
      ((select auth.uid()) is not null and user_id = (select auth.uid()) and anon_token is null)
      or ((select auth.uid()) is null and user_id is null and anon_token is not null and length(anon_token) >= 32)
    );
  end if;

  if to_regclass('public.exam_flags') is not null and to_regclass('public.exam_sessions') is not null then
    drop policy if exists exam_flags_insert on public.exam_flags;
    create policy exam_flags_insert on public.exam_flags for insert to anon, authenticated
    with check (
      session_id is not null
      and exists (
        select 1 from public.exam_sessions s where s.id = exam_flags.session_id
          and (
            ((select auth.uid()) is not null and s.user_id = (select auth.uid()) and exam_flags.user_id = (select auth.uid()))
            or ((select auth.uid()) is null and s.user_id is null and s.anon_token is not null and length(s.anon_token) >= 32 and exam_flags.user_id is null)
          )
      )
    );
  end if;

  if to_regclass('public.homework_answers') is not null
     and to_regclass('public.homework_submissions') is not null
     and to_regclass('public.students') is not null
     and to_regclass('public.homework') is not null then
    drop policy if exists "insert answers" on public.homework_answers;
    create policy "insert answers" on public.homework_answers for insert to authenticated
    with check (
      submission_id is not null
      and exists (
        select 1 from public.homework_submissions hs
        left join public.students st on st.id = hs.student_id
        left join public.homework h on h.id = hs.homework_id
        where hs.id = homework_answers.submission_id
          and (st.profile_id = (select auth.uid()) or h.teacher_id = (select auth.uid()))
      )
    );
  end if;

  if to_regclass('public.vibe_credit_transactions') is not null then
    drop policy if exists "Service role manages transactions" on public.vibe_credit_transactions;
  end if;

  if to_regclass('public.vibelearn_content_views') is not null and to_regclass('public.students') is not null then
    drop policy if exists "students insert views" on public.vibelearn_content_views;
    create policy "students insert views" on public.vibelearn_content_views for insert to authenticated
    with check (
      student_id is not null
      and exists (select 1 from public.students st where st.id = vibelearn_content_views.student_id and st.profile_id = (select auth.uid()))
    );
  end if;
end
$rls$;

commit;
