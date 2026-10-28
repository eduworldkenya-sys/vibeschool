// A tab-local text draft only. Never store payment details, capabilities or media.
export const SENDER_DRAFT_KEY = 'vibeschool:success-wishes:sender-draft:v1'
export const SENDER_DRAFT_TTL_MS = 24 * 60 * 60 * 1000
export type SenderDraft = {
  theme: 'heritage' | 'botanical' | 'nightfall' | 'sunrise'
  candidate: string
  sender: string
  message: string
  examYear: string
  school: string
  deliveryPhone?: string
}

export function hasSenderDraft(draft: SenderDraft) {
  return Boolean(draft.candidate || draft.sender || draft.message || draft.school || draft.deliveryPhone
    || draft.theme !== 'heritage' || draft.examYear !== '2026')
}

export function encodeSenderDraft(draft: SenderDraft, now = Date.now()) {
  return JSON.stringify({ version: 1, savedAt: now, draft })
}

export function decodeSenderDraft(raw: string | null, now = Date.now()): SenderDraft | null {
  if (!raw || raw.length > 8000) return null
  try {
    const value = JSON.parse(raw)
    if (!value || value.version !== 1 || !Number.isFinite(value.savedAt)
      || value.savedAt > now + 60000 || now - value.savedAt >= SENDER_DRAFT_TTL_MS) return null
    const draft = value.draft
    if (!draft || !['heritage', 'botanical', 'nightfall', 'sunrise'].includes(draft.theme)) return null
    for (const [key, max] of Object.entries({ candidate: 48, sender: 48, message: 220, examYear: 4, school: 80 })) {
      if (typeof draft[key] !== 'string' || draft[key].length > max) return null
    }
    if (!/^\d{0,4}$/.test(draft.examYear)) return null
    if (draft.deliveryPhone !== undefined && (typeof draft.deliveryPhone !== 'string'
      || (draft.deliveryPhone !== '' && !/^(?:0[17]\d{8}|254[17]\d{8}|\+254[17]\d{8})$/.test(draft.deliveryPhone.trim().replace(/[ ()-]/g, ''))))) return null
    // Project allowed fields instead of carrying arbitrary stored properties forward.
    return { theme: draft.theme, candidate: draft.candidate, sender: draft.sender,
      message: draft.message, examYear: draft.examYear, school: draft.school,
      ...(draft.deliveryPhone !== undefined ? { deliveryPhone: draft.deliveryPhone } : {}) }
  } catch { return null }
}
