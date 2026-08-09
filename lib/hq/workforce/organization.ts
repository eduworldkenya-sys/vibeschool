import type { DigitalWorkerDefinition } from "./types"

export type CompanyFunction = {
  key: string
  name: string
  departmentKey: string
  purpose: string
  requiredCompetencies: string[]
  criticality: "low" | "normal" | "high" | "critical"
  workPattern: "routine" | "strategic" | "temporary" | "mixed"
}

export type OrganizationalFinding = {
  key: string
  severity: "info" | "warning" | "critical"
  message: string
  evidence: Record<string, unknown>
}

export function workersForFunction(fn: CompanyFunction, workers: DigitalWorkerDefinition[]) {
  return workers.filter((worker) =>
    worker.departmentKey === fn.departmentKey &&
    fn.requiredCompetencies.every((competency) => worker.competencies.includes(competency)) &&
    worker.status !== "retired",
  )
}

export function auditOrganization(functions: CompanyFunction[], workers: DigitalWorkerDefinition[]): OrganizationalFinding[] {
  const findings: OrganizationalFinding[] = []

  for (const fn of functions) {
    const owners = workersForFunction(fn, workers)
    if (owners.length === 0) {
      findings.push({
        key: `unowned:${fn.key}`,
        severity: fn.criticality === "critical" ? "critical" : "warning",
        message: `${fn.name} has no qualified worker owner.`,
        evidence: { functionKey: fn.key, departmentKey: fn.departmentKey, requiredCompetencies: fn.requiredCompetencies },
      })
    } else if (owners.length > 1) {
      findings.push({
        key: `overlap:${fn.key}`,
        severity: "info",
        message: `${fn.name} has overlapping qualified ownership.`,
        evidence: { functionKey: fn.key, workerKeys: owners.map((worker) => worker.key) },
      })
    }
  }

  for (const worker of workers) {
    if (worker.status === "retired") continue
    const owned = functions.filter((fn) => workersForFunction(fn, [worker]).length > 0)
    if (owned.length === 0) {
      findings.push({
        key: `purpose:${worker.key}`,
        severity: "warning",
        message: `${worker.title} currently owns no declared company function.`,
        evidence: { workerKey: worker.key, departmentKey: worker.departmentKey },
      })
    }
  }

  return findings
}

export function organizationChart(workers: DigitalWorkerDefinition[]) {
  return workers.map((worker) => ({
    key: worker.key,
    title: worker.title,
    departmentKey: worker.departmentKey,
    managerKey: worker.managerKey ?? null,
    mission: worker.mission,
    status: worker.status,
  }))
}
