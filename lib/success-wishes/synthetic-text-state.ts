// Isolated, synthetic-only state transitions used by the preview text walkthrough.
// No database, session, real sender or candidate is ever involved.
export type SyntheticTextState = 'compose' | 'request' | 'accepted' | 'hidden'
export type SyntheticTextAction = 'send' | 'accept' | 'hide'
export function syntheticTextTransition(state: SyntheticTextState, action: SyntheticTextAction): SyntheticTextState {
  if (state === 'compose' && action === 'send') return 'request'
  if (state === 'request' && action === 'accept') return 'accepted'
  if ((state === 'request' || state === 'accepted') && action === 'hide') return 'hidden'
  return state
}
