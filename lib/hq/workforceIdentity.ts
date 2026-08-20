// Human-facing worker identities only. Worker Engine authority, capability and audit contracts remain canonical.
export type WorkerIdentity = {
  name: string
  role: string
  purpose: string
}

export const WORKER_IDENTITIES: Record<string, WorkerIdentity> = {
  "laban": { name: "Laban", role: "Chief Coordinator", purpose: "Coordinates company work, delegates to specialists, consolidates evidence and escalates founder decisions." },
  "travis": { name: "Travis", role: "Content", purpose: "Builds and improves teaching and learning content." },
  "david": { name: "David", role: "Operations", purpose: "Coordinates operational execution and follow-through." },
  "mykphyl": { name: "Mykphyl", role: "Intelligence & Planning", purpose: "Turns company signals into plans, priorities and next actions." },
  "luca": { name: "Luca", role: "QA & Verification", purpose: "Independently verifies work and rejects unsupported completion claims." },
  "damian": { name: "Damian", role: "Platform & Reliability", purpose: "Protects platform reliability, recovery and operational health." },
  "nina": { name: "Nina", role: "Research & Evidence", purpose: "Investigates questions and produces source-bound evidence." },
  "michael": { name: "Michael", role: "Security & Reconciliation", purpose: "Protects authorization boundaries and reconciles system truth." },
  "phyllys": { name: "Phyllys", role: "School Success", purpose: "Tracks school and teacher success and surfaces adoption risks." },
  "brian": { name: "Brian", role: "Engineering & Delivery", purpose: "Turns approved product and operational requirements into reliable implementation and delivery." },
  "chloe": { name: "Chloe", role: "Learning Experience", purpose: "Protects the clarity, usability and quality of teacher and learner experiences." },
}

const WORKER_KEY_ALIASES: Record<string, keyof typeof WORKER_IDENTITIES> = {
  "curriculum-worker-01": "nina",
  "quality-worker-01": "luca",
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
