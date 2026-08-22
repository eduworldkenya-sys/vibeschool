import { execFileSync } from "node:child_process"
import { rmSync } from "node:fs"

const outDir = ".tmp/hq-governed-proof"
rmSync(outDir, { recursive: true, force: true })
execFileSync("npx", ["--no-install", "tsc", "lib/hq/workforce/governed-runtime.test.ts", "--outDir", outDir, "--module", "commonjs", "--target", "es2022", "--moduleResolution", "node", "--esModuleInterop", "--skipLibCheck", "--types", "node"], { stdio: "inherit" })
execFileSync("node", ["--test", `${outDir}/governed-runtime.test.js`], { stdio: "inherit" })
