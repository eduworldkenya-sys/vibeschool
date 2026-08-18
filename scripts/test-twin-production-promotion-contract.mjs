import fs from 'node:fs'
import path from 'node:path'

const migrationsDir = 'supabase/migrations'
const workflowPath = '.github/workflows/twin-production-promotion.yml'
const targets = [
  {
    version: '20260818050000',
    file: 'supabase/migrations/20260818050000_teacher_twin_multi_school_scope.sql',
    invariants: [
      'primary key (teacher_id, school_id)',
      'unique (teacher_id, school_id, claim_key)',
      'teacher_get_twin_brain(p_school_id uuid)',
      "raise exception 'teacher_school_scope_not_authorized'",
    ],
  },
  {
    version: '20260818050100',
    file: 'supabase/migrations/20260818050100_teacher_twin_active_school_preference.sql',
    invariants: [
      'teacher_set_active_twin_school(p_school_id uuid)',
      'update public.teacher_profiles tp',
    ],
  },
]

const failures = []

function fail(message) {
  failures.push(message)
}

function requireFile(file) {
  if (!fs.existsSync(file)) {
    fail(`${file}: missing`)
    return ''
  }
  return fs.readFileSync(file, 'utf8')
}

const migrationFiles = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter(name => name.endsWith('.sql')).sort()
  : []

for (const target of targets) {
  const matches = migrationFiles.filter(name => name.startsWith(`${target.version}_`))
  console.log(`${target.version}: ${matches.length} migration file(s): ${matches.join(', ') || '(none)'}`)
  if (matches.length !== 1) {
    fail(`${target.version}: expected exactly one local migration version, found ${matches.length}: ${matches.join(', ') || '(none)'}`)
  }

  const source = requireFile(target.file)
  for (const invariant of target.invariants) {
    if (!source.includes(invariant)) {
      fail(`${target.file}: missing invariant ${JSON.stringify(invariant)}`)
    }
  }
}

const workflow = requireFile(workflowPath)
for (const invariant of [
  'environment: production-migration-repair',
  'supabase db push --linked --dry-run --include-all',
  'supabase db push --linked --include-all',
  "test \"$GITHUB_REF\" = 'refs/heads/main'",
  "EXPECTED_PROJECT_REF: yauqsxggtuxuykcbrtzf",
  "EXPECTED_PENDING_VERSIONS: '20260818050000 20260818050100'",
]) {
  if (!workflow.includes(invariant)) {
    fail(`${workflowPath}: missing production-boundary invariant ${JSON.stringify(invariant)}`)
  }
}

const expectedNames = new Map([
  ['20260818050000', path.basename(targets[0].file)],
  ['20260818050100', path.basename(targets[1].file)],
])
for (const [version, expectedName] of expectedNames) {
  const matches = migrationFiles.filter(name => name.startsWith(`${version}_`))
  if (matches.length === 1 && matches[0] !== expectedName) {
    fail(`${version}: filename drift; expected ${expectedName}, found ${matches[0]}`)
  }
}

if (failures.length) {
  console.error('Twin Production Promotion Contract: FAIL')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Twin Production Promotion Contract: PASS')
console.log('Expected exact versions: 20260818050000 20260818050100')
console.log('Production apply remains main-only and protected-environment scoped.')
