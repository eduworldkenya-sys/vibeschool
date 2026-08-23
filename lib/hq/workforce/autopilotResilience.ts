import { createHash, randomUUID } from "node:crypto"

export type AutopilotFailureClass = "transient" | "capacity" | "data" | "policy" | "quality" | "security" | "system"
export type AutopilotRecoveryDisposition = "retry" | "degrade" | "fail_closed"
export type AutopilotEffectKind = "read_only" | "reversible" | "compensatable" | "irreversible"

export interface AutopilotFailureSignal {
  code: string
  retryable?: boolean
  rateLimited?: boolean
  malformedInput?: boolean
  policyDenied?: boolean
  qualityRejected?: boolean
  securityViolation?: boolean
  invariantBroken?: boolean
}

export function classifyAutopilotFailure(signal: AutopilotFailureSignal): AutopilotFailureClass {
  if (signal.securityViolation) return "security"
  if (signal.policyDenied) return "policy"
  if (signal.invariantBroken) return "system"
  if (signal.qualityRejected) return "quality"
  if (signal.malformedInput) return "data"
  if (signal.rateLimited) return "capacity"
  if (signal.retryable) return "transient"
  return "system"
}

export function recoveryDisposition(failureClass: AutopilotFailureClass): AutopilotRecoveryDisposition {
  if (failureClass === "transient" || failureClass === "capacity") return "retry"
  if (failureClass === "quality") return "degrade"
  return "fail_closed"
}

export function backoffDelayMs(attempt: number, baseMs = 250, maxMs = 10_000): number {
  const exponent = Math.max(0, Math.min(10, attempt - 1))
  return Math.min(maxMs, baseMs * (2 ** exponent))
}

export interface MissionTraceEvent {
  eventId: string
  missionId: string
  missionRevision: string
  traceId: string
  sequence: number
  parentEventId?: string
  stage: string
  workerKey?: string
  action: string
  status: "started" | "completed" | "recovering" | "blocked" | "failed" | "stopped"
  envelopeHash?: string
  outputHash?: string
  capabilityRef?: string
  tokens?: number
  compute?: number
  latencyMs?: number
  retryCount?: number
  failureClass?: AutopilotFailureClass
  evidenceRefs: string[]
  createdAt: string
}

export interface TraceSink {
  append(event: MissionTraceEvent): Promise<void>
}

export function hashAutopilotValue(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

export class MissionFlightRecorder {
  private sequence = 0
  private parentEventId: string | undefined

  constructor(
    private readonly missionId: string,
    private readonly missionRevision: string,
    private readonly traceId: string,
    private readonly sink: TraceSink,
  ) {
    if (!missionId.trim() || !missionRevision.trim() || !traceId.trim()) throw new Error("AUTOPILOT_TRACE_IDENTITY_REQUIRED")
  }

  async record(input: Omit<MissionTraceEvent, "eventId" | "missionId" | "missionRevision" | "traceId" | "sequence" | "parentEventId" | "createdAt">): Promise<MissionTraceEvent> {
    this.sequence += 1
    const event: MissionTraceEvent = Object.freeze({
      ...input,
      eventId: randomUUID(),
      missionId: this.missionId,
      missionRevision: this.missionRevision,
      traceId: this.traceId,
      sequence: this.sequence,
      parentEventId: this.parentEventId,
      evidenceRefs: [...input.evidenceRefs],
      createdAt: new Date().toISOString(),
    })
    await this.sink.append(event)
    this.parentEventId = event.eventId
    return event
  }
}

export interface IdempotencyRecord {
  key: string
  commandHash: string
  state: "claimed" | "committed" | "failed"
  resultHash?: string
}

export interface IdempotencyStore {
  get(key: string): Promise<IdempotencyRecord | null>
  claim(record: IdempotencyRecord): Promise<boolean>
  commit(key: string, resultHash: string): Promise<void>
  fail(key: string): Promise<void>
}

export async function claimConsequentialCommand(store: IdempotencyStore, key: string, command: unknown): Promise<"claimed" | "already_committed"> {
  if (!key.trim()) throw new Error("AUTOPILOT_IDEMPOTENCY_KEY_REQUIRED")
  const commandHash = hashAutopilotValue(command)
  const existing = await store.get(key)
  if (existing) {
    if (existing.commandHash !== commandHash) throw new Error("AUTOPILOT_IDEMPOTENCY_KEY_REUSE_MISMATCH")
    if (existing.state === "committed") return "already_committed"
    throw new Error("AUTOPILOT_COMMAND_ALREADY_IN_FLIGHT")
  }
  const claimed = await store.claim({ key, commandHash, state: "claimed" })
  if (!claimed) throw new Error("AUTOPILOT_IDEMPOTENCY_CLAIM_RACE")
  return "claimed"
}

export interface CircuitBreakerState {
  consecutiveFailures: number
  openedAt?: number
}

export class AutopilotCircuitBreaker {
  private state: CircuitBreakerState = { consecutiveFailures: 0 }

  constructor(private readonly threshold = 3, private readonly cooldownMs = 30_000) {}

  assertAvailable(now = Date.now()): void {
    if (this.state.openedAt == null) return
    if (now - this.state.openedAt >= this.cooldownMs) {
      this.state = { consecutiveFailures: 0 }
      return
    }
    throw new Error("AUTOPILOT_CIRCUIT_OPEN")
  }

  success(): void { this.state = { consecutiveFailures: 0 } }

  failure(now = Date.now()): void {
    const consecutiveFailures = this.state.consecutiveFailures + 1
    this.state = {
      consecutiveFailures,
      openedAt: consecutiveFailures >= this.threshold ? now : this.state.openedAt,
    }
  }

  snapshot(): Readonly<CircuitBreakerState> { return Object.freeze({ ...this.state }) }
}

const HOSTILE_INSTRUCTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /reveal\s+(the\s+)?system\s+prompt/i,
  /dump\s+.*(secret|token|budget|credential)/i,
  /bypass\s+.*(policy|authorization|guard|cyborg)/i,
  /execute\s+.*(sql|shell|command)/i,
]
const SECRET_KEYS = new Set(["password", "secret", "api_key", "apikey", "service_role", "service_role_key", "access_token", "refresh_token", "authorization"])

export interface IsolatedExternalPayload {
  provenance: "external_untrusted"
  injectionSuspected: boolean
  data: unknown
}

function stripSecretKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSecretKeys)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !SECRET_KEYS.has(key.toLowerCase()))
      .map(([key, child]) => [key, stripSecretKeys(child)]),
  )
}

function containsHostileInstruction(value: unknown): boolean {
  if (typeof value === "string") return HOSTILE_INSTRUCTION_PATTERNS.some((pattern) => pattern.test(value))
  if (Array.isArray(value)) return value.some(containsHostileInstruction)
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).some(containsHostileInstruction)
  return false
}

export function isolateExternalPayload(value: unknown): IsolatedExternalPayload {
  return Object.freeze({
    provenance: "external_untrusted" as const,
    injectionSuspected: containsHostileInstruction(value),
    data: stripSecretKeys(value),
  })
}

export interface StructuredModelBoundary {
  trustedPolicy: Readonly<{ workerKey: string; workflowKey: string; allowedTools: string[]; authorityScope: string[] }>
  untrustedInput: IsolatedExternalPayload
}

export function buildStructuredModelBoundary(input: {
  workerKey: string
  workflowKey: string
  allowedTools: string[]
  authorityScope: string[]
  externalPayload: unknown
}): StructuredModelBoundary {
  if (!input.workerKey.trim() || !input.workflowKey.trim()) throw new Error("AUTOPILOT_MODEL_BOUNDARY_IDENTITY_REQUIRED")
  const untrustedInput = isolateExternalPayload(input.externalPayload)
  return Object.freeze({
    trustedPolicy: Object.freeze({
      workerKey: input.workerKey,
      workflowKey: input.workflowKey,
      allowedTools: [...new Set(input.allowedTools)],
      authorityScope: [...new Set(input.authorityScope)],
    }),
    untrustedInput,
  })
}

export function assertToolAllowed(boundary: StructuredModelBoundary, tool: string): void {
  if (!boundary.trustedPolicy.allowedTools.includes(tool)) throw new Error("AUTOPILOT_TOOL_NOT_ALLOWED")
  if (boundary.untrustedInput.injectionSuspected && tool !== "none") throw new Error("AUTOPILOT_HOSTILE_INPUT_TOOL_DENIED")
}

export interface ResilientStepContext {
  missionId: string
  missionRevision: string
  traceId: string
  stage: string
  workerKey: string
  effectKind: AutopilotEffectKind
  maxAttempts: number
  idempotencyKey?: string
}

export interface ResilientStepAdapters<T> {
  globalStopActive(): Promise<boolean>
  authorityGranted(): Promise<boolean>
  execute(attempt: number): Promise<T>
  classify(error: unknown): AutopilotFailureSignal
  recorder: MissionFlightRecorder
  circuitBreaker: AutopilotCircuitBreaker
  idempotency?: IdempotencyStore
  sleep?(ms: number): Promise<void>
}

export interface ResilientStepOutcome<T> {
  status: "completed" | "blocked" | "failed"
  value?: T
  attempts: number
  reason?: string
}

export async function runResilientStep<T>(context: ResilientStepContext, adapters: ResilientStepAdapters<T>): Promise<ResilientStepOutcome<T>> {
  if (context.maxAttempts < 1 || context.maxAttempts > 8) throw new Error("AUTOPILOT_ATTEMPT_BUDGET_INVALID")
  const consequential = context.effectKind !== "read_only"
  if (consequential && !context.idempotencyKey) return { status: "blocked", attempts: 0, reason: "AUTOPILOT_IDEMPOTENCY_REQUIRED" }
  if (await adapters.globalStopActive()) return { status: "blocked", attempts: 0, reason: "AUTOPILOT_GLOBAL_STOP_ACTIVE" }
  if (!(await adapters.authorityGranted())) return { status: "blocked", attempts: 0, reason: "AUTOPILOT_AUTHORITY_REQUIRED" }

  let claimed = false
  if (consequential) {
    if (!adapters.idempotency) return { status: "blocked", attempts: 0, reason: "AUTOPILOT_IDEMPOTENCY_STORE_REQUIRED" }
    const result = await claimConsequentialCommand(adapters.idempotency, context.idempotencyKey!, { missionId: context.missionId, missionRevision: context.missionRevision, stage: context.stage, workerKey: context.workerKey, effectKind: context.effectKind })
    if (result === "already_committed") return { status: "completed", attempts: 0, reason: "AUTOPILOT_ALREADY_COMMITTED" }
    claimed = true
  }

  for (let attempt = 1; attempt <= context.maxAttempts; attempt += 1) {
    try {
      if (await adapters.globalStopActive()) throw Object.assign(new Error("AUTOPILOT_GLOBAL_STOP_ACTIVE"), { policyDenied: true })
      if (!(await adapters.authorityGranted())) throw Object.assign(new Error("AUTOPILOT_AUTHORITY_REQUIRED"), { policyDenied: true })
      adapters.circuitBreaker.assertAvailable()
      await adapters.recorder.record({ stage: context.stage, workerKey: context.workerKey, action: "execute", status: attempt === 1 ? "started" : "recovering", retryCount: attempt - 1, evidenceRefs: [] })
      const started = Date.now()
      const value = await adapters.execute(attempt)
      adapters.circuitBreaker.success()
      const resultHash = hashAutopilotValue(value)
      if (claimed) await adapters.idempotency!.commit(context.idempotencyKey!, resultHash)
      await adapters.recorder.record({ stage: context.stage, workerKey: context.workerKey, action: "execute", status: "completed", outputHash: resultHash, latencyMs: Math.max(0, Date.now() - started), retryCount: attempt - 1, evidenceRefs: [] })
      return { status: "completed", value, attempts: attempt }
    } catch (error) {
      const signal = adapters.classify(error)
      const failureClass = classifyAutopilotFailure(signal)
      const disposition = recoveryDisposition(failureClass)
      adapters.circuitBreaker.failure()
      await adapters.recorder.record({ stage: context.stage, workerKey: context.workerKey, action: "failure", status: disposition === "retry" ? "recovering" : "failed", retryCount: attempt - 1, failureClass, evidenceRefs: [], outputHash: hashAutopilotValue({ code: signal.code }) })
      if (disposition !== "retry" || attempt >= context.maxAttempts) {
        if (claimed) await adapters.idempotency!.fail(context.idempotencyKey!)
        return { status: failureClass === "policy" || failureClass === "security" ? "blocked" : "failed", attempts: attempt, reason: signal.code }
      }
      await (adapters.sleep ?? (async () => undefined))(backoffDelayMs(attempt))
    }
  }

  if (claimed) await adapters.idempotency!.fail(context.idempotencyKey!)
  return { status: "failed", attempts: context.maxAttempts, reason: "AUTOPILOT_ATTEMPT_BUDGET_EXHAUSTED" }
}
