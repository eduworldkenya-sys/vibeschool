-- VibeMe public tutor projection. Keep existing published-only view,
-- existing columns and grants; expose only finite non-identifying avatar codes.
-- Never expose profile photos, private profiles, or learner account identifiers.
begin;
create or replace view public.vibetutor_public_tutors
  with (security_invoker = false) as
  select t.profile_id, t.display_name, t.levels, t.subjects, t.teaching_mode, t.area,
         t.rate_kes, t.available_days, t.dayparts, t.holiday_available, t.bio,
         t.photo_path, t.created_at,
         case when p.role::text = 'teacher'
           and p.avatar_url ~ '^/api/vibeme/v1-[0-5][0-5][0-2][0-2][0-3][0-5][0-5][.]svg$'
           then p.avatar_url else null end as avatar_url
  from public.vibetutor_tutors t
  left join public.profiles p on p.id = t.profile_id
  where t.status = 'published';
commit;
