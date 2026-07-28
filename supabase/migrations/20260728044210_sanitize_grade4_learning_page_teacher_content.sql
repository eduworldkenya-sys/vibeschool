-- Sanitize the currently published Grade 4 Learning Page.
-- The teacher-only section starts at character 4522 and continues to
-- the end of the body. Wrap that section so the audience-safe reader
-- removes it for learners and other unauthorized viewers.

update public.vibelearn_content
set body =
  left(body, 4521)
  || '[TEACHER_ONLY]'
  || substring(body from 4522)
  || '[/TEACHER_ONLY]'
where id = '1f9b42ff-6404-483f-bc1f-8bfb480124ba'
  and body ~ '\[TEACHER_ONLY\]' is not true;
