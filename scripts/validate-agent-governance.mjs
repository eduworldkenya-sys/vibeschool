import fs from 'node:fs'

const requiredFiles = [
  'AGENTS.md',
  'docs/ai-governance/OPERATING_DOCTRINE.md',
  '.github/control-plane/policy.json',
  'CLAUDE.md',
  '.github/copilot-instructions.md',
  'GEMINI.md',
]

const failures = []

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) failures.push(`Missing required governance file: ${file}`)
}

function requireText(file, fragments) {
  if (!fs.existsSync(file)) return
  const text = fs.readFileSync(file, 'utf8')
  for (const fragment of fragments) {
    if (!text.includes(fragment)) {
      failures.push(`${file} must contain: ${JSON.stringify(fragment)}`)
    }
  }
}

requireText('AGENTS.md', [
  'docs/ai-governance/OPERATING_DOCTRINE.md',
  '.github/control-plane/policy.json',
  'exact candidate SHA',
  'Runtime, schedulers, automatic publishing, payments',
  'Vendor-neutral rule',
])

for (const adapter of ['CLAUDE.md', '.github/copilot-instructions.md', 'GEMINI.md']) {
  requireText(adapter, ['AGENTS.md', 'OPERATING_DOCTRINE.md'])
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
console.log(`Validated ${requiredFiles.length} mandatory governance entrypoints.`)
