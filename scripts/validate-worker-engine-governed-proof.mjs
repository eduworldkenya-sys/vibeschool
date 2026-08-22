import { readFileSync } from "node:fs"

const path = "lib/hq/workforce/governed-runtime.test.ts"
const source = readFileSync(path, "utf8")
const forbidden = [/\bas\s+(?:any|unknown)\b/, /@ts-ignore/, /@ts-nocheck/, /eslint-disable/, /\.skip\(/]
const hit = forbidden.find(pattern => pattern.test(source))
if (hit) {
  console.error(`Forbidden governed-proof escape hatch matched: ${hit}`)
  process.exit(1)
}
console.log("Worker Engine governed proof escape-hatch audit passed.")
