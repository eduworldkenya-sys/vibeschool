import fs from 'node:fs'
import path from 'node:path'

const manifestPath = 'docs/ai-governance/PORTABLE_AGENT_SKILLS.json'
const failures = []

function fail(message) {
  failures.push(message)
}

if (!fs.existsSync(manifestPath)) {
  fail(`Missing ${manifestPath}`)
} else {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  if (manifest.owner !== 'vibeschool-cyborg-executor') fail('Portable skill owner must remain vibeschool-cyborg-executor')
  if (manifest.canonicalInstructions !== 'AGENTS.md') fail('Portable skills must remain subordinate to AGENTS.md')
  if (manifest.canonicalRegistry !== 'docs/ai-governance/SKILL_REGISTRY.json') fail('Portable skills must point to canonical SKILL_REGISTRY.json')
  if (!Array.isArray(manifest.required) || manifest.required.length < 20) fail('Portable skill inventory is unexpectedly incomplete')

  const seen = new Set()
  for (const name of manifest.required ?? []) {
    if (seen.has(name)) fail(`Duplicate portable skill: ${name}`)
    seen.add(name)
    const skillPath = path.join(manifest.root ?? '.github/skills', name, 'SKILL.md')
    if (!fs.existsSync(skillPath)) {
      fail(`Missing required portable skill: ${skillPath}`)
      continue
    }
    const text = fs.readFileSync(skillPath, 'utf8')
    if (!text.startsWith('---\n')) fail(`${skillPath} missing YAML frontmatter`)
    if (!text.includes(`\nname: ${name}\n`)) fail(`${skillPath} name does not match directory`) 
    if (!/\ndescription:\s*\S/.test(text)) fail(`${skillPath} missing non-empty description`)
    if (text.length < 180) fail(`${skillPath} is too shallow to be an executable skill`) 
  }

  const engineeringOs = fs.readFileSync('.github/skills/vibeschool-engineering-os/SKILL.md', 'utf8')
  for (const invariant of manifest.mandatoryInvariants ?? []) {
    if (!engineeringOs.toLowerCase().includes(String(invariant).toLowerCase())) {
      fail(`Engineering OS missing invariant: ${invariant}`)
    }
  }

  const forbiddenWeakening = [
    /disable\s+rls/i,
    /bypass\s+branch\s+protection/i,
    /skip\s+required\s+(tests|ci|checks)/i,
    /runtime\s+(is|should be)\s+on\s+by\s+default/i,
    /automatic\s+publishing\s+(is|should be)\s+enabled/i
  ]
  for (const name of manifest.required ?? []) {
    const skillPath = path.join(manifest.root ?? '.github/skills', name, 'SKILL.md')
    if (!fs.existsSync(skillPath)) continue
    const text = fs.readFileSync(skillPath, 'utf8')
    for (const pattern of forbiddenWeakening) if (pattern.test(text)) fail(`${skillPath} contains governance weakening: ${pattern}`)
  }

  const agents = fs.readFileSync('AGENTS.md', 'utf8')
  for (const required of ['vibeschool-cyborg-executor', 'exact candidate SHA', 'Global Stop']) {
    if (!agents.includes(required)) fail(`AGENTS.md no longer contains required canonical control: ${required}`)
  }
}

if (failures.length) {
  console.error('Portable Agent Skills validation FAILED')
  for (const message of failures) console.error(`- ${message}`)
  process.exit(1)
}

console.log('Portable Agent Skills validation PASSED')
