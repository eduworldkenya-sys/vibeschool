-- Fix subjects_member_read RLS policy to allow reading global subject rows
-- (school_id IS NULL). Previously this policy only matched school_id IN
-- (teacher's schools), which silently excluded the 12 canonical CBC
-- subject rows for every real teacher session — resolveGlobalSubjectId()
-- was returning NULL with no error, since RLS filters rows rather than
-- throwing. Confirmed live in SQL editor 2026-07-16; this migration just
-- brings that change into version control.

alter policy subjects_member_read on subjects
using (
  school_id is null
  or school_id in (
    select sm.school_id
    from school_members sm
    where sm.profile_id = auth.uid()
  )
);
