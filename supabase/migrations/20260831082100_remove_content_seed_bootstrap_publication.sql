begin;

-- The bootstrap publication exists only to give historical platform content
-- migrations a deterministic author on a truly blank database. By this point
-- the real Grade 6 Social Studies publication has inherited that author, so the
-- temporary publication can be removed without deleting the non-login system
-- principal used by the real content row.
delete from public.vibe_publications
where id = '76696265-7363-4075-826c-697368657230'::uuid
  and title = '__VibeSchool reconstruction bootstrap__';

commit;
