import fs from 'node:fs'
import path from 'node:path'

const roots = ['app', 'lib', 'supabase/functions', '.github/workflows', 'seed_curriculum_content.mjs']
const allowed = new Set([
  'supabase/functions/cyborg-llm-gateway/index.ts',
])
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.yml', '.yaml'])
const rules = [
  ['direct provider URL', /https?:\/\/(?:api\.)?(?:openai\.com|anthropic\.com|groq\.com)\b/gi],
  ['provider credential', /\b(?:OPENAI_API_KEY|ANTHROPIC_API_KEY|GROQ_API_KEY)\b/g],
  ['OpenAI SDK import', /(?:from\s+['"]openai['"]|require\(['"]openai['"]\))/g],
  ['Anthropic SDK import', /(?:from\s+['"]@anthropic-ai\/sdk['"]|require\(['"]@anthropic-ai\/sdk['"]\))/g],
]

function filesUnder(root) {
  if (!fs.existsSync(root)) return []
  const stat = fs.statSync(root)
  if (stat.isFile()) return [root]
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const p = path.join(root, entry.name)
    return entry.isDirectory() ? filesUnder(p) : [p]
  })
}

const violations = []
for (const root of roots) {
  for (const file of filesUnder(root)) {
    const normalized = file.split(path.sep).join('/')
    if (!extensions.has(path.extname(file)) || allowed.has(normalized)) continue
    const text = fs.readFileSync(file, 'utf8')
    for (const [label, pattern] of rules) {
      pattern.lastIndex = 0
      let match
      while ((match = pattern.exec(text))) {
        const line = text.slice(0, match.index).split('\n').length
        violations.push(`${normalized}:${line}: ${label}: ${match[0]}`)
      }
    }
  }
}

if (violations.length) {
  console.error('CYBORG_BOUNDARY_BYPASS_DETECTED')
  for (const violation of violations) console.error(`- ${violation}`)
  process.exit(1)
}
console.log('CYBORG_BOUNDARY_OK: all VibeSchool LLM runtime paths are gateway-only')
