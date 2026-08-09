import type { DigitalWorkerDefinition } from "./types"

export interface WorkSignal {
  id: string
  departmentKey?: string
  competency?: string
  priority: "low" | "normal" | "high" | "critical"
  approvalRequired?: boolean
}

export interface RoutingDecision {
  signalId: string
  workerKey: string | null
  reason: string
  requiresHuman: boolean
}

export function routeWork(signal: WorkSignal, workers: DigitalWorkerDefinition[]): RoutingDecision {
  if (signal.approvalRequired) {
    return { signalId: signal.id, workerKey: null, reason: "Source work item requires human approval.", requiresHuman: true }
  }
  const eligible = workers.filter((worker) =>
    worker.status === "active" &&
    (!signal.departmentKey || worker.departmentKey === signal.departmentKey) &&
    (!signal.competency || worker.competencies.includes(signal.competency))
  )
  if (eligible.length === 0) {
    return {
      signalId: signal.id,
      workerKey: null,
      reason: "No active worker satisfies explicit department and competency constraints.",
      requiresHuman: signal.priority === "critical",
    }
  }
  return {
    signalId: signal.id,
    workerKey: eligible[0].key,
    reason: "Matched active worker by deterministic department and competency rules.",
    requiresHuman: false,
  }
}
