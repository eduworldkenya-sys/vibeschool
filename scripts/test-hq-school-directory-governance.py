#!/usr/bin/env python3
"""Static authorization regression for HQ directory corrections.

Live tests additionally check PUBLIC grants after migration. These invariants
must remain true during future refactors and clean database rebuilds.
"""
from pathlib import Path

sql = (Path(__file__).resolve().parents[1] / "supabase/migrations/20261106170000_hq_school_directory_governed_updates.sql").read_text()
checks = {
    "RLS audit": "alter table public.hq_school_directory_edits enable row level security" in sql,
    "private audit": "revoke all on public.hq_school_directory_edits from public,anon,authenticated" in sql,
    "owner check for both functions": sql.count("if not public.is_platform_owner() then raise exception 'hq_owner_required'") == 3,
    "authenticated only writer": "grant execute on function public.hq_school_directory_apply_edits_v1(jsonb,text) to authenticated" in sql,
    "public default execution revoked": "revoke all on function public.hq_school_directory_apply_edits_v1(jsonb,text) from public" in sql,
    "private audit history": "revoke all on function public.hq_school_directory_edit_history_v1(uuid,integer) from public" in sql,\n    "bounded batch": "jsonb_array_length(p_changes) not between 1 and 100" in sql,
    "evidence required": "evidence_note_required" in sql,
    "duplicate identity guard": "duplicate_school_id" in sql,
    "field whitelist": "key not in ('id','county','sub_county','type','latitude','longitude')" in sql,
    "coordinate pair": "coordinates_must_be_paired" in sql,
    "audit row": "insert into public.hq_school_directory_edits" in sql,
    "verification unchanged": "is_verified=" not in sql.lower() and "set is_verified" not in sql.lower(),
}
for name, ok in checks.items():
    assert ok, name
print("PASS: owner-only audited bounded school directory updates with restricted fields")
