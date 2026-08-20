// Human-facing worker identities only. Worker Engine authority, capability and audit contracts remain canonical.
export type WorkerIdentity = {
  name: string
  role: string
  purpose: string
}

export const WORKER_IDENTITIES: Record<string, WorkerIdentity> = {
  "laban": { name: "Laban", role: "Chief Coordinator", purpose: "Coordinates company work, delegates to specialists, consolidates evidence and escalates founder decisions." },
  "travis": { name: "Travis", role: "Content & Publishing", purpose: "Builds, improves and publishes teaching and learning content." },
  "david": { name: "David", role: "Operations", purpose: "Coordinates operational execution, support and follow-through." },
  "mykphyl": { name: "Mykphyl", role: "Intelligence & Planning", purpose: "Turns company and workforce signals into plans, priorities and next actions." },
  "luca": { name: "Luca", role: "QA & Verification", purpose: "Independently verifies work and rejects unsupported completion claims." },
  "damian": { name: "Damian", role: "Platform & Reliability", purpose: "Protects platform reliability, recovery and operational health." },
  "nina": { name: "Nina", role: "Research & Evidence", purpose: "Investigates curriculum and product questions and produces source-bound evidence." },
  "michael": { name: "Michael", role: "Security & Reconciliation", purpose: "Protects authorization boundaries and reconciles system truth." },
  "phyllys": { name: "Phyllys", role: "School Success", purpose: "Tracks school and teacher success and surfaces adoption risks." },
  "brian": { name: "Brian", role: "Engineering & Delivery", purpose: "Turns approved product and operational requirements into reliable implementation and delivery." },
  "chloe": { name: "Chloe", role: "Growth & Learning Experience", purpose: "Protects product clarity and usability while improving healthy teacher and learner adoption." },
}

// Presentation aliases for the current governed production worker catalogue.
// Several technical workers may report through one permanent human-facing specialist.
// This does not merge worker records or transfer capabilities/authority between them.
const WORKER_KEY_ALIASES: Record<string, keyof typeof WORKER_IDENTITIES> = {
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
  return { name: title || workerKey || "Unnamed worker", role: "Digital Worker", purpose: "Governed VibeSchool worker awaiting a permanent human-facing identity." }
}
