#!/usr/bin/env python3
"""Static security/compatibility contract for School Engine raw_record v2."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "supabase/migrations/20260816170000_authoritative_school_record_contract_v2.sql"
sql = MIGRATION.read_text(encoding="utf-8")
low = sql.lower()

required = [
    "create or replace function public.hq_promote_authoritative_school_record",
    "security definer",
    "set search_path to 'public', 'extensions', 'pg_temp'",
    "owner_authorization_required",
    "sealed_tier0_snapshot_required",
    "reconciliation_required",
    "record_not_eligible_for_promotion",
    "canonical_identity_changed_rerun_reconciliation",
    "o.raw_record->>'ownership_type'",
    "o.raw_record->>'ownership'",
    "o.raw_record->>'accommodation_type'",
    "o.raw_record->>'accommodation'",
    "o.raw_record->>'boarding_status'",
    "o.raw_record->>'gender_type'",
    "o.raw_record->>'gender'",
    "o.raw_record->>'sex'",
    "o.raw_record->>'institution_type'",
    "insert into public.schools",
    "requires_dual_approval",
    "'pending'",
    "revoke all on function public.hq_promote_authoritative_school_record(uuid, text) from public",
    "revoke all on function public.hq_promote_authoritative_school_record(uuid, text) from anon",
    "grant execute on function public.hq_promote_authoritative_school_record(uuid, text) to authenticated",
]

for marker in required:
    assert marker in low, f"missing authoritative record v2 contract marker: {marker}"

# The compatibility repair must not add a parallel staging/promotion route.
assert "create function public.hq_stage_school_directory_batch" not in low
assert "create or replace function public.hq_stage_school_directory_batch" not in low
assert "status, created_by" in low and "'pending'" in low, "new canonical schools must remain pending"

print("authoritative school record contract v2: PASS")
