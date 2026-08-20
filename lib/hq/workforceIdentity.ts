// Human-facing worker identities only. Worker Engine authority, capability and audit contracts remain canonical.
export type WorkerIdentity = {
  key: string
  name: string
  role: string
  purpose: string
  reportsTo: string | null
  mapped: boolean
}

type IdentitySeed = Omit<WorkerIdentity,"key"|"mapped">

const IDENTITY_SEEDS: Record<string,IdentitySeed> = {
  laban: { name: "Laban", role: "Chief Coordinator", purpose: "Coordinates company work, delegates to specialists, consolidates evidence and escalates founder decisions.", reportsTo: null },
  travis: { name: "Travis", role: "Content & Publishing", purpose: "Builds, improves and publishes teaching and learning content.", reportsTo: "laban" },
  david: { name: "David", role: "Operations", purpose: "Coordinates operational execution, support and follow-through.", reportsTo: "laban" },
  mykphyl: { name: "Mykphyl", role: "Intelligence & Planning", purpose: "Turns company and workforce signals into plans, priorities and next actions.", reportsTo: "laban" },
  luca: { name: "Luca", role: "QA & Verification", purpose: "Independently verifies work and rejects unsupported completion claims.", reportsTo: "laban" },
  damian: { name: "Damian", role: "Platform & Reliability", purpose: "Protects platform reliability, recovery and operational health.", reportsTo: "laban" },
  nina: { name: "Nina", role: "Research & Evidence", purpose: "Investigates curriculum and product questions and produces source-bound evidence.", reportsTo: "laban" },
  michael: { name: "Michael", role: "Security & Reconciliation", purpose: "Protects authorization boundaries and reconciles system truth.", reportsTo: "laban" },
  phyllys: { name: "Phyllys", role: "School Success", purpose: "Tracks school and teacher success and surfaces adoption risks.", reportsTo: "laban" },
  brian: { name: "Brian", role: "Engineering & Delivery", purpose: "Turns approved product and operational requirements into reliable implementation and delivery.", reportsTo: "laban" },
  chloe: { name: "Chloe", role: "Growth & Learning Experience", purpose: "Protects product clarity and usability while improving healthy teacher and learner adoption.", reportsTo: "laban" },
}

export const WORKER_IDENTITIES: Record<string,WorkerIdentity> = Object.fromEntries(
  Object.entries(IDENTITY_SEEDS).map(([key,value])=>[key,{key,...value,mapped:true}])
)

// Presentation aliases for the current governed production worker catalogue.
// Several technical workers may report through one permanent human-facing specialist.
// This does not merge worker records or transfer capabilities/authority between them.
export const WORKER_KEY_ALIASES: Record<string,keyof typeof WORKER_IDENTITIES> = {
  "curriculum-worker-01": "nina",
  "quality-worker-01": "luca",
  "finance-worker-01": "laban",
  "growth-worker-01": "chloe",
  "workforce-intel-worker-01": "mykphyl",
  "ops-worker-01": "david",
  "publishing-worker-01": "travis",
  "school-success-worker-01": "phyllys",
  "security-worker-01": "michael",
  "support-worker-01": "david",
  "content-factory-r2-canary-01": "brian",
}

export function workerIdentity(workerKey?: string | null, title?: string | null): WorkerIdentity {
  const raw = String(workerKey ?? "").toLowerCase()
  const alias = WORKER_KEY_ALIASES[raw]
  if (alias) return WORKER_IDENTITIES[alias]
  for (const [key, identity] of Object.entries(WORKER_IDENTITIES)) {
    if (raw === key || raw.startsWith(`${key}-`) || raw.includes(`-${key}-`)) return identity
  }
  return { key: raw||"unmapped", name: title || workerKey || "System worker", role: "Temporary / system worker", purpose: "Governed technical worker that has not been promoted into the permanent named team.", reportsTo: null, mapped:false }
}

export function humanWorkerStatus(workerStatus?:string|null,workStatuses:string[]=[]): string {
  const s=String(workerStatus??"").toLowerCase()
  const work=workStatuses.map(x=>String(x).toLowerCase())
  if (["suspended","retired"].includes(s)) return "Stopped"
  if (s==="restricted" || work.includes("blocked")) return "Blocked"
  if (work.some(x=>["waiting_review","waiting_approval"].includes(x))) return "Waiting for review"
  if (work.some(x=>["assigned","working","in_progress"].includes(x))) return "Working"
  if (["active","probation"].includes(s)) return "Available"
  return "Stopped"
}

export function identityRegistryState(workerKey?:string|null,title?:string|null,status?:string|null){
  const identity=workerIdentity(workerKey,title)
  const permanent=["active","probation","restricted"].includes(String(status??"").toLowerCase())
  return {
    worker_key: workerKey ?? "",
    title: title ?? "",
    status: status ?? "",
    identity,
    permanent,
    needsMapping: permanent&&!identity.mapped,
    label: identity.mapped?"Named team":"Temporary / system-only",
  }
}
