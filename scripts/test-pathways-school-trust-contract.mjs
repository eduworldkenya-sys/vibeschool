import fs from 'node:fs'

const sql = fs.readFileSync('supabase/migrations/20260816075000_pathways_school_offering_trust_hardening.sql', 'utf8')
let failed = false
function assert(ok, label) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failed = true
}

assert(sql.includes('revoke select on table public.pathway_school_offerings from anon, authenticated'), 'raw pathway offering rows are not public')
assert(sql.includes('drop policy if exists pathway_school_offerings_public_read'), 'legacy anonymous offering policy is retired')
assert(sql.includes("ps.source_type in ('official_portal','official_document','institution_verified')"), 'public claims require bounded provenance classes')
assert(sql.includes("ps.status = 'active'"), 'withdrawn/superseded provenance cannot power public claims')
assert(sql.includes('ps.is_public'), 'non-public provenance cannot power public claims')
assert(sql.includes('o.effective_from is null or o.effective_from <= current_date'), 'future offering evidence is excluded')
assert(sql.includes('o.effective_to is null or o.effective_to >= current_date'), 'expired offering evidence is excluded')
assert(sql.includes('ps.effective_from is null or ps.effective_from <= current_date'), 'future source evidence is excluded')
assert(sql.includes('ps.effective_to is null or ps.effective_to >= current_date'), 'expired source evidence is excluded')
assert(sql.includes("s.status = 'active'"), 'only active canonical schools are public')
assert(sql.includes('and ps.id is not null'), 'pathway-filtered result cannot survive missing trusted provenance')
assert(sql.includes('limit greatest(1, least(coalesce(p_limit,30),50))'), 'anonymous projection remains bounded')
assert(sql.includes('security definer'), 'projection owns its narrow read boundary')
assert(sql.includes('grant execute on function public.pathways_search_public_schools') && sql.includes('to anon, authenticated'), 'clients receive only RPC execution')

if (failed) process.exit(1)
