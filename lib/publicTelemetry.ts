export type PublicEventName =
  | 'public_home_start_learning'
  | 'public_home_pathways'
  | 'public_home_teacher'
  | 'public_pathways_start_check'
  | 'public_pathways_school_discovery'
  | 'public_pathways_careers'
  | 'public_contact_whatsapp'
  | 'public_contact_support_submit'
  | 'public_institution_contact'
  | 'public_careers_interest'
  | 'public_auth_signin'

export function trackPublicEvent(event: PublicEventName, path?: string) {
  if (typeof window === 'undefined') return
  const body = JSON.stringify({ event, path: path ?? window.location.pathname })
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/public-telemetry', new Blob([body], { type: 'application/json' }))
      return
    }
    void fetch('/api/public-telemetry', { method:'POST', headers:{'content-type':'application/json'}, body, keepalive:true, credentials:'omit' })
  } catch {
    // Measurement must never block or break the user journey.
  }
}
