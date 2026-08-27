export type PublicEventName =
  | 'public_home_start_learning'
  | 'public_home_pathways'
  | 'public_home_teacher'
  | 'public_home_institutions'
  | 'public_pathways_start_check'
  | 'public_pathways_school_discovery'
  | 'public_pathways_careers'
  | 'public_contact_whatsapp'
  | 'public_contact_support_submit'
  | 'public_institution_contact'
  | 'public_careers_interest'
  | 'public_auth_signin'
  | 'public_readiness_start'
  | 'public_readiness_complete_early'
  | 'public_readiness_complete_fragmented'
  | 'public_readiness_complete_developing'
  | 'public_readiness_complete_connected'
  | 'public_role_learner'
  | 'public_role_teacher'
  | 'public_role_family'
  | 'public_role_school'
  | 'public_connected_explorer_interaction'
  | 'public_capability_status_view'
  | 'public_sandbox_open'
  | 'public_sandbox_progress'
  | 'public_sandbox_role'
  | 'public_sandbox_complete'
  | 'public_sandbox_breadth'
  | 'public_sandbox_signup'
  | 'public_sandbox_pilot'
  | 'public_sandbox_product'
  | 'public_teacher_scheme'
  | 'public_teacher_lesson'
  | 'public_teacher_revision'
  | 'public_teacher_creator'
  | 'public_teacher_payment'
  | 'public_teacher_whatsapp'

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
