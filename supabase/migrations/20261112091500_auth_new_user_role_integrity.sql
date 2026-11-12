-- A new Supabase identity is not a teacher, parent, or learner until the
-- canonical role/learner authority flow confirms it. This restores the
-- unclassified-account invariant without rewriting any existing accounts.
BEGIN;

ALTER TABLE public.profiles ALTER COLUMN role DROP DEFAULT;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  BEGIN
    INSERT INTO public.profiles (id, full_name, role, account_status)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      NULL,
      'active'::account_status
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      INSERT INTO public.signup_provisioning_failures
        (user_id, email, attempted_role, error_message)
      VALUES (NEW.id, NEW.email, NULL, SQLERRM);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role;
COMMENT ON FUNCTION public.handle_new_user() IS
  'New auth users receive an active, role-unclaimed profile. User-editable metadata never assigns application authority.';

COMMIT;
