begin;
-- Remove bootstrap aliases for levels now covered by explicit current KICD catalog.
delete from public.grade_subject_authority
where grade in('Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Grade 9')
  and source_ref='VibeSchool canonical curriculum import';
notify pgrst,'reload schema';commit;