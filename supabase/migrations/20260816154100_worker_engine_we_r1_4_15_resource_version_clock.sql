-- WE-R1.4.15 — durable resource version clock.
--
-- Purpose:
--   Make stale-plan / fresh-resource rejection depend on durable database state,
--   not caller-supplied metadata. Consequential Worker Engine mutations bump a
--   singleton resource clock transactionally; gateway planning snapshots record
--   that clock; gateway execution re-reads it and rejects stale plans.
--
-- Runtime remains OFF. This migration does not enable Worker Engine runtime.

CREATE TABLE IF NOT EXISTS public.hq_workforce_resource_version_clock (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  resource_version bigint NOT NULL DEFAULT 1 CHECK (resource_version > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hq_workforce_resource_version_clock ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.hq_workforce_resource_version_clock FROM PUBLIC;
REVOKE ALL ON TABLE public.hq_workforce_resource_version_clock FROM anon;
REVOKE ALL ON TABLE public.hq_workforce_resource_version_clock FROM authenticated;
GRANT ALL ON TABLE public.hq_workforce_resource_version_clock TO service_role;

INSERT INTO public.hq_workforce_resource_version_clock(singleton, resource_version)
VALUES (true, 1)
ON CONFLICT (singleton) DO NOTHING;

CREATE OR REPLACE FUNCTION public.hq_workforce_bump_resource_version_clock_r14()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.hq_workforce_resource_version_clock(singleton, resource_version, updated_at)
  VALUES (true, 2, now())
  ON CONFLICT (singleton) DO UPDATE
    SET resource_version = public.hq_workforce_resource_version_clock.resource_version + 1,
        updated_at = now();
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.hq_workforce_bump_resource_version_clock_r14() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hq_workforce_bump_resource_version_clock_r14() FROM anon;
REVOKE ALL ON FUNCTION public.hq_workforce_bump_resource_version_clock_r14() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.hq_workforce_bump_resource_version_clock_r14() TO service_role;

DO $$
DECLARE
  v_table text;
  v_trigger text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'hq_workforce_workers',
    'hq_workforce_assignments',
    'hq_workforce_jobs',
    'hq_workforce_worker_leases',
    'hq_workforce_worker_heartbeats',
    'hq_workforce_worker_registry',
    'hq_workforce_execution_plans',
    'hq_workforce_authority_decisions',
    'hq_workforce_approval_requests',
    'hq_workforce_compensation_requests',
    'hq_workforce_escalations',
    'hq_workforce_policy_decisions',
    'hq_workforce_execution_attestations',
    'hq_workforce_verification_receipts',
    'hq_workforce_execution_receipts'
  ]
  LOOP
    IF to_regclass('public.' || v_table) IS NULL THEN
      CONTINUE;
    END IF;

    v_trigger := left('trg_' || v_table || '_resource_clock_r14', 63);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', v_trigger, v_table);
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.hq_workforce_bump_resource_version_clock_r14()',
      v_trigger,
      v_table
    );
  END LOOP;
END;
$$;

ALTER TABLE public.hq_workforce_execution_plans
  ADD COLUMN IF NOT EXISTS planned_resource_version bigint;

UPDATE public.hq_workforce_execution_plans
SET planned_resource_version = COALESCE(
  planned_resource_version,
  (SELECT resource_version FROM public.hq_workforce_resource_version_clock WHERE singleton = true),
  1
)
WHERE planned_resource_version IS NULL;

ALTER TABLE public.hq_workforce_execution_plans
  ALTER COLUMN planned_resource_version SET DEFAULT 1;
ALTER TABLE public.hq_workforce_execution_plans
  ALTER COLUMN planned_resource_version SET NOT NULL;

CREATE INDEX IF NOT EXISTS hq_workforce_execution_plans_resource_version_idx
  ON public.hq_workforce_execution_plans(planned_resource_version, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.hq_workforce_capture_plan_resource_version_r14()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current bigint;
BEGIN
  SELECT resource_version
    INTO v_current
  FROM public.hq_workforce_resource_version_clock
  WHERE singleton = true;

  NEW.planned_resource_version := COALESCE(v_current, 1);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.hq_workforce_capture_plan_resource_version_r14() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hq_workforce_capture_plan_resource_version_r14() FROM anon;
REVOKE ALL ON FUNCTION public.hq_workforce_capture_plan_resource_version_r14() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.hq_workforce_capture_plan_resource_version_r14() TO service_role;

DROP TRIGGER IF EXISTS trg_hq_workforce_execution_plans_capture_resource_version_r14
  ON public.hq_workforce_execution_plans;
CREATE TRIGGER trg_hq_workforce_execution_plans_capture_resource_version_r14
BEFORE INSERT ON public.hq_workforce_execution_plans
FOR EACH ROW
EXECUTE FUNCTION public.hq_workforce_capture_plan_resource_version_r14();

CREATE OR REPLACE FUNCTION public.hq_workforce_resource_version_snapshot_r14()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT resource_version FROM public.hq_workforce_resource_version_clock WHERE singleton = true),
    1
  );
$$;

REVOKE ALL ON FUNCTION public.hq_workforce_resource_version_snapshot_r14() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hq_workforce_resource_version_snapshot_r14() FROM anon;
REVOKE ALL ON FUNCTION public.hq_workforce_resource_version_snapshot_r14() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.hq_workforce_resource_version_snapshot_r14() TO service_role;

CREATE OR REPLACE FUNCTION public.hq_workforce_assert_plan_resource_freshness_r14(
  p_plan_id uuid
)
RETURNS TABLE (
  plan_id uuid,
  planned_resource_version bigint,
  current_resource_version bigint,
  is_fresh boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_plan public.hq_workforce_execution_plans%ROWTYPE;
  v_current bigint;
BEGIN
  SELECT * INTO v_plan
  FROM public.hq_workforce_execution_plans
  WHERE id = p_plan_id;

  IF v_plan.id IS NULL THEN
    RAISE EXCEPTION 'execution plan not found: %', p_plan_id;
  END IF;

  SELECT resource_version INTO v_current
  FROM public.hq_workforce_resource_version_clock
  WHERE singleton = true;

  plan_id := v_plan.id;
  planned_resource_version := v_plan.planned_resource_version;
  current_resource_version := COALESCE(v_current, 1);
  is_fresh := planned_resource_version = current_resource_version;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.hq_workforce_assert_plan_resource_freshness_r14(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hq_workforce_assert_plan_resource_freshness_r14(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.hq_workforce_assert_plan_resource_freshness_r14(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.hq_workforce_assert_plan_resource_freshness_r14(uuid) TO service_role;

COMMENT ON TABLE public.hq_workforce_resource_version_clock IS
  'WE-R1.4 durable singleton resource-version clock used to reject stale execution plans.';
COMMENT ON COLUMN public.hq_workforce_execution_plans.planned_resource_version IS
  'WE-R1.4 durable resource version captured at plan creation; execution must compare it to the current clock.';
