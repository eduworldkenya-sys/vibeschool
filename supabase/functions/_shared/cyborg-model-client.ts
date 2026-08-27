import { hashModelRequest, receiptHash } from './cyborg-capability.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ADMISSION_URL = Deno.env.get('CYBORG_ADMISSION_URL') ?? `${SUPABASE_URL}/functions/v1/cyborg-admission`
const GATEWAY_URL = Deno.env.get('CYBORG_LLM_GATEWAY_URL') ?? `${SUPABASE_URL}/functions/v1/cyborg-llm-gateway`
const ADMISSION_TIMEOUT_MS = 12_000
const GATEWAY_TIMEOUT_MS = 30_000

export type CyborgSourceAuthority = {
  kind: 'service' | 'worker_model_invocation' | 'chemistry_stage_attempt'
  ref: string
  token?: string
}

export type EdgeCyborgInput = {
  callerServiceId: string
  actorKey: string
  externalChatId: string
  objective: string
  missionId?: string
  provider: 'groq' | 'anthropic' | string
  model: string
  maxTokens: number
  messages: unknown[]
  metadata?: Record<string, unknown>
  dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted'
  stageLease?: { attemptId: string; leaseToken: string }
  sourceAuthority?: CyborgSourceAuthority
}

export type EdgeCyborgResult = {
  missionId: string
  missionRevision: string
  chatId: string
  invocationId: string
  output: unknown
  lineage: Record<string, unknown>
}

export type EdgeCyborgFallbackRoute = { provider: string; model: string; maxTokens?: number }

export class CyborgGatewayError extends Error {
  details: Record<string, unknown>
  constructor(code: string, details: Record<string, unknown>) {
    super(`CYBORG_GATEWAY_FAILED:${code}`)
    this.details = details
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export async function invokeCyborgEdgeModel(input: EdgeCyborgInput): Promise<EdgeCyborgResult> {
  if (!SUPABASE_URL || !SERVICE_ROLE) throw new Error('CYBORG_ADMISSION_SERVICE_IDENTITY_REQUIRED')
  const operation = 'model.generate'
  const metadata = input.metadata ?? {}
  const requestHash = await hashModelRequest({
    callerServiceId: input.callerServiceId,
    provider: input.provider,
    model: input.model,
    operation,
    maxTokens: input.maxTokens,
    messages: input.messages,
    metadata,
  })
  const admissionResponse = await fetch(ADMISSION_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${SERVICE_ROLE}`,
      'x-cyborg-caller-id': input.callerServiceId,
    },
    body: JSON.stringify({
      actorKey: input.actorKey,
      externalChatId: input.externalChatId,
      objective: input.objective,
      missionId: input.missionId,
      callerServiceId: input.callerServiceId,
      provider: input.provider,
      model: input.model,
      operation,
      requestHash,
      maxTokens: input.maxTokens,
      riskClass: 'read',
      dataClassification: input.dataClassification ?? 'internal',
      authorityScope: [],
      toolScope: [],
      stageLease: input.stageLease,
      sourceAuthority: input.sourceAuthority,
    }),
    signal: AbortSignal.timeout(ADMISSION_TIMEOUT_MS),
  })
  const admission = record(await admissionResponse.json().catch(() => ({}))) ?? {}
  if (!admissionResponse.ok) throw new Error(`CYBORG_ADMISSION_FAILED:${String(admission.error ?? admissionResponse.status)}`)
  const capability = typeof admission.capability === 'string' ? admission.capability : ''
  const missionId = typeof admission.missionId === 'string' ? admission.missionId : ''
  const missionRevision = typeof admission.missionRevision === 'string' ? admission.missionRevision : ''
  const chatId = typeof admission.chatId === 'string' ? admission.chatId : ''
  const invocationId = typeof admission.invocationId === 'string' ? admission.invocationId : ''
  if (!capability || !missionId || !missionRevision || !chatId || !invocationId) throw new Error('CYBORG_ADMISSION_CONTRACT_INVALID')

  const gatewayResponse = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Cyborg ${capability}`,
      'x-cyborg-caller-id': input.callerServiceId,
    },
    body: JSON.stringify({
      missionId,
      missionRevision,
      chatId,
      invocationId,
      callerServiceId: input.callerServiceId,
      provider: input.provider,
      model: input.model,
      operation,
      maxTokens: input.maxTokens,
      messages: input.messages,
      metadata,
    }),
    signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
  })
  const payload = record(await gatewayResponse.json().catch(() => ({}))) ?? {}
  if (!gatewayResponse.ok) throw new CyborgGatewayError(String(payload.error ?? gatewayResponse.status), record(payload.details) ?? {})
  const lineage = record(payload.lineage)
  if (!lineage || lineage.lineageVerified !== true || lineage.policyDecision !== 'ALLOW' || typeof lineage.receiptHash !== 'string') {
    throw new Error('CYBORG_LINEAGE_REQUIRED')
  }
  const { receiptHash: stored, lineageVerified: _verified, ...unsigned } = lineage
  if (await receiptHash(unsigned) !== stored) throw new Error('CYBORG_LINEAGE_HASH_MISMATCH')
  const envelope = record(payload.output)
  return { missionId, missionRevision, chatId, invocationId, output: envelope?.output, lineage }
}

export async function invokeCyborgEdgeModelWithFallback(input: EdgeCyborgInput, fallbacks: EdgeCyborgFallbackRoute[] = []): Promise<EdgeCyborgResult> {
  const routes = [{ provider: input.provider, model: input.model, maxTokens: input.maxTokens }, ...fallbacks]
  let lastError: unknown
  for (let index = 0; index < routes.length; index++) {
    const route = routes[index]
    try {
      return await invokeCyborgEdgeModel({
        ...input,
        provider: route.provider,
        model: route.model,
        maxTokens: route.maxTokens ?? input.maxTokens,
        metadata: { ...(input.metadata ?? {}), routeAttempt: index + 1, fallback: index > 0 },
      })
    } catch (error) {
      lastError = error
      const details = error instanceof CyborgGatewayError ? error.details : {}
      const retryable = details.retryable === true || details.category === 'capacity' || details.category === 'provider_unavailable' || details.category === 'route_unavailable'
      if (!retryable || index === routes.length - 1) throw error
    }
  }
  throw lastError
}

export function groqText(output: unknown): string {
  const root = record(output)
  if (!root || !Array.isArray(root.choices)) return ''
  const first = record(root.choices[0])
  const message = record(first?.message)
  return typeof message?.content === 'string' ? message.content.trim() : ''
}

export function anthropicText(output: unknown): string {
  const root = record(output)
  if (!root || !Array.isArray(root.content)) return ''
  return root.content
    .map((item) => record(item))
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item) => (typeof item.text === 'string' ? item.text : ''))
    .join('')
    .trim()
}
