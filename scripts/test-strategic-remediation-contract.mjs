import fs from 'node:fs'

const register = fs.readFileSync('STRATEGIC_GAP_REMEDIATION_REGISTER.md', 'utf8')
const migration = fs.readFileSync('supabase/migrations/20260814123000_publication_curriculum_provenance.sql', 'utf8')

const requiredGaps = Array.from({ length: 14 }, (_, i) => `G-${String(i + 1).padStart(2, '0')}`)
for (const gap of requiredGaps) {
  if (!register.includes(gap)) throw new Error(`Missing strategic remediation register entry: ${gap}`)
}

const requiredMigrationContracts = [
  'publication_curriculum_provenance',
  'external_review_status',
  "external_review_status <> 'approved'",
  "alignment_status in ('draft','mapped')",
  "external_review_status in ('not_submitted','not_applicable')",
  'external_reference is null',
  'enable row level security',
]
for (const contract of requiredMigrationContracts) {
  if (!migration.includes(contract)) throw new Error(`Missing curriculum provenance contract: ${contract}`)
}

if (!register.includes('must never display or encode `KICD approved`')) {
  throw new Error('Missing external-claim truth rule')
}

console.log('Strategic remediation contract: PASS')
