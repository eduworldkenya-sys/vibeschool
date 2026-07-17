-- Adds the two missing Lower Primary composite subjects (Environmental
-- Activities, Creative Activities) as legitimate global subject rows —
-- these are KICD's actual Grade 1-3 subject identities, not a stand-in
-- for the upper-primary unbundled versions. Then seeds
-- subject_weekly_allocations with the official MoE/KICD rationalized
-- lesson allocation (Dec 2023 circular, confirmed against 4 independent
-- sources incl. The Star's direct Ministry quote and the Feb 2026
-- Education News Hub republished circular).

-- 1. New global subjects (school_id IS NULL = shared infrastructure,
--    same pattern as the existing 13 rows).
insert into subjects (name, school_id)
select 'Environmental Activities', null
where not exists (select 1 from subjects where name = 'Environmental Activities' and school_id is null);

insert into subjects (name, school_id)
select 'Creative Activities', null
where not exists (select 1 from subjects where name = 'Creative Activities' and school_id is null);

-- 2. Lower Primary (Grade 1-3): 31 lessons/week total
insert into subject_weekly_allocations (band, grade, subject_label, lessons_per_week) values
  ('lower_primary', 'Grade 1', 'Indigenous Languages',      2),
  ('lower_primary', 'Grade 1', 'Kiswahili',                 4),
  ('lower_primary', 'Grade 1', 'English',                   5),
  ('lower_primary', 'Grade 1', 'Mathematics',                5),
  ('lower_primary', 'Grade 1', 'Religious Education',       3),
  ('lower_primary', 'Grade 1', 'Environmental Activities',  4),
  ('lower_primary', 'Grade 1', 'Creative Activities',       7),

  ('lower_primary', 'Grade 2', 'Indigenous Languages',      2),
  ('lower_primary', 'Grade 2', 'Kiswahili',                 4),
  ('lower_primary', 'Grade 2', 'English',                   5),
  ('lower_primary', 'Grade 2', 'Mathematics',                5),
  ('lower_primary', 'Grade 2', 'Religious Education',       3),
  ('lower_primary', 'Grade 2', 'Environmental Activities',  4),
  ('lower_primary', 'Grade 2', 'Creative Activities',       7),

  ('lower_primary', 'Grade 3', 'Indigenous Languages',      2),
  ('lower_primary', 'Grade 3', 'Kiswahili',                 4),
  ('lower_primary', 'Grade 3', 'English',                   5),
  ('lower_primary', 'Grade 3', 'Mathematics',                5),
  ('lower_primary', 'Grade 3', 'Religious Education',       3),
  ('lower_primary', 'Grade 3', 'Environmental Activities',  4),
  ('lower_primary', 'Grade 3', 'Creative Activities',       7)
on conflict (grade, subject_label) do nothing;

-- 3. Upper Primary (Grade 4-6): 35 lessons/week total
insert into subject_weekly_allocations (band, grade, subject_label, lessons_per_week) values
  ('upper_primary', 'Grade 4', 'English',                    5),
  ('upper_primary', 'Grade 4', 'Kiswahili',                  4),
  ('upper_primary', 'Grade 4', 'Mathematics',                 5),
  ('upper_primary', 'Grade 4', 'Religious Education',        3),
  ('upper_primary', 'Grade 4', 'Science and Technology',     4),
  ('upper_primary', 'Grade 4', 'Agriculture and Nutrition',  4),
  ('upper_primary', 'Grade 4', 'Social Studies',             3),
  ('upper_primary', 'Grade 4', 'Creative Arts and Sports',   6),

  ('upper_primary', 'Grade 5', 'English',                    5),
  ('upper_primary', 'Grade 5', 'Kiswahili',                  4),
  ('upper_primary', 'Grade 5', 'Mathematics',                 5),
  ('upper_primary', 'Grade 5', 'Religious Education',        3),
  ('upper_primary', 'Grade 5', 'Science and Technology',     4),
  ('upper_primary', 'Grade 5', 'Agriculture and Nutrition',  4),
  ('upper_primary', 'Grade 5', 'Social Studies',             3),
  ('upper_primary', 'Grade 5', 'Creative Arts and Sports',   6),

  ('upper_primary', 'Grade 6', 'English',                    5),
  ('upper_primary', 'Grade 6', 'Kiswahili',                  4),
  ('upper_primary', 'Grade 6', 'Mathematics',                 5),
  ('upper_primary', 'Grade 6', 'Religious Education',        3),
  ('upper_primary', 'Grade 6', 'Science and Technology',     4),
  ('upper_primary', 'Grade 6', 'Agriculture and Nutrition',  4),
  ('upper_primary', 'Grade 6', 'Social Studies',             3),
  ('upper_primary', 'Grade 6', 'Creative Arts and Sports',   6)
on conflict (grade, subject_label) do nothing;
