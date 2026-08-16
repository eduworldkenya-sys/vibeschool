from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
original = (ROOT / "supabase/migrations/20260816150000_authoritative_school_certification_pipeline.sql").read_text()
repair = (ROOT / "supabase/migrations/20260816153000_authoritative_school_uuid_runtime_fix.sql").read_text()

# PostgreSQL does not implement min(uuid). This defect compiles inside PL/pgSQL
# and is only exposed when the function executes, so keep an explicit regression
# contract around both authoritative mutation paths.
assert "min(s.id)" in original, "expected historical runtime defect is no longer represented where this repair documents it"
assert "min(s.id)" not in repair, "runtime repair must not reintroduce min(uuid)"
assert repair.count("min(s.id::text)::uuid") == 2, "both reconcile and promote paths must use the UUID-safe representative aggregate"

for fn in (
    "hq_reconcile_authoritative_school_snapshot",
    "hq_promote_authoritative_school_record",
):
    assert fn in repair, f"missing repaired function: {fn}"

for marker in (
    "owner_authorization_required",
    "tier0_canonical_authority_required",
    "sealed_tier0_snapshot_required",
    "canonical_identity_changed_rerun_reconciliation",
    "grant execute on function public.hq_reconcile_authoritative_school_snapshot",
    "grant execute on function public.hq_promote_authoritative_school_record",
):
    assert marker in repair, f"runtime repair weakened required contract marker: {marker}"

print("authoritative school runtime contract: PASS")
