export type WorkUnit = {
  key: string
  name: string
  description: string
  functionKey: string
  repeatability: "one_off" | "recurring" | "continuous"
  nature: "routine" | "strategic" | "mixed"
}

export type JobDefinition = {
  key: string
  title: string
  purpose: string
  roleKeys: string[]
}

export type RoleDefinition = {
  key: string
  name: string
  functionKey: string
  responsibilities: string[]
  requiredCompetencies: string[]
}

export type FunctionDefinition = {
  key: string
  name: string
  departmentKey: string
  purpose: string
  workKeys: string[]
}

export type DepartmentDefinition = {
  key: string
  name: string
  purpose: string
  functionKeys: string[]
  managerWorkerKey?: string
}

export type WorkerAssignment = {
  workerKey: string
  jobKey: string
  roleKeys: string[]
  departmentKey: string
}

export type WorkModel = {
  work: WorkUnit[]
  jobs: JobDefinition[]
  roles: RoleDefinition[]
  functions: FunctionDefinition[]
  departments: DepartmentDefinition[]
  assignments: WorkerAssignment[]
}

export type WorkModelFinding = {
  key: string
  severity: "warning" | "critical"
  message: string
}

export function validateWorkModel(model: WorkModel): WorkModelFinding[] {
  const findings: WorkModelFinding[] = []
  const workKeys = new Set(model.work.map((item) => item.key))
  const roleKeys = new Set(model.roles.map((item) => item.key))
  const functionKeys = new Set(model.functions.map((item) => item.key))
  const departmentKeys = new Set(model.departments.map((item) => item.key))
  const jobKeys = new Set(model.jobs.map((item) => item.key))

  for (const item of model.work) if (!functionKeys.has(item.functionKey)) findings.push({ key: `work-function:${item.key}`, severity: "critical", message: `Work ${item.key} references missing function ${item.functionKey}.` })
  for (const role of model.roles) if (!functionKeys.has(role.functionKey)) findings.push({ key: `role-function:${role.key}`, severity: "critical", message: `Role ${role.key} references missing function ${role.functionKey}.` })
  for (const fn of model.functions) {
    if (!departmentKeys.has(fn.departmentKey)) findings.push({ key: `function-department:${fn.key}`, severity: "critical", message: `Function ${fn.key} references missing department ${fn.departmentKey}.` })
    for (const key of fn.workKeys) if (!workKeys.has(key)) findings.push({ key: `function-work:${fn.key}:${key}`, severity: "critical", message: `Function ${fn.key} references missing work ${key}.` })
  }
  for (const department of model.departments) for (const key of department.functionKeys) if (!functionKeys.has(key)) findings.push({ key: `department-function:${department.key}:${key}`, severity: "critical", message: `Department ${department.key} references missing function ${key}.` })
  for (const job of model.jobs) for (const key of job.roleKeys) if (!roleKeys.has(key)) findings.push({ key: `job-role:${job.key}:${key}`, severity: "critical", message: `Job ${job.key} references missing role ${key}.` })
  for (const assignment of model.assignments) {
    if (!jobKeys.has(assignment.jobKey)) findings.push({ key: `assignment-job:${assignment.workerKey}`, severity: "critical", message: `Worker ${assignment.workerKey} references missing job ${assignment.jobKey}.` })
    if (!departmentKeys.has(assignment.departmentKey)) findings.push({ key: `assignment-department:${assignment.workerKey}`, severity: "critical", message: `Worker ${assignment.workerKey} references missing department ${assignment.departmentKey}.` })
    for (const key of assignment.roleKeys) if (!roleKeys.has(key)) findings.push({ key: `assignment-role:${assignment.workerKey}:${key}`, severity: "critical", message: `Worker ${assignment.workerKey} references missing role ${key}.` })
  }

  return findings
}
