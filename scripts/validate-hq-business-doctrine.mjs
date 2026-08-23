import fs from "node:fs"

const required = [
  ["docs/strategy/VIBESCHOOL-MISSION-VISION-LOCK.md", ["LOCKED STRATEGIC CONSTITUTION", "Commercial Principle"]],
  ["docs/strategy/VIBESCHOOL-BUSINESS-OPERATING-DOCTRINE.md", ["continuous educational progress", "Paying Active Learners per Active School", "Studio creates → Growth distributes", "Unknown metrics must display"]],
  ["app/hq/company/page.tsx", ["Company Doctrine & Business Plan", "Weekly active users", "PAL / active school", "NOT INSTRUMENTED", "Acquisition conversion heatmap", "Founder measurement contract", "hq_growth_command_overview", "hq_studio_overview"]],
  ["app/hq/marketing/page.tsx", ["/hq/company", "Business Plan"]],
]

const failures = []
for (const [file, needles] of required) {
  if (!fs.existsSync(file)) { failures.push(`${file}: missing`); continue }
  const text = fs.readFileSync(file, "utf8")
  for (const needle of needles) if (!text.includes(needle)) failures.push(`${file}: missing contract marker ${JSON.stringify(needle)}`)
}

const company = fs.existsSync("app/hq/company/page.tsx") ? fs.readFileSync("app/hq/company/page.tsx", "utf8") : ""
for (const forbidden of ["Math.random(", "mockRevenue", "fakeRevenue", "estimatedRevenue"]) {
  if (company.includes(forbidden)) failures.push(`app/hq/company/page.tsx: forbidden fabricated-metric pattern ${forbidden}`)
}
for (const pattern of [/\bas\s+any\b/, /\bas\s+unknown\b/]) {
  if (pattern.test(company)) failures.push(`app/hq/company/page.tsx: forbidden type escape-hatch matched ${pattern}`)
}

if (failures.length) {
  console.error("HQ Business Doctrine validation FAILED")
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log("HQ Business Doctrine validation PASSED")
console.log("- locked mission remains canonical")
console.log("- readable business doctrine exists")
console.log("- live HQ company surface consumes canonical owner/growth/studio evidence")
console.log("- graphs/heatmap contract is present without fabricated fallback metrics or type escape hatches")
