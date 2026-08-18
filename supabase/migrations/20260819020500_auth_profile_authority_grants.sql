begin;

-- Profiles contain both user-editable presentation data and authority-bearing identity
-- fields. Ordinary clients must never be able to rewrite role, school authority,
-- lifecycle status, anonymization or provenance fields directly.
revoke all on table public.profiles from anon;
revoke update on table public.profiles from authenticated;

grant update (
  full_name,
  phone,
  date_of_birth,
  country_code,
  notification_prefs,
  avatar_url,
  bio,
  gender,
  onboarded_chronicles,
  updated_at
) on table public.profiles to authenticated;

-- Keep the existing own-row RLS condition as a second boundary for the editable
-- columns. Authority-bearing fields remain writable only through privileged,
-- purpose-built server/RPC paths.

comment on table public.profiles is
  'Private identity profile. Client UPDATE is column-limited; role, school, lifecycle and provenance authority fields are privileged-only.';

commit;
