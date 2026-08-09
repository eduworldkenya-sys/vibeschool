import { WORKER_TEMPLATES, type WorkerTemplateKey } from "./templates"
import type { DigitalWorkerDefinition } from "./types"

export function createWorkerFromTemplate(
  templateKey: WorkerTemplateKey,
  overrides: Partial<Pick<DigitalWorkerDefinition, "key" | "title" | "departmentKey" | "managerKey" | "mission">> = {},
): DigitalWorkerDefinition {
  const source = WORKER_TEMPLATES[templateKey]
  return {
    ...source,
    ...overrides,
    responsibilities: [...source.responsibilities],
    competencies: [...source.competencies],
    executionOrder: [...source.executionOrder],
    authority: source.authority.map((rule) => ({ ...rule })),
    triggers: source.triggers.map((trigger) => ({ ...trigger })),
    kpis: source.kpis.map((kpi) => ({ ...kpi })),
    status: "draft",
    version: source.version,
  }
}

export function buildFoundingDigitalWorkforce(): DigitalWorkerDefinition[] {
  return (Object.keys(WORKER_TEMPLATES) as WorkerTemplateKey[]).map((key) => createWorkerFromTemplate(key))
}
