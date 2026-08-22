export type RuntimeResourceSnapshot = {
  workerKey: string
  globalStop: boolean
  runtimeEnabled: boolean
  breakerTripped: boolean
  maxConcurrency: number
  activeExecutions: number
  maxExecutionsPerMinute: number
  executionsLastMinute: number
  budgetExhausted?: boolean
}

export class WorkerExecutionBlockedError extends Error {
  constructor(public readonly code: string, public readonly workerKey: string) {
    super(`${code}:${workerKey}`)
    this.name = "WorkerExecutionBlockedError"
  }
}

export function assertRuntimeResourceLimits(snapshot: RuntimeResourceSnapshot): void {
  if (snapshot.globalStop) throw new WorkerExecutionBlockedError("GLOBAL_STOP_ACTIVE", snapshot.workerKey)
  if (!snapshot.runtimeEnabled) throw new WorkerExecutionBlockedError("RUNTIME_DISABLED", snapshot.workerKey)
  if (snapshot.breakerTripped) throw new WorkerExecutionBlockedError("CIRCUIT_BREAKER_TRIPPED", snapshot.workerKey)
  if (snapshot.budgetExhausted) throw new WorkerExecutionBlockedError("EXECUTION_BUDGET_EXHAUSTED", snapshot.workerKey)
  if (!Number.isInteger(snapshot.maxConcurrency) || snapshot.maxConcurrency < 1) throw new WorkerExecutionBlockedError("INVALID_CONCURRENCY_POLICY", snapshot.workerKey)
  if (!Number.isInteger(snapshot.maxExecutionsPerMinute) || snapshot.maxExecutionsPerMinute < 1) throw new WorkerExecutionBlockedError("INVALID_RATE_POLICY", snapshot.workerKey)
  if (snapshot.activeExecutions >= snapshot.maxConcurrency) throw new WorkerExecutionBlockedError("CONCURRENCY_LIMIT_EXCEEDED", snapshot.workerKey)
  if (snapshot.executionsLastMinute >= snapshot.maxExecutionsPerMinute) throw new WorkerExecutionBlockedError("RATE_LIMIT_EXCEEDED", snapshot.workerKey)
}

export async function guardedWorkerExecution<T>(loadSnapshot: () => Promise<RuntimeResourceSnapshot>, execute: () => Promise<T>): Promise<T> {
  const snapshot = await loadSnapshot()
  assertRuntimeResourceLimits(snapshot)
  return execute()
}
