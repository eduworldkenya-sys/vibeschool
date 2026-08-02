export interface ContentEngineErrorContext {
  operation: string
  code?: string
  details?: string
  hint?: string
}

export class ContentEngineError extends Error {
  readonly operation: string
  readonly code?: string
  readonly details?: string
  readonly hint?: string
  readonly cause?: unknown

  constructor(
    message: string,
    context: ContentEngineErrorContext,
    cause?: unknown,
  ) {
    super(message)
    this.name = 'ContentEngineError'
    this.operation = context.operation
    this.code = context.code
    this.details = context.details
    this.hint = context.hint
    this.cause = cause
  }
}

interface SupabaseLikeError {
  message?: unknown
  code?: unknown
  details?: unknown
  hint?: unknown
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value
    : undefined
}

export function toContentEngineError(
  operation: string,
  error: unknown,
): ContentEngineError {
  if (error instanceof ContentEngineError) {
    return error
  }

  const candidate =
    typeof error === 'object' && error !== null
      ? (error as SupabaseLikeError)
      : null

  const message =
    asOptionalString(candidate?.message) ??
    (error instanceof Error ? error.message : undefined) ??
    `Content Engine operation failed: ${operation}`

  return new ContentEngineError(
    message,
    {
      operation,
      code: asOptionalString(candidate?.code),
      details: asOptionalString(candidate?.details),
      hint: asOptionalString(candidate?.hint),
    },
    error,
  )
}

export function assertRequiredId(
  value: string,
  fieldName: string,
  operation: string,
): string {
  const normalized = value.trim()

  if (!normalized) {
    throw new ContentEngineError(
      `${fieldName} is required.`,
      { operation, code: 'CE_REQUIRED_ID' },
    )
  }

  return normalized
}
