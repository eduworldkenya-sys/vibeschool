#!/usr/bin/env python3
from pathlib import Path
import re


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one repair target, found {count}: {old[:80]!r}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")


# Communications: preserve concrete profile typing instead of creating a ternary result union.
path = "app/admin/communication/page.tsx"
p = Path(path)
text = p.read_text(encoding="utf-8")
alias_anchor = """type CommunityPerson = {\n  profile_id: string\n  full_name: string | null\n  relationship: string\n}\n"""
alias_replacement = alias_anchor + """\ntype ProfileSummary = {\n  id: string\n  full_name: string | null\n  role: string | null\n}\n"""
if text.count(alias_anchor) != 1:
    raise SystemExit("communication: CommunityPerson anchor drifted")
text = text.replace(alias_anchor, alias_replacement, 1)
old = """    const profileRes = otherIds.length\n      ? await supabase.from(\"profiles\").select(\"id,full_name,role\").in(\"id\", otherIds)\n      : { data: [], error: null }\n    if (profileRes.error) throw profileRes.error\n    const profiles = new Map((profileRes.data ?? []).map(row => [row.id, row]))\n"""
new = """    const profiles = new Map<string, ProfileSummary>()\n    if (otherIds.length > 0) {\n      const profileRes = await supabase\n        .from(\"profiles\")\n        .select(\"id,full_name,role\")\n        .in(\"id\", otherIds)\n      if (profileRes.error) throw profileRes.error\n      for (const row of profileRes.data ?? []) {\n        profiles.set(row.id, {\n          id: row.id,\n          full_name: row.full_name,\n          role: row.role,\n        })\n      }\n    }\n"""
if text.count(old) != 1:
    raise SystemExit("communication: profile map anchor drifted")
p.write_text(text.replace(old, new, 1), encoding="utf-8")

# History-preservation evidence sums are always numbers, even when Supabase count is null.
replace_once(
    "app/admin/settings/classes/page.tsx",
    "const evidence = [students.count, teachers.count, timetable.count, lessons.count, attendance.count, assessments.count].reduce((sum, value) => sum + (value ?? 0), 0)",
    "const evidence = [students.count, teachers.count, timetable.count, lessons.count, attendance.count, assessments.count].reduce<number>((sum, value) => sum + (value ?? 0), 0)",
)
replace_once(
    "app/admin/settings/subjects/page.tsx",
    "const evidence = [assignments.count, timetable.count, schemes.count, lessons.count, assessments.count, results.count].reduce((sum, count) => sum + (count ?? 0), 0)",
    "const evidence = [assignments.count, timetable.count, schemes.count, lessons.count, assessments.count, results.count].reduce<number>((sum, count) => sum + (count ?? 0), 0)",
)

# Generated DB contract: canonical migration chain and production both contain schools.moe_registration_no.
db_path = Path("lib/database.types.ts")
db = db_path.read_text(encoding="utf-8")
start = db.find("      schools: {")
if start < 0:
    raise SystemExit("database.types.ts: schools table block not found")
match = re.search(r"^      [A-Za-z0-9_]+: \{\n        Row:", db[start + len("      schools: {"):], re.M)
if not match:
    raise SystemExit("database.types.ts: next table after schools not found")
end = start + len("      schools: {") + match.start()
block = db[start:end]
if "moe_registration_no:" in block:
    raise SystemExit("database.types.ts: moe_registration_no already present; generation contract changed")
row_needle = "          nemis_code: string | null\n"
optional_needle = "          nemis_code?: string | null\n"
if block.count(row_needle) != 1 or block.count(optional_needle) != 2:
    raise SystemExit(
        f"database.types.ts: unexpected schools nemis_code shape row={block.count(row_needle)} optional={block.count(optional_needle)}"
    )
block = block.replace(row_needle, row_needle + "          moe_registration_no: string | null\n", 1)
block = block.replace(optional_needle, optional_needle + "          moe_registration_no?: string | null\n")
db = db[:start] + block + db[end:]
db_path.write_text(db, encoding="utf-8")

# Query the typed school row directly. This avoids PostgREST select-string parser drift while preserving compile-time schema checking.
replace_once(
    "app/admin/settings/school/page.tsx",
    '.select("name,subdomain,motto,vision,knec_code,nemis_code,moe_registration_no,tsc_code,county,sub_county,ward,phone,postal_address,school_type,school_category,established_year,directory_source,last_verified_at")',
    '.select("*")',
)
replace_once(
    "app/admin/settings/school/page.tsx",
    "      const row = data as SchoolRow",
    "      const row: SchoolRow = data",
)

# TBL-011 candidate fingerprint: reviewed Task 7 migration adds exactly one teacher-assignment index.
target_path = Path("supabase/reconciliation/tbl012_production_core_schema_hashes.json")
target = target_path.read_text(encoding="utf-8")
old_hash = "9ed6ca6aba8038eade1fcd68416ee51b"
new_hash = "0e6acbccc17d2e2040ab015b247ac511"
if target.count(old_hash) != 1:
    raise SystemExit(f"TBL-012 target old teacher_classes index hash count={target.count(old_hash)}")
target = target.replace(old_hash, new_hash, 1)
source_anchor = '    "captured_at": "2026-08-03",\n'
source_replacement = source_anchor + '    "target_updated_at": "2026-08-19",\n    "target_semantics": "Task 7 reviewed post-migration structural target; production preflight must verify the forward delta before promotion",\n'
if target.count(source_anchor) != 1:
    raise SystemExit("TBL-012 source metadata anchor drifted")
target_path.write_text(target.replace(source_anchor, source_replacement, 1), encoding="utf-8")

# Remove accidental byte-identical duplicate communication migration, preserving canonical 20501 path.
duplicate = Path("supabase/migrations/20260819020510_school_admin_cross_school_communication_hardening.sql")
canonical = Path("supabase/migrations/20260819020501_school_admin_cross_school_communication_hardening.sql")
if not duplicate.is_file() or not canonical.is_file():
    raise SystemExit("communication migration canonical/duplicate pair not found")
if duplicate.read_bytes() != canonical.read_bytes():
    raise SystemExit("communication migrations are no longer byte-identical; refusing cleanup")
duplicate.unlink()

print("Task 7 one-shot convergence repairs applied")
