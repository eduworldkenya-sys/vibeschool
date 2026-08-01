begin;

-- Global curriculum is readable by signed-in users, but only platform
-- administrators may mutate it through the Data API. Backend service_role
-- jobs continue to bypass RLS.
drop policy if exists curriculum_insert on public.curriculum;
create policy curriculum_insert
on public.curriculum for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('admin', 'super_admin')
  )
);

drop policy if exists curriculum_update on public.curriculum;
create policy curriculum_update
on public.curriculum for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('admin', 'super_admin')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('admin', 'super_admin')
  )
);

-- Exam bank authoring is restricted to authenticated teacher/admin roles.
drop policy if exists exam_bank_insert on public.exam_question_bank;
create policy exam_bank_insert
on public.exam_question_bank for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('teacher', 'admin', 'super_admin')
  )
);

drop policy if exists exam_bank_update on public.exam_question_bank;
create policy exam_bank_update
on public.exam_question_bank for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('teacher', 'admin', 'super_admin')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('teacher', 'admin', 'super_admin')
  )
);

-- A session may be owned by the signed-in user or use a sufficiently strong
-- anonymous token. This preserves anonymous exam sessions without a true check.
drop policy if exists exam_sessions_insert on public.exam_sessions;
create policy exam_sessions_insert
on public.exam_sessions for insert
to anon, authenticated
with check (
  (
    (select auth.uid()) is not null
    and user_id = (select auth.uid())
    and anon_token is null
  )
  or
  (
    (select auth.uid()) is null
    and user_id is null
    and anon_token is not null
    and length(anon_token) >= 32
  )
);

-- Flags must belong to the caller's own signed-in session, or to a valid
-- anonymous session identified by its stored anonymous token/session row.
drop policy if exists exam_flags_insert on public.exam_flags;
create policy exam_flags_insert
on public.exam_flags for insert
to anon, authenticated
with check (
  session_id is not null
  and exists (
    select 1
    from public.exam_sessions s
    where s.id = exam_flags.session_id
      and (
        (
          (select auth.uid()) is not null
          and s.user_id = (select auth.uid())
          and exam_flags.user_id = (select auth.uid())
        )
        or
        (
          (select auth.uid()) is null
          and s.user_id is null
          and s.anon_token is not null
          and length(s.anon_token) >= 32
          and exam_flags.user_id is null
        )
      )
  )
);

-- Answers must attach to a submission owned by the signed-in learner or to
-- homework owned by the signed-in teacher.
drop policy if exists "insert answers" on public.homework_answers;
create policy "insert answers"
on public.homework_answers for insert
to authenticated
with check (
  submission_id is not null
  and exists (
    select 1
    from public.homework_submissions hs
    left join public.students st on st.id = hs.student_id
    left join public.homework h on h.id = hs.homework_id
    where hs.id = homework_answers.submission_id
      and (
        st.profile_id = (select auth.uid())
        or h.teacher_id = (select auth.uid())
      )
  )
);

-- service_role bypasses RLS; an ALL/true policy granted to PUBLIC exposed the
-- complete credit ledger to every API role.
drop policy if exists "Service role manages transactions" on public.vibe_credit_transactions;

-- Direct content-view inserts are limited to the signed-in learner identity.
-- Anonymous/public counters should use their dedicated RPCs instead.
drop policy if exists "students insert views" on public.vibelearn_content_views;
create policy "students insert views"
on public.vibelearn_content_views for insert
to authenticated
with check (
  student_id is not null
  and exists (
    select 1 from public.students st
    where st.id = vibelearn_content_views.student_id
      and st.profile_id = (select auth.uid())
  )
);

commit;
