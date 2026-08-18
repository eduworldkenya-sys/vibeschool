begin;

-- Profiles contain both user-editable presentation data and authority-bearing identity
-- fields. Ordinary clients must never be able to rewrite role, school authority,
-- lifecycle status, anonymization or provenance fields directly.
revoke all on table public.profiles from anon;
revoke update on table public.profiles from authenticated;

-- The repository has accumulated profile-shape drift across historical environments.
-- Grant only the intersection of the explicit presentation-field allowlist and columns
-- that actually exist in the reconstructed schema. This keeps clean rebuilds reproducible
-- without ever widening client authority to role/school/lifecycle/provenance fields.
do $do$
declare
  v_columns text;
begin
  select string_agg(format('%I', a.attname), ', ' order by a.attname)
    into v_columns
  from pg_catalog.pg_attribute a
  where a.attrelid = 'public.profiles'::regclass
    and a.attnum > 0
    and not a.attisdropped
    and a.attname = any (array[
      'full_name',
      'phone',
      'date_of_birth',
      'country_code',
      'notification_prefs',
      'avatar_url',
      'bio',
      'gender',
      'onboarded_chronicles',
      'updated_at'
    ]::text[]);

  if v_columns is null then
    raise exception 'profiles_editable_column_allowlist_resolved_empty';
  end if;

  execute format('grant update (%s) on table public.profiles to authenticated', v_columns);
end
$do$;

-- Keep the existing own-row RLS condition as a second boundary for the editable
-- columns. Authority-bearing fields remain writable only through privileged,
-- purpose-built server/RPC paths.

comment on table public.profiles is
  'Private identity profile. Client UPDATE is column-limited; role, school, lifecycle and provenance authority fields are privileged-only.';

commit;
