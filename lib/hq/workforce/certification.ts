import type { DigitalWorkerDefinition } from "./types"

export interface WorkerCertificationCheck {
  key: string
  passed: boolean
  evidence: string
}

export interface WorkerCertificationResult {
  passed: boolean
  checks: WorkerCertificationCheck[]
}

export function certifyWorker(worker: DigitalWorkerDefinition): WorkerCertificationResult {
  const externalAiRule = worker.authority.find((rule) => rule.action === "external_ai")
  const wildcard = worker.authority.find((rule) => rule.action === "*")
  const checks: WorkerCertificationCheck[] = [
    { key: "mission", passed: worker.mission.trim().length >= 20, evidence: `Mission length=${worker.mission.trim().length}.` },
    { key: "responsibilities", passed: worker.responsibilities.length >= 3, evidence: `Responsibilities=${worker.responsibilities.length}.` },
    { key: "competencies", passed: worker.competencies.length >= 1, evidence: `Competencies=${worker.competencies.length}.` },
    { key: "kpis", passed: worker.kpis.length >= 1, evidence: `KPIs=${worker.kpis.length}.` },
    { key: "deterministic_first", passed: worker.executionOrder[0] === "deterministic", evidence: `First execution mode=${worker.executionOrder[0]}.` },
    { key: "paid_ai_denied", passed: externalAiRule?.mode === "deny", evidence: `external_ai=${externalAiRule?.mode ?? "missing"}.` },
    { key: "unknown_action_safe", passed: wildcard?.mode === "approval_required", evidence: `wildcard=${wildcard?.mode ?? "missing"}.` },
    { key: "draft_on_create", passed: worker.status === "draft", evidence: `status=${worker.status}.` },
  ]
  return { passed: checks.every((check) => check.passed), checks }
}

export function promoteToProbation(worker: DigitalWorkerDefinition, certification: WorkerCertificationResult): DigitalWorkerDefinition {
  if (!certification.passed) throw new Error(`Worker ${worker.key} failed certification.`)
  return { ...worker, status: "probation" }
}

export function activateWorker(worker: DigitalWorkerDefinition, approvedByFounder: boolean): DigitalWorkerDefinition {
  if (worker.status !== "probation") throw new Error(`Worker ${worker.key} must be in probation before activation.`)
  if (!approvedByFounder) throw new Error(`Worker ${worker.key} activation requires founder approval.`)
  return { ...worker, status: "active" }
}
