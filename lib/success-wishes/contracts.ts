export type WishKind = 'text' | 'voice' | 'video'
export class WishError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = 'WishError' }
}
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new WishError(400, 'Check the details and try again.')
  return value as Record<string, unknown>
}
export function field(value: unknown, min: number, max: number): string {
  if (typeof value !== 'string') throw new WishError(400, 'Check the details and try again.')
  const clean = value.trim()
  if (clean.length < min || clean.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(clean)) throw new WishError(400, 'Check the details and try again.')
  return clean
}
export function uuid(value: unknown): string {
  const result = field(value, 36, 36)
  if (!UUID.test(result)) throw new WishError(400, 'Check the details and try again.')
  return result
}
export function retryKey(value: unknown): string {
  const secret = field(value, 64, 64)
  if (!/^[a-f0-9]{64}$/.test(secret)) throw new WishError(400, 'Check the submission reference and try again.')
  return secret
}
export function submission(value: unknown) {
  const b = object(value)
  const kind = field(b.kind, 4, 5)
  if (!['text', 'voice', 'video'].includes(kind) || b.consent !== true) throw new WishError(400, 'Confirm your message and consent before sending.')
  return {
    schoolId: uuid(b.schoolId), admissionNumber: field(b.admissionNumber, 1, 80),
    candidateName: field(b.candidateName, 2, 160), senderName: field(b.senderName, 2, 100),
    relationship: field(b.relationship, 2, 60), kind: kind as WishKind,
    text: kind === 'text' ? field(b.text, 1, 2000) : null,
    idempotencyKey: retryKey(b.idempotencyKey),
  }
}

// Do not treat a changed request as a successful retry of an earlier message.
export function sameSavedTextSubmission(
  previous: { sender_name: string; relationship: string; format: string; body: string | null },
  current: ReturnType<typeof submission>,
): boolean {
  return current.kind === 'text' && previous.format === 'text'
    && previous.sender_name === current.senderName
    && previous.relationship === current.relationship
    && previous.body === current.text
}
