import fs from 'node:fs'

const CYBORG_ID = 'vibeschool-cyborg-executor'
const CYBORG_PATH = 'docs/ai-governance/CYBORG_EXECUTOR.md'

const requiredFiles = [
  'AGENTS.md',
  CYBORG_PATH,
  'docs/ai-governance/OPERATING_DOCTRINE.md',
  'docs/ai-governance/MANDATORY_SKILLS.md',
  'docs/ai-governance/SKILL_REGISTRY.json',
  '.github/control-plane/policy.json',
  'CLAUDE.md',
  '.github/copilot-instructions.md',
  'GEMINI.md',
]

const requiredCoreSkills = [
  'repo-truth-first',
  'contract-integrity',
  'preflight-before-ci',
  'test-the-test',
  'ci-failure-repair-loop',
  'evidence-and-certification',
  'dependency-integrity-loop',
  'escape-hatch-auditor',
  'security-authority-gate',
  'merge-certification-gate',
  'regression-learning',
  'resource-conservation',
]

const requiredDomainSkills = [
  'worker-engine-governance',
  'supabase-rls-security',
  'content-factory-quality',
  'hq-ux-operational-truth',
  'journey-integrity',
  'production-readiness',
  'observability-watchdog-reliability',
]

const failures = []

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) failures.push(`Missing required governance file: ${file}`)
}

function requireText(file, fragments) {
  if (!fs.existsSync(file)) return
  const text = fs.readFileSync(file, 'utf8')
  for (const fragment of fragments) {
    if (!text.includes(fragment)) failures.push(`${file} must contain: ${JSON.stringify(fragment)}`)
  }
}

requireText('AGENTS.md', [
  CYBORG_PATH,
  CYBORG_ID,
  'docs/ai-governance/OPERATING_DOCTRINE.md',
  'docs/ai-governance/MANDATORY_SKILLS.md',
  'docs/ai-governance/SKILL_REGISTRY.json',
  '.github/control-plane/policy.json',
  'exact candidate SHA',
  'Runtime, schedulers, automatic publishing, payments',
  'Vendor-neutral rule',
  'repo-truth-first',
  'contract-integrity',
  'preflight-before-ci',
  'ci-failure-repair-loop',
  'evidence-and-certification',
])

requireText(CYBORG_PATH, [
  CYBORG_ID,
  'Canonical execution loop',
  'Skill selection law',
  'Dependency integrity',
  'CI repair loop',
  'Test integrity',
  'Evidence states',
  'Authority and production safety',
  'Merge law',
  'Resource conservation',
  'Learning loop',
  'Handover contract',
  'exact base SHA',
  'exact head',
])

for (const adapter of ['CLAUDE.md', '.github/copilot-instructions.md', 'GEMINI.md']) {
  requireText(adapter, ['AGENTS.md', 'OPERATING_DOCTRINE.md'])
}

requireText('docs/ai-governance/MANDATORY_SKILLS.md', [
  ...requiredCoreSkills,
  ...requiredDomainSkills,
])

if (fs.existsSync('docs/ai-governance/SKILL_REGISTRY.json')) {
  try {
    const registry = JSON.parse(fs.readFileSync('docs/ai-governance/SKILL_REGISTRY.json', 'utf8'))
    if (registry.mandatoryForAllAgents !== true) failures.push('SKILL_REGISTRY.json must set mandatoryForAllAgents=true')
    if (registry.orchestrator?.id !== CYBORG_ID) failures.push(`Skill registry orchestrator must be ${CYBORG_ID}`)
    if (registry.orchestrator?.path !== CYBORG_PATH) failures.push(`Skill registry orchestrator path must be ${CYBORG_PATH}`)
    if (registry.orchestrator?.mandatory !== true) failures.push('Cyborg orchestrator must be mandatory=true')

    const coreIds = new Set((registry.core ?? []).map((skill) => skill.id))
    const domainIds = new Set((registry.vibeschoolDomains ?? []).map((skill) => skill.id))
    for (const id of requiredCoreSkills) {
      if (!coreIds.has(id)) failures.push(`Skill registry missing mandatory core skill: ${id}`)
    }
    for (const id of requiredDomainSkills) {
      if (!domainIds.has(id)) failures.push(`Skill registry missing VibeSchool domain skill: ${id}`)
    }
  } catch (error) {
    failures.push(`Skill registry is invalid JSON: ${error.message}`)
  }
}

if (fs.existsSync('.github/control-plane/policy.json')) {
  try {
    const policy = JSON.parse(fs.readFileSync('.github/control-plane/policy.json', 'utf8'))
    for (const domain of ['AUTH', 'DATABASE', 'AUTHORIZATION', 'IDENTITY', 'WORKER', 'PAYMENTS', 'CI']) {
      if (!policy.domains?.[domain]) failures.push(`Control-plane policy missing domain: ${domain}`)
    }
  } catch (error) {
    failures.push(`Control-plane policy is invalid JSON: ${error.message}`)
  }
}

if (failures.length) {
  console.error('Agent governance validation FAILED')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Agent governance validation PASSED')
console.log(`Validated mandatory Cyborg orchestrator: ${CYBORG_ID}`)
console.log(`Validated ${requiredFiles.length} mandatory governance entrypoints.`)
console.log(`Validated ${requiredCoreSkills.length} mandatory core skills and ${requiredDomainSkills.length} VibeSchool domain skills.`)
