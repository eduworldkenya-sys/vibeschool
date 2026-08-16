import fs from 'node:fs'

const migration = fs.readFileSync('supabase/migrations/20260816195000_authoritative_discovery_identity_bridge.sql', 'utf8')

function requireText(label, text) {
  if (!migration.includes(text)) throw new Error(`Missing ${label}: ${text}`)
}
function forbidText(label, text) {
  if (migration.includes(text)) throw new Error(`Forbidden ${label}: ${text}`)
}

requireText('owner gate', "not coalesce(public.is_platform_owner(),false)")
requireText('sealed snapshot gate', "b.status not in ('validated','published') or b.authority_certified_at is null")
requireText('tier zero gate', "b.authority_tier<>0 or not b.canonical_use or not b.active or b.verification_mode<>'authoritative'")
requireText('self-observation exclusion', 'sd.id<>o.directory_school_id')
requireText('deterministic KNEC link', "'exact_identifier','exact_knec'")
requireText('duplicate conflict', "'conflict','duplicate_discovery_knec'")
requireText('name/location review only', "'review','name_location_review'")
requireText('unique exact propagation', "if v_link_count=1 then")
requireText('candidate canonical collapse', "status='matched',confidence=1")
requireText('verified discovery propagation', 'set is_verified=true')
requireText('canonical promotion trigger', 'after update of canonical_school_id on public.school_authoritative_reconciliation')
forbidText('no direct canonical insert', 'insert into public.schools(')
forbidText('no active canonical promotion', "status='active'")

console.log('authoritative discovery bridge contract: PASS')
