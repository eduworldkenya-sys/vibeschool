from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
page = (ROOT / "app/teacher/onboarding/school/page.tsx").read_text()

migrations = sorted((ROOT / "supabase/migrations").glob("20260813*_school_*.sql"))
combined = "\n".join(p.read_text() for p in migrations)
hardening = (ROOT / "supabase/migrations/20260816161000_school_directory_connect_authority_hardening.sql").read_text()
prerequisite = ROOT / "supabase/migrations/20260815153900_restore_school_directory_identity_columns_prerequisite.sql"
matching = ROOT / "supabase/migrations/20260815154000_national_school_identity_engine_matching_v3.sql"
legacy_matching = ROOT / "supabase/migrations/20260815120000_national_school_identity_engine_matching_v3.sql"

required_page_markers = [
    'search_school_directory',
    'connect_teacher_to_directory_school',
    'connect_teacher_to_school',
    'submit_school_discovery_request',
    'school_identity_review_required',
    'My school is new or missing',
    'There are schools with the same name.',
]
for marker in required_page_markers:
    assert marker in page, f"missing onboarding contract marker: {marker}"

required_db_markers = [
    'search_school_directory',
    'connect_teacher_to_directory_school',
    'hq_list_school_identity_queue',
    'hq_review_school_identity_candidate',
    'hq_resolve_school_discovery_request',
    'school_identity_candidates_one_active_directory_idx',
    "p_level is null or p_level=any(s.levels)",
    'school_identity_review_required',
    'canonical_school_ambiguous',
]
for marker in required_db_markers:
    assert marker in combined, f"missing database contract marker: {marker}"

assert 'SECURITY INVOKER' in combined.upper() or 'security invoker' in combined.lower(), 'school search must remain SECURITY INVOKER'
assert 'grant execute on function public.search_school_directory' in combined.lower(), 'school search grant must be explicit'
assert 'from public,anon' in combined.lower(), 'public/anon execute must be revoked from sensitive functions'

# P0 trust boundary: end-user directory connection is a consumer of owner-reviewed
# reconciliation, never an identity matcher or reviewer itself.
assert "c.reviewed_by is not null" in hardening
assert "c.reviewed_at is not null" in hardening
assert "raise exception 'school_identity_review_required'" in hardening
assert "unique normalized name + county + sub-county match" not in hardening.lower()
connect_body = hardening.split('create or replace function public.connect_teacher_to_directory_school', 1)[1].split('create or replace function public.hq_review_school_identity_candidate', 1)[0]
assert 'insert into public.school_identity_candidates' not in connect_body.lower(), 'teacher connection must not create reconciliation evidence'
assert 'update public.school_identity_candidates' not in connect_body.lower(), 'teacher connection must not review/mutate identity evidence'
assert 'reviewed_by' not in connect_body.lower().split('where c.directory_school_id', 1)[0], 'teacher connection must not assign reviewer identity'

# Owner NEW path must satisfy canonical school schema without bypassing pending/dual approval.
review_body = hardening.split('create or replace function public.hq_review_school_identity_candidate', 1)[1]
assert "not coalesce(public.is_platform_owner(),false)" in review_body
assert 'name,subdomain,timezone,country_code,status,created_by,requires_dual_approval' in review_body
assert "'pending',v_uid,true" in review_body
assert "v_subdomain := v_slug || '-' || replace(d.id::text,'-','')" in review_body
assert "raise exception 'canonical_identifier_collision'" in review_body

# Blank-database reproducibility: national matching cannot share the Worker Engine
# 20260815120000 ledger version and cannot reference its normalization primitive or
# directory identity columns before they exist.
assert not legacy_matching.exists(), 'duplicate 20260815120000 national school migration must stay retired'
assert prerequisite.exists(), 'directory identity prerequisite migration missing'
assert matching.exists(), 'reordered national school identity migration missing'
prerequisite_sql = prerequisite.read_text()
matching_sql = matching.read_text()
assert 'add column if not exists knec_code text' in prerequisite_sql.lower()
assert 'add column if not exists ingest_batch_id uuid' in prerequisite_sql.lower()
normalize_pos = matching_sql.lower().find('create or replace function public.normalize_school_identity_name')
index_pos = matching_sql.lower().find('schools_directory_name_trgm_idx')
assert normalize_pos >= 0 and index_pos > normalize_pos, 'normalization primitive must exist before expression index'

print('school discovery contract: PASS')
