begin;

-- Quiz questions include correct answers and explanations. They are learning
-- assets for authenticated learners, not public discovery data. Keep them out
-- of the anonymous/public API surface used by crawlers and unauthenticated
-- clients.
drop policy if exists "public read quiz questions" on public.quiz_questions;
create policy "authenticated read quiz questions"
on public.quiz_questions
for select
to authenticated
using (true);

commit;
