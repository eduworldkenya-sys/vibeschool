import { readFileSync } from "node:fs"

const scope = JSON.parse(readFileSync("docs/worker-engine-proof-scope.json", "utf8"))
const testSource = readFileSync("lib/hq/workforce/governed-runtime.test.ts", "utf8")
const requiredTitles = [
  "inactive lifecycle fails closed before execution",
  "unconfigured execution mode fails closed",
  "invalid envelope recipient fails closed",
  "watchdog fail-closes before execution",
  "authority deny blocks execution",
  "authority approval persists and stops",
  "fallback requires approval",
  "context is sanitized before executor",
  "metric trigger delegates durable admission",
  "persistence failure fails closed",
  "clarification must be structured"
]
for (const title of requiredTitles) {
  if (!testSource.includes(`test(\"${title}\"`)) throw new Error(`Missing governed proof: ${title}`)
}
if (scope.supersedes_pr !== 445) throw new Error("Proof scope must record PR #445 supersession")
if (Object.values(scope.activation).some(Boolean)) throw new Error("Proof reconciliation must remain non-activating")
console.log(`Governed proof contract passed with ${requiredTitles.length} required adversarial cases.`)
